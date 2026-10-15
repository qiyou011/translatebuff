import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { createHash, randomUUID } from "node:crypto"
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { createServer } from "node:http"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(process.env.TEST_REPO ?? join(here, "../../../../.."))
const extensionPath = resolve(process.env.EXTENSION_PATH ?? join(repo, ".output/chrome-mv3"))
const output = resolve(
  process.env.FRAMEWORK_EVIDENCE_DIR ??
    join(here, "framework-runs", new Date().toISOString().replaceAll(":", "-")),
)
const cases = new Set((process.env.FRAMEWORK_CASES ?? "react,lexical").split(",").filter(Boolean))
const require = createRequire(import.meta.url)
const hash = (value) => createHash("sha256").update(value).digest("hex")
const sleep = (ms) => new Promise((done) => setTimeout(done, ms))
const wrapper = ".read-frog-translated-content-wrapper"
const marker = "受控框架译文："
const providerId = "renyimiao-framework-fixture-local"
const evidence = {
  startedAt: new Date().toISOString(),
  fixture: true,
  cases: [],
  requests: [],
  network: [],
  cdp: [],
  errors: [],
  console: [],
  runtimeCalls: [],
  runtimeSnapshots: [],
  limitations: [
    "Controlled localhost OpenAI-compatible provider and controlled Reddit URL; no real Reddit account or remote application is covered.",
    "React/Lexical library behavior is real. These two cases do not complete all G3/G5, actual Reddit, IME, Telegram, Discord or real-account acceptance.",
  ],
}
let temp,
  context,
  server,
  popup,
  activePage,
  extensionId,
  origin,
  bundle,
  phase = "preflight",
  holdText = null
const pendingResponses = new Set()

function safeUrl(value) {
  try {
    const url = new URL(value)
    return `${url.protocol}//${url.host}${url.pathname.replace(/(?:sk-[\w-]+|eyJ[\w.-]{20,})/g, "[redacted]")}`
  } catch {
    return "[unresolved]"
  }
}
function isCommercial(value) {
  try {
    const url = new URL(value)
    const controlledProviderRequest =
      origin && url.origin === origin && url.pathname === "/api/rpc/chat/completions"
    return (
      (/\/api\/(identity|rpc|blog)(\/|$)/.test(url.pathname) && !controlledProviderRequest) ||
      (/(^|\.)(readfrog\.app|read-frog\.com)$/.test(url.hostname) &&
        /hosted|subscription|billing|notebase|transcri/i.test(url.pathname)) ||
      (/^(?:www\.)?googleapis\.com$/.test(url.hostname) && url.pathname.includes("/drive/")) ||
      url.hostname === "oauth2.googleapis.com"
    )
  } catch {
    return false
  }
}
function packageInfo(name) {
  const entry = require.resolve(name)
  let directory = dirname(entry)
  while (directory !== dirname(directory)) {
    const path = join(directory, "package.json")
    if (existsSync(path)) {
      const info = JSON.parse(readFileSync(path, "utf8"))
      if (info.name === name)
        return { name, version: info.version, entry, packageSha256: hash(readFileSync(path)) }
    }
    directory = dirname(directory)
  }
  throw new Error(`Could not determine exact package version: ${name}`)
}
function artifactHash(directory) {
  const files = []
  function walk(path) {
    for (const name of readdirSync(path).sort()) {
      const full = join(path, name)
      if (statSync(full).isDirectory()) walk(full)
      else files.push({ path: relative(directory, full), sha256: hash(readFileSync(full)) })
    }
  }
  walk(directory)
  return { treeSha256: hash(JSON.stringify(files)), files }
}
function flush() {
  mkdirSync(output, { recursive: true })
  writeFileSync(
    join(output, "partial-result.json"),
    `${JSON.stringify({ ...evidence, activePhase: phase }, null, 2)}\n`,
  )
}
async function until(check, label, timeout = 20000) {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    const value = await check()
    if (value) return value
    await sleep(100)
  }
  throw new Error(`Timed out: ${label}`)
}
async function shot(page, name) {
  const path = join(output, `${name}.png`)
  await page.screenshot({ path, fullPage: true })
  return path
}
async function run(id, task) {
  phase = id
  const result = {
    id,
    status: "RUNNING",
    scope: "controlled fixture with actual locally bundled framework libraries",
    startedAt: new Date().toISOString(),
  }
  evidence.cases.push(result)
  flush()
  try {
    result.details = await task()
    result.status = "PASS"
  } catch (error) {
    result.status = "FAIL"
    result.error = String(error.stack ?? error)
    console.error(`${id}: ${result.error}`)
    if (activePage && !activePage.isClosed()) {
      await captureRuntimeState(activePage, "case-failure").catch((diagnosticError) => {
        result.runtimeDiagnosticError = diagnosticError.message
      })
      result.screenshot = await shot(activePage, `${id}-failure`).catch(() => null)
      result.dom = await activePage
        .evaluate(() => ({
          title: document.title,
          html: document.querySelector("#fixture-root")?.innerHTML,
          framework: {
            kind: window.__frameworkFixture?.kind,
            versions: window.__frameworkFixture?.versions,
            errors: window.__frameworkFixture?.errors,
            commits: window.__frameworkFixture?.commits,
          },
          lexical: window.__frameworkFixture?.lexical?.read(),
        }))
        .catch(() => null)
    }
  } finally {
    holdText = null
    for (const release of pendingResponses) release()
    pendingResponses.clear()
  }
  result.completedAt = new Date().toISOString()
  console.log(`${id}: ${result.status}`)
  flush()
}
function html(kind, scriptUrl) {
  return `<!doctype html><html lang="en" data-framework="${kind}"><head><meta charset="utf-8"><title>Controlled ${kind} framework fixture</title><style>body{font:18px/1.6 system-ui;margin:32px;max-width:900px}p{margin:22px 0}.notranslate{font-size:14px;color:#64748b}#other-editor{white-space:pre-wrap;border:1px solid #aaa;padding:12px;margin-bottom:20px}</style></head><body><header class="notranslate">Controlled local fixture using actual framework libraries; this document is not a live third-party website.</header><main id="fixture-root"></main><script type="module" src="${scriptUrl}"></script></body></html>`
}
function responseFor(body) {
  const texts = (body.messages ?? []).map((item) => ({
    role: item.role,
    text:
      typeof item.content === "string"
        ? item.content
        : (item.content ?? [])
            .filter((part) => part.type === "text")
            .map((part) => part.text)
            .join("\n"),
  }))
  const input = texts
    .filter((item) => item.role === "user")
    .map((item) => item.text)
    .join("\n")
  const system = texts
    .filter((item) => item.role !== "user")
    .map((item) => item.text)
    .join("\n")
  const translate = (value) =>
    String(value)
      .split(/(<[^>]+>)/g)
      .map((part) => (part.startsWith("<") || !/[A-Za-z]/.test(part) ? part : `${marker}${part}`))
      .join("")
  const start = input.indexOf('{"t0"')
  const content =
    start >= 0
      ? JSON.stringify(
          Object.fromEntries(
            Object.entries(JSON.parse(input.slice(start).trim())).map(([key, value]) => [
              key,
              translate(value),
            ]),
          ),
        )
      : translate(input.replace(/^Translate to[^:]*:\s*/i, ""))
  return { input, system, content }
}
async function serve() {
  server = createServer(async (req, res) => {
    res.setHeader("access-control-allow-origin", "*")
    res.setHeader("access-control-allow-headers", "*")
    res.setHeader("access-control-allow-methods", "GET,POST,OPTIONS")
    if (req.method === "OPTIONS") {
      res.writeHead(204).end()
      return
    }
    if (req.method === "POST" && req.url.startsWith("/api/rpc/")) {
      try {
        const chunks = []
        for await (const chunk of req) chunks.push(chunk)
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8"))
        const completion = responseFor(body)
        const request = {
          index: evidence.requests.length,
          phase,
          model: body.model,
          stream: Boolean(body.stream),
          input: completion.input,
          system: completion.system,
          bodySha256: hash(JSON.stringify(body)),
          held: Boolean(holdText && completion.input.includes(holdText)),
        }
        evidence.requests.push(request)
        flush()
        if (request.held)
          await new Promise((done) => {
            const release = () => {
              pendingResponses.delete(release)
              done()
            }
            pendingResponses.add(release)
          })
        else await sleep(600)
        const base = {
          id: `chatcmpl-${randomUUID()}`,
          created: Math.floor(Date.now() / 1000),
          model: body.model,
        }
        if (body.stream) {
          res.writeHead(200, { "content-type": "text/event-stream" })
          res.end(
            `data: ${JSON.stringify({ ...base, object: "chat.completion.chunk", choices: [{ index: 0, delta: { role: "assistant", content: completion.content }, finish_reason: null }] })}\n\ndata: ${JSON.stringify({ ...base, object: "chat.completion.chunk", choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`,
          )
        } else {
          res.writeHead(200, { "content-type": "application/json" })
          res.end(
            JSON.stringify({
              ...base,
              object: "chat.completion",
              choices: [
                {
                  index: 0,
                  message: { role: "assistant", content: completion.content },
                  finish_reason: "stop",
                },
              ],
              usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
            }),
          )
        }
      } catch (error) {
        evidence.errors.push({ source: "controlled-provider", error: error.message })
        res
          .writeHead(400)
          .end(JSON.stringify({ error: { message: "Controlled fixture decode failure" } }))
      }
      return
    }
    if (req.url === "/framework-fixture.js") {
      res.writeHead(200, { "content-type": "text/javascript" }).end(bundle)
      return
    }
    res
      .writeHead(200, { "content-type": "text/html; charset=utf-8" })
      .end(html("react", "/framework-fixture.js"))
  })
  await new Promise((done, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", done)
  })
  origin = `http://127.0.0.1:${server.address().port}`
}
async function runtime(type, data) {
  const response = await popup.evaluate(
    async ({ requestType, payload }) => {
      const now = Date.now()
      const result = await chrome.runtime.sendMessage({
        id: now,
        timestamp: now,
        type: requestType,
        data: payload,
      })
      if (result?.err) throw new Error(result.err.message ?? "Runtime message failed")
      return result && Object.hasOwn(result, "res") ? result.res : result
    },
    { requestType: type, payload: data },
  )
  evidence.runtimeCalls.push({ phase, type, data, response: response ?? null })
  flush()
  return response
}
async function captureRuntimeState(page, label) {
  const snapshot = await popup.evaluate(async (targetUrl) => {
    const tabs = await chrome.tabs.query({})
    const target = tabs.find((tab) => tab.url === targetUrl)
    const { config } = await chrome.storage.local.get("config")
    const stateKey = `translationState.${target?.id}`
    const session = await chrome.storage.session.get(stateKey)
    let isolated
    if (target?.id) {
      try {
        const [result] = await chrome.scripting.executeScript({
          target: { tabId: target.id, frameIds: [0] },
          world: "ISOLATED",
          func: () => ({
            hostInjected: Boolean(window.__READ_FROG_HOST_INJECTED__),
            readyState: document.readyState,
            walkedNodes: document.querySelectorAll("[data-read-frog-walked]").length,
            wrappers: document.querySelectorAll(".read-frog-translated-content-wrapper").length,
          }),
        })
        isolated = result?.result
      } catch (error) {
        isolated = { error: error.message }
      }
    }
    return {
      tab: target
        ? { id: target.id, status: target.status, active: target.active, url: target.url }
        : null,
      storedConfig: window.__summarizeFrameworkConfig?.(config),
      configEvents: window.__frameworkConfigEvents ?? [],
      translationState: session[stateKey] ?? null,
      isolated,
    }
  }, page.url())
  evidence.runtimeSnapshots.push({ phase, label, at: new Date().toISOString(), ...snapshot })
  flush()
  return snapshot
}
async function enableTranslation(page) {
  const id = await popup.evaluate(
    async (targetUrl) => (await chrome.tabs.query({})).find((tab) => tab.url === targetUrl)?.id,
    page.url(),
  )
  assert.ok(Number.isInteger(id))
  // React mounting does not imply that the extension has finished its async
  // bootstrap. Probe an existing top-frame handler registered AFTER the manager
  // toggle handler; do not repeatedly enable translation until it happens to work.
  const readiness = { tabId: id, probes: [] }
  evidence.hostReadiness ??= []
  evidence.hostReadiness.push(readiness)
  await until(async () => {
    const probe = await popup.evaluate(async (tabId) => {
      const now = Date.now()
      try {
        const response = await chrome.tabs.sendMessage(
          tabId,
          {
            id: now,
            timestamp: now,
            type: "refreshDetectedPageLanguage",
          },
          { frameId: 0 },
        )
        return {
          acknowledged: response !== undefined && !response?.err,
          response: response ?? null,
        }
      } catch (error) {
        return { acknowledged: false, error: error.message }
      }
    }, id)
    readiness.probes.push({ at: new Date().toISOString(), ...probe })
    flush()
    return probe.acknowledged
  }, "top-frame host manager message handlers ready")
  const before = await captureRuntimeState(page, "host-ready-before-single-enable")
  assert.equal(
    before.storedConfig?.pageProviderId,
    providerId,
    "Stored page provider must remain the validated fixture provider",
  )
  assert.equal(before.storedConfig?.mode, "bilingual")
  assert.equal(before.isolated?.hostInjected, true)
  await runtime("tryToSetEnablePageTranslationByTabId", { tabId: id, enabled: true })
  await until(
    async () => (await runtime("getEnablePageTranslationByTabId", { tabId: id })) === true,
    "page manager acknowledges active translation state",
  )
  const active = await captureRuntimeState(page, "manager-active-after-single-enable")
  assert.equal(active.translationState?.enabled, true)
  assert.equal(active.storedConfig?.pageProviderId, providerId)
}
async function waitTranslated(page) {
  await page
    .locator(`#react-copy ${wrapper}`)
    .filter({ hasText: marker })
    .waitFor({ state: "visible", timeout: 30000 })
  await until(
    () =>
      page
        .locator(".read-frog-spinner")
        .count()
        .then((count) => count === 0),
    "React translation completes",
  )
}
async function installConfig() {
  const schemaChunks = evidence.identity.artifact.files
    .filter(
      (file) =>
        file.path.startsWith("chunks/") &&
        file.path.endsWith(".js") &&
        readFileSync(join(extensionPath, file.path), "utf8").includes("Note suggestion action"),
    )
    .map((file) => file.path)
  assert.ok(schemaChunks.length)
  await until(
    () =>
      popup.evaluate(async () =>
        Boolean((await chrome.storage.local.get("config")).config?.pageTranslation),
      ),
    "fresh complete config",
  )
  const configResult = await popup.evaluate(
    async ({ provider, baseURL, chunks }) => {
      window.__summarizeFrameworkConfig = (value) =>
        value
          ? {
              schemaVersion: value.schemaVersion ?? null,
              pageProviderId: value.pageTranslation?.providerId,
              inputProviderId: value.inputTranslation?.providerId,
              mode: value.pageTranslation?.mode,
              page: value.pageTranslation?.page,
              language: value.language,
              siteControl: value.siteControl,
              providers: value.providersConfig?.map(
                ({ id, provider: providerType, enabled, baseURL: providerBaseURL }) => ({
                  id,
                  provider: providerType,
                  enabled,
                  baseURL: providerBaseURL,
                }),
              ),
            }
          : null
      window.__frameworkConfigEvents = []
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === "local" && changes.config) {
          window.__frameworkConfigEvents.push({
            at: Date.now(),
            config: window.__summarizeFrameworkConfig(changes.config.newValue),
          })
        }
      })
      const { config } = await chrome.storage.local.get("config")
      config.providersConfig = [
        ...config.providersConfig.filter((row) => row.id !== provider),
        {
          id: provider,
          name: "Controlled framework localhost stub",
          provider: "openai-compatible",
          enabled: true,
          apiKey: "framework-local-only-dummy",
          baseURL,
          model: {
            model: "use-custom-model",
            isCustomModel: true,
            customModel: "controlled-framework-model",
          },
        },
      ]
      config.language = { ...config.language, sourceCode: "eng", targetCode: "cmn" }
      config.uiLanguage = "en"
      config.pageTranslation = {
        ...config.pageTranslation,
        providerId: provider,
        mode: "bilingual",
        enableAIContentAware: false,
        page: {
          ...config.pageTranslation.page,
          range: "all",
          translateTitle: false,
          minCharactersPerNode: 0,
          minWordsPerNode: 0,
          enableTargetLanguageSkip: false,
          autoTranslatePatterns: [],
          autoTranslateLanguages: [],
        },
      }
      config.inputTranslation = {
        ...config.inputTranslation,
        enabled: true,
        providerId: provider,
        fromLang: "eng",
        toLang: "cmn",
        enableCycle: false,
        timeThreshold: 500,
      }
      config.selectionToolbar.noteSuggestion = {
        ...config.selectionToolbar.noteSuggestion,
        enabled: false,
      }
      config.siteControl = { ...config.siteControl, mode: "blacklist", blacklistPatterns: [] }
      for (const chunkPath of chunks) {
        const module = await import(chrome.runtime.getURL(chunkPath))
        const schema = Object.values(module).find(
          (candidate) =>
            candidate?.safeParse &&
            candidate.shape?.pageTranslation &&
            candidate.shape?.providersConfig &&
            candidate.shape?.siteControl,
        )
        if (!schema) continue
        const parsed = schema.safeParse(config)
        if (!parsed.success)
          return {
            success: false,
            issues: parsed.error.issues.map((issue) => ({
              path: issue.path,
              message: issue.message,
            })),
          }
        await chrome.storage.local.set({ config: parsed.data })
        return {
          success: true,
          schemaChunk: chunkPath,
          providerId: parsed.data.pageTranslation.providerId,
          inputProviderId: parsed.data.inputTranslation.providerId,
        }
      }
      throw new Error("Actual built config schema export missing")
    },
    { provider: providerId, baseURL: `${origin}/api/rpc`, chunks: schemaChunks },
  )
  evidence.config = configResult
  assert.ok(configResult.success, JSON.stringify(configResult))
  flush()
}
async function instrument() {
  context.on("request", (request) => {
    let frameUrl, workerUrl
    try {
      frameUrl = request.frame().url()
    } catch {}
    try {
      workerUrl = request.serviceWorker()?.url()
    } catch {}
    evidence.network.push({
      phase,
      method: request.method(),
      url: safeUrl(request.url()),
      context: workerUrl
        ? "service-worker"
        : frameUrl?.startsWith("chrome-extension:")
          ? "extension-page"
          : "page-or-content-script",
      frameUrl: frameUrl ? safeUrl(frameUrl) : undefined,
      serviceWorkerUrl: workerUrl ? safeUrl(workerUrl) : undefined,
      commercial: isCommercial(request.url()),
    })
  })
  async function pageCdp(page) {
    page.on("console", (message) => {
      evidence.console.push({
        phase,
        type: message.type(),
        page: safeUrl(page.url()),
        text: message
          .text()
          .replaceAll("framework-local-only-dummy", "[fixture-key]")
          .slice(0, 2000),
        location: message.location(),
      })
    })
    page.on("pageerror", (error) =>
      evidence.errors.push({ phase, source: "page", error: error.message }),
    )
    const session = await context.newCDPSession(page)
    session.on("Network.requestWillBeSent", (event) => {
      const stack = event.initiator?.stack?.callFrames ?? []
      evidence.cdp.push({
        phase,
        url: safeUrl(event.request.url),
        method: event.request.method,
        target: safeUrl(page.url()),
        initiatorType: event.initiator?.type,
        stack: stack.slice(0, 8).map((frame) => ({
          url: safeUrl(frame.url),
          functionName: frame.functionName,
          lineNumber: frame.lineNumber,
        })),
        attributedContext: page.url().startsWith("chrome-extension:")
          ? "extension-page"
          : stack.some((frame) => frame.url.startsWith("chrome-extension:"))
            ? "content-script"
            : "page-or-unresolved",
        commercial: isCommercial(event.request.url),
      })
    })
    await session.send("Network.enable")
  }
  context.on("page", (page) => {
    void pageCdp(page).catch((error) =>
      evidence.errors.push({ source: "page-cdp", error: error.message }),
    )
  })
  for (const page of context.pages()) await pageCdp(page)
}

try {
  assert.ok(
    cases.size && [...cases].every((name) => ["react", "lexical"].includes(name)),
    "FRAMEWORK_CASES must be react,lexical or either one",
  )
  temp = mkdtempSync(join(tmpdir(), "translatebuff-framework-fixture-"))
  const packages = [packageInfo("react"), packageInfo("react-dom"), packageInfo("lexical")]
  evidence.frameworks = packages
  assert.equal(packages.find((info) => info.name === "react").version, "19.3.0")
  assert.equal(packages.find((info) => info.name === "lexical").version, "0.52.0")
  const wxtRequire = createRequire(require.resolve("wxt"))
  const esbuildPath = process.env.ESBUILD_MODULE ?? wxtRequire.resolve("esbuild")
  const { build } = await import(pathToFileURL(esbuildPath).href)
  const built = await build({
    absWorkingDir: repo,
    entryPoints: [join(here, "framework-fixture.jsx")],
    outfile: join(temp, "framework-fixture.js"),
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "chrome120",
    jsx: "automatic",
    metafile: true,
    define: {
      "process.env.NODE_ENV": '"development"',
      "globalThis.__LEXICAL_PACKAGE_VERSION__": JSON.stringify(
        packages.find((info) => info.name === "lexical").version,
      ),
    },
    logLevel: "silent",
  })
  bundle = readFileSync(join(temp, "framework-fixture.js"))
  evidence.fixtureBundle = {
    sha256: hash(bundle),
    bytes: bundle.length,
    entrySha256: hash(readFileSync(join(here, "framework-fixture.jsx"))),
    libraryInputs: Object.keys(built.metafile.inputs).filter((path) =>
      /\/(react|react-dom|lexical)\//.test(path),
    ),
  }
  assert.ok(evidence.fixtureBundle.libraryInputs.some((path) => path.includes("/lexical/")))
  if (process.argv.includes("--bundle-check")) {
    writeFileSync(
      1,
      `${JSON.stringify({ frameworks: evidence.frameworks, fixtureBundle: evidence.fixtureBundle, browserStarted: false }, null, 2)}\n`,
    )
  } else {
    const { chromium } = await import(
      pathToFileURL(
        process.env.PLAYWRIGHT_MODULE ??
          "/Users/yisen/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs",
      ).href
    )
    const manifestPath = join(extensionPath, "manifest.json")
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"))
    evidence.identity = {
      candidateSha: execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: repo,
        encoding: "utf8",
      }).trim(),
      targetSha: "55bcef1e684fb4e70f4dce3063e7bd3066f46891",
      dirty:
        execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], {
          cwd: repo,
          encoding: "utf8",
        }).trim().length > 0,
      extensionPath,
      manifest: {
        name: manifest.name,
        version: manifest.version,
        manifestVersion: manifest.manifest_version,
      },
      manifestSha256: hash(readFileSync(manifestPath)),
      artifact: artifactHash(extensionPath),
      buildEdition: process.env.BUILD_EDITION ?? "UNSPECIFIED",
      buildEnvironment: process.env.BUILD_ENVIRONMENT ?? "UNSPECIFIED",
    }
    await serve()
    context = await chromium.launchPersistentContext(join(temp, "profile"), {
      executablePath: process.env.BROWSER_EXECUTABLE ?? chromium.executablePath(),
      headless: false,
      ignoreDefaultArgs: ["--disable-extensions"],
      viewport: { width: 1440, height: 1000 },
      args: [
        "--no-first-run",
        "--no-default-browser-check",
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        `--log-net-log=${join(temp, "netlog.json")}`,
        "--net-log-capture-mode=Default",
      ],
    })
    evidence.identity.browserVersion = context.browser().version()
    await instrument()
    const worker =
      context
        .serviceWorkers()
        .find((candidateWorker) => candidateWorker.url().startsWith("chrome-extension:")) ??
      (await context.waitForEvent("serviceworker", { timeout: 30000 }))
    extensionId = new URL(worker.url()).hostname
    evidence.identity.extensionId = extensionId
    evidence.identity.workerUrl = safeUrl(worker.url())
    popup = await context.newPage()
    await popup.goto(`chrome-extension://${extensionId}/popup.html`)
    await installConfig()
    if (cases.has("react"))
      await run("P04-real-react19", async () => {
        const page = await context.newPage()
        activePage = page
        await page.goto(`${origin}/react`)
        await until(
          () => page.evaluate(() => window.__frameworkFixture?.ready),
          "actual React fixture mount",
        )
        assert.equal(await page.evaluate(() => window.__frameworkFixture.versions.react), "19.3.0")
        await enableTranslation(page)
        await waitTranslated(page)
        const completedRequests = evidence.requests.length
        assert.ok(completedRequests > 0)
        await page.evaluate((selector) => {
          window.__oldReactParagraph = document.querySelector("#react-copy")
          window.__oldReactWrapper = document.querySelector(`#react-copy ${selector}`)
          window.__frameworkFixture.rewriteReact("complete")
        }, wrapper)
        await waitTranslated(page)
        await sleep(900)
        const same = await page.evaluate(
          (selector) => ({
            paragraphReplaced: window.__oldReactParagraph !== document.querySelector("#react-copy"),
            sameWrapper:
              window.__oldReactWrapper === document.querySelector(`#react-copy ${selector}`),
            commits: window.__frameworkFixture.commits,
          }),
          wrapper,
        )
        evidence.reactChecks = { same }
        flush()
        assert.ok(
          same.paragraphReplaced && same.sameWrapper,
          "Actual React identical rewrite must move the same completed wrapper",
        )
        assert.equal(
          evidence.requests.length,
          completedRequests,
          "Identical completed rewrite must not send another provider request",
        )
        await shot(page, "P04-identical-rewrite")
        await page.evaluate(() => window.__frameworkFixture.rewriteReact("structure"))
        await waitTranslated(page)
        const structure = await page.evaluate(
          (selector) => ({
            reusedOldWrapper:
              window.__oldReactWrapper === document.querySelector(`#react-copy ${selector}`),
            strongText: document.querySelector("#react-copy strong")?.textContent,
            oldLinks: document.querySelectorAll('#react-copy a[href="/first"]').length,
          }),
          wrapper,
        )
        evidence.reactChecks.structure = structure
        flush()
        assert.equal(
          structure.reusedOldWrapper,
          false,
          "Same plain text with changed structure must not carry the old wrapper",
        )
        assert.equal(structure.strongText, "linked concept")
        assert.equal(structure.oldLinks, 0)
        await shot(page, "P04-structure-change")
        holdText = "FRAME_PENDING_CANARY"
        await page.evaluate(() => window.__frameworkFixture.rewriteReact("pending"))
        await until(
          () =>
            evidence.requests.some(
              (request) => request.held && request.input.includes("FRAME_PENDING_CANARY"),
            ),
          "pending React provider request held",
        )
        await page.locator("#react-copy .read-frog-spinner").waitFor({ state: "visible" })
        await page.evaluate((selector) => {
          window.__pendingParagraph = document.querySelector("#react-copy")
          window.__pendingWrapper = document.querySelector(`#react-copy ${selector}`)
          window.__pendingSpinner = document.querySelector("#react-copy .read-frog-spinner")
          window.__frameworkFixture.rewriteReact("pending")
        }, wrapper)
        await until(
          () =>
            page.evaluate(
              () =>
                window.__pendingParagraph !== document.querySelector("#react-copy") &&
                !window.__pendingSpinner.isConnected,
            ),
          "pending node detached after actual React rewrite",
        )
        await shot(page, "P04-pending-rewrite")
        holdText = null
        for (const release of pendingResponses) release()
        pendingResponses.clear()
        await waitTranslated(page)
        const pending = await page.evaluate(
          (selector) => ({
            oldPendingWrapperReused:
              window.__pendingWrapper === document.querySelector(`#react-copy ${selector}`),
            oldSpinnerConnected: window.__pendingSpinner.isConnected,
            hadPendingWrapper: Boolean(window.__pendingWrapper),
            text: document.querySelector("#react-copy").textContent,
            errors: window.__frameworkFixture.errors,
          }),
          wrapper,
        )
        evidence.reactChecks.pending = pending
        flush()
        assert.equal(pending.oldPendingWrapperReused, false)
        assert.equal(pending.oldSpinnerConnected, false)
        assert.deepEqual(pending.errors, [])
        await shot(page, "P04-pending-complete")
        return {
          reactVersion: "19.3.0",
          same,
          structure,
          pending,
          completedRequests,
          totalRequests: evidence.requests.length,
          limitation:
            "Pending DOM is not carried; equivalent lower transport requests may still deduplicate/cache normally. Live third-party application not covered.",
        }
      })
    if (cases.has("lexical"))
      await run("P14-real-lexical-reddit-fixture", async () => {
        const page = await context.newPage()
        activePage = page
        const redditUrl = "https://www.reddit.com/r/controlled/comments/framework/reply/"
        await page.route(redditUrl, (route) =>
          route.fulfill({
            contentType: "text/html; charset=utf-8",
            body: html("lexical", "/controlled-framework-fixture.js"),
          }),
        )
        await page.route("https://www.reddit.com/controlled-framework-fixture.js", (route) =>
          route.fulfill({ contentType: "text/javascript", body: bundle }),
        )
        await page.goto(redditUrl)
        await until(
          () => page.evaluate(() => window.__frameworkFixture?.ready),
          "actual Lexical fixture mount",
        )
        const initial = await page.evaluate(() => ({
          ...window.__frameworkFixture.lexical.read(),
          version: window.__frameworkFixture.versions.lexical,
        }))
        assert.equal(initial.version, "0.52.0")
        assert.ok(initial.hasRealEditor && initial.pageBridge)
        const target = page.locator("#reply-host #reply-editor")
        await target.click()
        await page.evaluate(() => window.__frameworkFixture.lexical.focusEnd())
        assert.ok(
          await page.evaluate(() => window.__frameworkFixture.lexical.read().deepFocused),
          "Actual focused editor must be inside open shadow DOM",
        )
        const before = evidence.requests.length
        for (let index = 0; index < 3; index++) await page.keyboard.press("Space")
        await until(
          () => evidence.requests.length > before,
          "trusted three spaces send input translation",
        )
        await until(
          () =>
            page.evaluate(() =>
              window.__frameworkFixture.lexical.read().target.includes("受控框架译文："),
            ),
          "real MAIN injector writes actual Lexical state",
        )
        assert.equal(
          (await page.evaluate(() => window.__frameworkFixture.lexical.read())).other,
          initial.other,
        )
        await shot(page, "P14-translated-deep-editor")
        await page.keyboard.type(" USER_EDIT")
        await until(
          () =>
            page.evaluate(() =>
              window.__frameworkFixture.lexical.read().target.includes("USER_EDIT"),
            ),
          "trusted user edit after translation",
        )
        await page
          .getByRole("button", { name: /^Undo$|^撤销$/i })
          .last()
          .click()
        await until(
          () =>
            page.evaluate(
              (original) => window.__frameworkFixture.lexical.read().target === original,
              initial.target,
            ),
          "UI undo restores immutable original including whitespace",
        )
        await shot(page, "P14-undo-original")
        const lateOriginal =
          "  LATE_TARGET_CANARY is a second reply draft for controlled delayed-response cancellation.  "
        await page.evaluate((text) => {
          window.__frameworkFixture.lexical.write(text)
          window.__frameworkFixture.lexical.focusEnd()
        }, lateOriginal)
        holdText = "LATE_TARGET_CANARY"
        for (let index = 0; index < 3; index++) await page.keyboard.press("Space")
        await until(
          () =>
            evidence.requests.some(
              (request) => request.held && request.input.includes("LATE_TARGET_CANARY"),
            ),
          "late response held",
        )
        await page.keyboard.type(" NEW_DRAFT_EDIT")
        const edited = await page.evaluate(() => window.__frameworkFixture.lexical.read().target)
        assert.ok(edited.includes("NEW_DRAFT_EDIT"))
        holdText = null
        for (const release of pendingResponses) release()
        pendingResponses.clear()
        await sleep(1800)
        const finalState = await page.evaluate(() => window.__frameworkFixture.lexical.read())
        assert.equal(
          finalState.target,
          edited,
          "Delayed result must not overwrite the user's new draft",
        )
        assert.equal(finalState.other, initial.other)
        assert.deepEqual(await page.evaluate(() => window.__frameworkFixture.errors), [])
        await shot(page, "P14-late-response-rejected")
        return {
          lexicalVersion: initial.version,
          simulatedRedditUrl: redditUrl,
          fixture: true,
          initial,
          undoRestoredExactOriginal: true,
          staleResponsePreservedDraft: true,
          finalState,
          requests: evidence.requests.length - before,
          limitation:
            "Actual Lexical editor and deep focus, controlled Reddit-shaped URL; live Reddit markup, IME, Telegram and Discord remain pending.",
        }
      })
  }
} catch (error) {
  evidence.fatal = String(error.stack ?? error)
  console.error(evidence.fatal)
  process.exitCode = 1
} finally {
  for (const release of pendingResponses) release()
  pendingResponses.clear()
  if (context)
    await context
      .close()
      .catch((error) => evidence.errors.push({ source: "close-browser", error: error.message }))
  if (server)
    await new Promise((done) => {
      server.close(done)
      server.closeAllConnections()
    })
  if (temp && existsSync(join(temp, "netlog.json"))) {
    try {
      const log = JSON.parse(readFileSync(join(temp, "netlog.json"), "utf8"))
      evidence.startupUrls = [
        ...new Set(
          (log.events ?? [])
            .map((event) => event.params?.url)
            .filter((url) => typeof url === "string" && /^https?:/.test(url)),
        ),
      ].map((url) => ({ url: safeUrl(url), commercial: isCommercial(url) }))
    } catch (error) {
      evidence.errors.push({ source: "netlog", error: error.message })
    }
  }
  if (evidence.identity) {
    evidence.identity.artifactEndTreeSha256 = artifactHash(extensionPath).treeSha256
    evidence.identity.artifactUnchanged =
      evidence.identity.artifactEndTreeSha256 === evidence.identity.artifact.treeSha256
    if (!evidence.identity.artifactUnchanged) process.exitCode = 1
  }
  if (temp) rmSync(temp, { recursive: true, force: true })
  evidence.completedAt = new Date().toISOString()
  evidence.commercialRequests = [
    ...evidence.network,
    ...evidence.cdp,
    ...(evidence.startupUrls ?? []),
  ].filter((request) => request.commercial)
  evidence.networkScope = {
    noCommercialRouteBlocking: true,
    serviceWorkerAttributedByPlaywright: true,
    pageCdpInitiators: true,
    directWorkerCdp: false,
    fullG5Acceptance: false,
  }
  if (
    evidence.cases.some((result) => result.status === "FAIL") ||
    evidence.commercialRequests.length
  )
    process.exitCode = 1
  if (!process.argv.includes("--bundle-check")) {
    flush()
    writeFileSync(join(output, "result.json"), `${JSON.stringify(evidence, null, 2)}\n`)
    console.log(
      JSON.stringify(
        {
          output,
          cases: evidence.cases.map(({ id, status }) => ({ id, status })),
          fatal: evidence.fatal,
        },
        null,
        2,
      ),
    )
  }
}
