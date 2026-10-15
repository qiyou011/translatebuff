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
import { tmpdir } from "node:os"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
const playwrightModule =
  "/Users/yisen/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs"
const { chromium } = await import(playwrightModule)

// Independent fresh profile; the only simulated surfaces are the page fixture and
// localhost model transport. The built extension and its content scripts are real.
const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, "../../../../..")
const artifact = join(repo, ".output/chrome-mv3")
const output = join(here, "runs", new Date().toISOString().replaceAll(":", "-"))
const providerId = "renyimiao-site-extras-local"
const originalTitle = "Long Wikipedia controlled context article"
const articleUrl = "https://en.wikipedia.org/wiki/Controlled_context_article"
const googleUrl = "https://www.google.com/search?q=controlled-citation"
const wrapper = ".read-frog-translated-content-wrapper"
const actionName = "Controlled long page context"
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex")
const sleep = (ms) => new Promise((done) => setTimeout(done, ms))
const result = {
  startedAt: new Date().toISOString(),
  cases: [],
  requests: [],
  network: [],
  errors: [],
  configValidations: [],
  limitations: [],
}
let context,
  popup,
  server,
  profile,
  origin,
  extensionId,
  phase = "startup",
  activePage
mkdirSync(output, { recursive: true })

function safeUrl(raw) {
  try {
    const url = new URL(raw)
    return `${url.protocol}//${url.host}${url.pathname}`
  } catch {
    return "[unresolved]"
  }
}
function flush() {
  writeFileSync(join(output, "result.json"), `${JSON.stringify(result, null, 2)}\n`)
}
function digestTree(directory) {
  const files = []
  function walk(path) {
    for (const name of readdirSync(path).sort()) {
      const full = join(path, name)
      if (statSync(full).isDirectory()) walk(full)
      else
        files.push({
          path: relative(directory, full),
          bytes: statSync(full).size,
          sha256: sha256(readFileSync(full)),
        })
    }
  }
  walk(directory)
  return { treeSha256: sha256(JSON.stringify(files)), files }
}
async function wait(check, label, timeout = 30000) {
  const started = Date.now()
  while (Date.now() - started < timeout) {
    const value = await check()
    if (value) return value
    await sleep(100)
  }
  throw new Error(`Timed out: ${label}`)
}
async function screenshot(page, name) {
  const path = join(output, `${name}.png`)
  await page.screenshot({ path, fullPage: false })
  return path
}
async function runCase(id, fn) {
  phase = id
  const item = {
    id,
    status: "RUNNING",
    scope: "controlled-site-fixture-real-built-extension",
    startedAt: new Date().toISOString(),
  }
  result.cases.push(item)
  flush()
  try {
    item.details = await fn()
    item.status = "PASS"
  } catch (error) {
    item.status = "FAIL"
    item.error = String(error.stack ?? error)
    if (activePage)
      item.failureScreenshot = await screenshot(activePage, `${id}-failure`).catch(() => null)
  }
  item.completedAt = new Date().toISOString()
  flush()
  console.log(`${id}: ${item.status}`)
}
function longPage() {
  let nested =
    "<span>NESTED_TABLE_CANARY Anura ecology and mountain forest habitat observations.</span>"
  for (let i = 0; i < 36; i++)
    nested = `<table data-depth="${i}"><tbody><tr><th>D${i}</th><td>${nested}</td></tr></tbody></table>`
  const paragraphs = Array.from(
    { length: 1800 },
    (_, i) =>
      `<p>Long article section ${i}. Field researchers examined amphibian habitat and recorded seasonal water quality. This intentionally public synthetic text tests bounded webpage context extraction without an account. ${"Conservation evidence requires repeatable observations. ".repeat(3)}</p>`,
  ).join("")
  return `<!doctype html><html lang="en"><head><title>${originalTitle}</title><meta name="description" content="CONTROLLED_PUBLIC_DESCRIPTION Long article with nested tables."><style>body{font:18px/1.5 system-ui;margin:30px auto;max-width:980px}table{border-collapse:collapse;border:1px solid #ddd}td{padding:1px}h1{font-size:26px}</style></head><body><main><article><h1>${originalTitle}</h1><p id="select-me">Selected public sentence for explicit context action.</p><p>The following nested table contains public article context.</p>${nested}<h2 id="section-anchor">Article section</h2>${paragraphs}</article></main></body></html>`
}
function googlePage() {
  return `<!doctype html><html lang="en"><head><title>Controlled Google AI Overview fixture</title><style>body{font:18px/1.5 system-ui;margin:30px;background:#f8fafd}button{padding:12px;font-size:18px}.card{position:absolute;left:120px;top:120px;width:560px;height:360px;background:white;border:1px solid #bbb;border-radius:18px;padding:22px;box-shadow:0 8px 30px #0002}.scroll{height:250px;overflow-y:auto;border:1px solid #ccd;padding:10px}.snippet{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;max-height:54px;overflow:hidden;margin:0}.outside{position:absolute;top:560px;width:560px;height:54px;max-height:54px;overflow:hidden;border:1px dashed #777}</style></head><body><h1>Google AI Overview controlled citation fixture</h1><button id="open-card" onclick="document.querySelector('[role=dialog]').hidden=false">Open reference card</button><div role="dialog" data-skip-highlighting class="card" hidden><h2 style="font-size:20px;margin:0 0 12px">Citation source</h2><div id="inner-scroll" class="scroll"><p id="source-snippet" class="snippet">Citation source describes amphibian habitats and explains the public ecological evidence. The translated source text should remain readable within this citation card and scroll internally when expanded.</p></div></div><div id="outside-control" class="outside">Unrelated container retains its original overflow and height restriction.</div></body></html>`
}
function messageText(body) {
  return (body.messages ?? []).map((message) => ({
    role: message.role,
    text:
      typeof message.content === "string"
        ? message.content
        : (message.content ?? [])
            .filter((part) => part.type === "text")
            .map((part) => part.text)
            .join("\n"),
  }))
}
function translate(input) {
  const value =
    phase === "P06-google-citation-card" && input.includes("Citation source describes")
      ? `受控长译文：${"这段引用说明两栖动物栖息地与生态研究证据，长译文应完整展示，并且保留引用卡片内部滚动。".repeat(18)}卡片末端可见标记`
      : `受控译文：${input}`
  // Keep inline tags intact, as required by the production page-translation contract.
  return input
    .split(/(<[^>]+>)/g)
    .map((part) => (part.startsWith("<") || !/[A-Za-z]/.test(part) ? part : value))
    .join("")
}
async function startServer() {
  server = createServer(async (req, res) => {
    res.setHeader("access-control-allow-origin", "*")
    res.setHeader("access-control-allow-headers", "*")
    res.setHeader("access-control-allow-methods", "POST,GET,OPTIONS")
    if (req.method === "OPTIONS") {
      res.writeHead(204).end()
      return
    }
    if (req.method === "POST" && req.url.startsWith("/api/rpc/")) {
      try {
        const chunks = []
        for await (const chunk of req) chunks.push(chunk)
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8"))
        const messages = messageText(body)
        const system = messages
          .filter((message) => ["system", "developer"].includes(message.role))
          .map((message) => message.text)
          .join("\n")
        const input = messages
          .filter((message) => message.role === "user")
          .map((message) => message.text)
          .join("\n")
        result.requests.push({
          phase,
          at: Date.now(),
          url: safeUrl(`${origin}${req.url}`),
          method: req.method,
          model: body.model,
          stream: body.stream === true,
          bodySha256: sha256(JSON.stringify(body)),
          system,
          input,
        })
        flush()
        let content
        if (system.includes("CONTROLLED_LONG_CONTEXT_ACTION"))
          content = JSON.stringify({ contextProof: "received" })
        else {
          const jsonStart = input.indexOf('{"t0"')
          content =
            jsonStart >= 0
              ? JSON.stringify(
                  Object.fromEntries(
                    Object.entries(JSON.parse(input.slice(jsonStart).trim())).map(
                      ([key, value]) => [key, translate(String(value))],
                    ),
                  ),
                )
              : translate(input)
        }
        const base = {
          id: `chatcmpl-${randomUUID()}`,
          created: Math.floor(Date.now() / 1000),
          model: body.model,
        }
        if (body.stream) {
          res.writeHead(200, { "content-type": "text/event-stream" })
          res.write(
            `data: ${JSON.stringify({ ...base, object: "chat.completion.chunk", choices: [{ index: 0, delta: { role: "assistant", content }, finish_reason: null }] })}\n\n`,
          )
          res.end(
            `data: ${JSON.stringify({ ...base, object: "chat.completion.chunk", choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`,
          )
        } else
          res.writeHead(200, { "content-type": "application/json" }).end(
            JSON.stringify({
              ...base,
              object: "chat.completion",
              choices: [
                { index: 0, message: { role: "assistant", content }, finish_reason: "stop" },
              ],
              usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
            }),
          )
      } catch (error) {
        result.errors.push({ phase, source: "localhost-stub", error: error.message })
        res.writeHead(400).end("invalid controlled request")
      }
      return
    }
    res.writeHead(404).end("fixture document is supplied only by browser route.fulfill")
  })
  await new Promise((done) => server.listen(0, "127.0.0.1", done))
  origin = `http://127.0.0.1:${server.address().port}`
}
async function updateConfig(patch) {
  await popup.evaluate(async (changes) => {
    const { config } = await chrome.storage.local.get("config")
    function merge(base, configPatch) {
      for (const [key, value] of Object.entries(configPatch)) {
        if (key === "providersConfig")
          base[key] = [
            ...base[key].filter((entry) => !value.some((next) => next.id === entry.id)),
            ...value,
          ]
        else
          base[key] =
            value && typeof value === "object" && !Array.isArray(value)
              ? merge(base[key] ?? {}, value)
              : value
      }
      return base
    }
    await chrome.storage.local.set({ config: merge(config, changes) })
  }, patch)
  await sleep(400)
}
async function validateConfig(chunks) {
  const validation = await popup.evaluate(
    async ({ chunks: schemaChunks, expectedId }) => {
      const { config } = await chrome.storage.local.get("config")
      for (const path of schemaChunks) {
        const module = await import(chrome.runtime.getURL(path))
        for (const [name, exported] of Object.entries(module)) {
          if (
            !exported?.safeParse ||
            !exported.shape?.pageTranslation ||
            !exported.shape?.providersConfig ||
            !exported.shape?.siteControl
          )
            continue
          const parsed = exported.safeParse(config)
          return {
            chunk: path,
            export: name,
            success: parsed.success,
            issues: parsed.success ? [] : parsed.error.issues,
            retainedControlledProvider:
              parsed.success && parsed.data.pageTranslation.providerId === expectedId,
            providerCount: config.providersConfig.length,
            controlledProviderCount: config.providersConfig.filter((p) => p.id === expectedId)
              .length,
          }
        }
      }
      throw new Error("Built configSchema not found")
    },
    { chunks, expectedId: providerId },
  )
  result.configValidations.push({ phase, ...validation })
  flush()
  assert.ok(validation.success && validation.retainedControlledProvider, JSON.stringify(validation))
}
async function tabId(page) {
  return popup.evaluate(
    async (url) => (await chrome.tabs.query({})).find((tab) => tab.url === url)?.id,
    page.url(),
  )
}
async function runtime(type, data) {
  return popup.evaluate(
    async ({ type: runtimeType, data: payload }) => {
      const at = Date.now()
      const response = await chrome.runtime.sendMessage({
        id: at,
        type: runtimeType,
        data: payload,
        timestamp: at,
      })
      if (response?.err) throw new Error(response.err.message)
      return response?.res ?? response
    },
    { type, data },
  )
}
async function toggle(page, enabled) {
  return runtime("tryToSetEnablePageTranslationByTabId", { tabId: await tabId(page), enabled })
}
async function observedExtraction(page, install = false) {
  return popup.evaluate(
    async ({ id, install: installObservation }) => {
      return (
        await chrome.scripting.executeScript({
          target: { tabId: id },
          world: "ISOLATED",
          func: (enableObservation) => {
            if (enableObservation && !globalThis.__siteExtrasObservations) {
              const observations = (globalThis.__siteExtrasObservations = {
                snapshots: [],
                parses: [],
                flattenedTables: [],
                bodyReads: [],
              })
              // oxlint-disable-next-line typescript/unbound-method -- preserved native method is invoked with apply(this) below
              const originalCreate = DOMImplementation.prototype.createHTMLDocument
              DOMImplementation.prototype.createHTMLDocument = function (...args) {
                const start = performance.now()
                const value = originalCreate.apply(this, args)
                observations.snapshots.push({ at: start, durationMs: performance.now() - start })
                return value
              }
              // oxlint-disable-next-line typescript/unbound-method -- preserved native method is invoked with apply(this) below
              const originalParse = DOMParser.prototype.parseFromString
              DOMParser.prototype.parseFromString = function (...args) {
                const start = performance.now()
                const value = originalParse.apply(this, args)
                observations.parses.push({
                  at: start,
                  durationMs: performance.now() - start,
                  inputCharacters: args[0].length,
                  textCharacters: value.body?.textContent?.length,
                  tables: value.querySelectorAll("table").length,
                  nestedTables: value.querySelectorAll("table table").length,
                })
                return value
              }
              // oxlint-disable-next-line typescript/unbound-method -- preserved native method is invoked with apply(this) below
              const originalReplace = Element.prototype.replaceWith
              Element.prototype.replaceWith = function (...args) {
                if (this.localName === "table" && this.parentElement?.closest("table"))
                  observations.flattenedTables.push({
                    at: performance.now(),
                    descendants: this.querySelectorAll("table").length,
                  })
                return originalReplace.apply(this, args)
              }
              const inner = Object.getOwnPropertyDescriptor(Element.prototype, "innerHTML")
              Object.defineProperty(Element.prototype, "innerHTML", {
                ...inner,
                get() {
                  const value = inner.get.call(this)
                  if (this.localName === "body" && this.ownerDocument !== document)
                    observations.bodyReads.push({
                      at: performance.now(),
                      htmlCharacters: value.length,
                      textCharacters: this.textContent.length,
                      tables: this.querySelectorAll("table").length,
                      nestedTables: this.querySelectorAll("table table").length,
                    })
                  return value
                },
              })
            }
            return {
              ...globalThis.__siteExtrasObservations,
              title: document.title,
              appliedTitle: window.__READ_FROG_TRANSLATED_DOCUMENT_TITLE__ ?? null,
              now: performance.now(),
            }
          },
          args: [installObservation],
        })
      )[0].result
    },
    { id: await tabId(page), install },
  )
}
async function selectAndRun(page, chunks) {
  await page.locator("#select-me").scrollIntoViewIfNeeded()
  await page.locator("#select-me").click({ clickCount: 3 })
  const selected = await page.evaluate(() => getSelection()?.toString())
  assert.ok(
    selected.includes("Selected public sentence"),
    "Actual selection must be the public sentence",
  )
  await validateConfig(chunks)
  const before = result.requests.length
  const start = Date.now()
  await page.getByRole("button", { name: actionName, exact: true }).first().click()
  const request = await wait(
    () =>
      result.requests
        .slice(before)
        .find((r) => r.system.includes("CONTROLLED_LONG_CONTEXT_ACTION")),
    "explicit custom action reaches real background/provider",
  )
  await page
    .getByText("received", { exact: true })
    .first()
    .waitFor({ state: "visible", timeout: 30000 })
  const fields = Object.fromEntries(
    [...request.input.matchAll(/<([A-Za-z]+)>([\s\S]*?)<\/\1>/g)].map((m) => [m[1], m[2]]),
  )
  assert.equal(fields.webTitle, originalTitle)
  assert.ok(fields.webContent.length > 0 && fields.webContent.length <= 2000)
  assert.ok(
    fields.webContent.replaceAll("\\", "").includes("NESTED_TABLE_CANARY"),
    "Nested table must survive into actual final context",
  )
  assert.ok(
    !fields.webContent.includes("Long article section 1799"),
    "Tail must not reach bounded context",
  )
  assert.ok(
    !request.input.includes("{{webContent}}"),
    "Known variable must resolve in actual payload",
  )
  return {
    selected,
    fields,
    promptBodySha256: request.bodySha256,
    clickToProviderMs: request.at - start,
    clickToVisibleResultMs: Date.now() - start,
  }
}

try {
  assert.ok(existsSync(join(artifact, "manifest.json")))
  const tree = digestTree(artifact)
  const manifest = JSON.parse(readFileSync(join(artifact, "manifest.json"), "utf8"))
  const chunks = tree.files
    .filter(
      (file) =>
        file.path.startsWith("chunks/") &&
        file.path.endsWith(".js") &&
        readFileSync(join(artifact, file.path), "utf8").includes("Note suggestion action"),
    )
    .map((file) => file.path)
  const candidate = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: repo,
    encoding: "utf8",
  }).trim()
  assert.equal(
    candidate,
    "5ac5122a6a4d390b3131f917dd09aa2caf5f5342",
    "Candidate must remain frozen",
  )
  result.identity = {
    candidateSha: candidate,
    runnerSha256: sha256(readFileSync(fileURLToPath(import.meta.url))),
    targetSha: "55bcef1e684fb4e70f4dce3063e7bd3066f46891",
    artifactPath: artifact,
    buildEdition: "domestic",
    buildEnvironment: "production",
    manifest: {
      name: manifest.name,
      version: manifest.version,
      versionName: manifest.version_name,
    },
    manifestSha256: sha256(readFileSync(join(artifact, "manifest.json"))),
    artifact: tree,
    browserExecutable: chromium.executablePath(),
    playwrightVersion: JSON.parse(
      readFileSync(
        "/Users/yisen/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json",
        "utf8",
      ),
    ).version,
    freshProfile: true,
    account: "none; no real account or commercial provider",
    modelTransport: "controlled localhost OpenAI-compatible stub; default provider rows retained",
  }
  await startServer()
  profile = mkdtempSync(join(tmpdir(), "translatebuff-site-extras-"))
  context = await chromium.launchPersistentContext(profile, {
    executablePath: chromium.executablePath(),
    headless: false,
    ignoreDefaultArgs: ["--disable-extensions"],
    viewport: { width: 1440, height: 1000 },
    args: [
      "--no-first-run",
      "--no-default-browser-check",
      `--disable-extensions-except=${artifact}`,
      `--load-extension=${artifact}`,
    ],
  })
  result.identity.browserVersion = context.browser().version()
  context.on("request", (request) => {
    let frameUrl, workerUrl
    try {
      frameUrl = request.frame()?.url()
    } catch {}
    try {
      workerUrl = request.serviceWorker()?.url()
    } catch {}
    result.network.push({
      phase,
      url: safeUrl(request.url()),
      method: request.method(),
      context: workerUrl
        ? "service-worker"
        : frameUrl?.startsWith("chrome-extension:")
          ? "extension-page"
          : "page-or-content-script-unresolved",
      contextUrl: safeUrl(workerUrl ?? frameUrl ?? ""),
    })
  })
  context.on("page", (page) =>
    page.on("pageerror", (error) =>
      result.errors.push({ phase, source: safeUrl(page.url()), error: error.message }),
    ),
  )
  const worker =
    context
      .serviceWorkers()
      .find((candidateWorker) => candidateWorker.url().startsWith("chrome-extension:")) ??
    (await context.waitForEvent("serviceworker", { timeout: 30000 }))
  extensionId = new URL(worker.url()).hostname
  result.identity.extensionId = extensionId
  result.identity.workerUrl = safeUrl(worker.url())
  popup = await context.newPage()
  await popup.goto(`chrome-extension://${extensionId}/popup.html`)
  await wait(
    () =>
      popup.evaluate(async () => {
        const { config } = await chrome.storage.local.get("config")
        return (
          config?.pageTranslation &&
          config?.selectionToolbar &&
          Array.isArray(config?.providersConfig)
        )
      }),
    "fresh default config",
  )
  result.identity.defaultProviderCount = await popup.evaluate(
    async () => (await chrome.storage.local.get("config")).config.providersConfig.length,
  )
  await updateConfig({
    language: { sourceCode: "eng", targetCode: "cmn" },
    providersConfig: [
      {
        id: providerId,
        name: "Controlled localhost site extras",
        enabled: true,
        provider: "openai-compatible",
        baseURL: `${origin}/api/rpc`,
        apiKey: "controlled-local-only",
        model: {
          model: "use-custom-model",
          isCustomModel: true,
          customModel: "controlled-fixture-model",
        },
        temperature: 0,
      },
    ],
    pageTranslation: {
      providerId,
      mode: "bilingual",
      enableAIContentAware: false,
      page: {
        range: "all",
        translateTitle: true,
        minCharactersPerNode: 0,
        minWordsPerNode: 0,
        enableTargetLanguageSkip: false,
        autoTranslatePatterns: [],
        neverAutoTranslatePatterns: [],
        autoTranslateLanguages: [],
      },
      requestQueueConfig: { capacity: 4, rate: 10 },
      batchQueueConfig: { maxItemsPerBatch: 8, maxCharactersPerBatch: 3000 },
    },
    selectionToolbar: {
      enabled: true,
      features: { translate: { enabled: true, providerId } },
      noteSuggestion: { enabled: false },
      customActions: [
        {
          id: "controlled-long-context-action",
          name: actionName,
          enabled: true,
          icon: "tabler:flask",
          providerId,
          systemPrompt:
            "CONTROLLED_LONG_CONTEXT_ACTION. Return valid JSON for required output schema.",
          prompt:
            "<selection>{{selection}}</selection>\n<paragraphs>{{paragraphs}}</paragraphs>\n<webTitle>{{webTitle}}</webTitle>\n<webUrl>{{webUrl}}</webUrl>\n<webContent>{{webContent}}</webContent>",
          outputSchema: [
            {
              id: "context-proof",
              name: "contextProof",
              type: "string",
              description: "Controlled context acknowledgement",
            },
          ],
        },
      ],
    },
    inputTranslation: { providerId },
    videoSubtitles: { providerId, autoStart: false },
    siteControl: { mode: "blacklist", blacklistPatterns: [] },
  })
  await validateConfig(chunks)

  await runCase("P02-long-page-nested-table-context", async () => {
    const html = longPage()
    const page = (activePage = await context.newPage())
    await page.route(articleUrl, (route) =>
      route.fulfill({ status: 200, contentType: "text/html", body: html }),
    )
    await page.goto(articleUrl, { waitUntil: "domcontentloaded" })
    await sleep(1000)
    const source = await page.evaluate(() => ({
      url: location.href,
      title: document.title,
      description: document.querySelector('meta[name="description"]')?.content,
      htmlCharacters: document.documentElement.outerHTML.length,
      textCharacters: document.body.textContent.length,
      paragraphs: document.querySelectorAll("article p").length,
      tables: document.querySelectorAll("table").length,
      nestedTables: document.querySelectorAll("table table").length,
    }))
    assert.equal(source.nestedTables, 35)
    const before = await observedExtraction(page, true)
    const first = await selectAndRun(page, chunks)
    const firstObservations = await observedExtraction(page)
    result.p02Diagnostics = { source, before, first, firstObservations }
    flush()
    const firstScreenshot = await screenshot(page, "P02-first-explicit-ai-action")
    assert.equal(
      first.fields.webContent.length,
      2000,
      "Long body should hit existing 2000 character cap",
    )
    assert.ok(
      firstObservations.snapshots.length > before.snapshots.length,
      "Action must trigger real webpage extraction",
    )
    assert.ok(
      firstObservations.flattenedTables.length > 0,
      "Real parser path must flatten nested tables",
    )
    assert.ok(
      firstObservations.bodyReads.some(
        (read) =>
          read.nestedTables === 0 &&
          read.textCharacters <= 2400 &&
          read.htmlCharacters < source.htmlCharacters / 100,
      ),
      "Detached body sent to Markdown must be strongly bounded with no nested tables; whole text-node boundary may slightly overshoot 2000 before final exact cap",
    )
    await page.keyboard.press("Escape")
    await page.mouse.click(1100, 80)
    await toggle(page, true)
    await wait(
      () => page.title().then((title) => title.includes("受控译文")),
      "actual host title translation",
      30000,
    )
    const titleAfterTranslation = await observedExtraction(page)
    assert.equal(titleAfterTranslation.appliedTitle?.source, originalTitle)
    assert.equal(titleAfterTranslation.appliedTitle?.translated, titleAfterTranslation.title)
    // The marker was written by the actual host title translator, never seeded by this harness.
    await page.evaluate(() => {
      location.hash = "section-anchor"
    })
    const second = await selectAndRun(page, chunks)
    const afterAnchor = await observedExtraction(page)
    result.p02CacheDiagnostics = { titleAfterTranslation, second, afterAnchor }
    flush()
    assert.equal(
      second.fields.webContent,
      first.fields.webContent,
      "Anchor/title display changes must reuse source context",
    )
    assert.equal(second.fields.webTitle, originalTitle)
    assert.equal(
      afterAnchor.snapshots.length,
      titleAfterTranslation.snapshots.length,
      "No fresh selection snapshot extraction after same-page anchor/title display change (host initial activation has its own extraction)",
    )
    const secondScreenshot = await screenshot(page, "P02-real-title-anchor-context-cache")
    await toggle(page, false)
    await page.close()
    activePage = null
    return {
      source,
      first,
      before,
      firstObservations,
      titleAfterTranslation,
      second,
      afterAnchor,
      screenshots: [firstScreenshot, secondScreenshot],
      timingInterpretation:
        "Click-to-provider includes extraction and real custom action startup. DOMParser durations are directly observed. No hardware-independent latency SLA is claimed.",
      boundaries:
        "Custom action supports webTitle/webUrl/webContent/paragraphs. webDescription has no custom-action token and is not invented or claimed captured here. Source description recorded from controlled fixture only.",
    }
  })

  await runCase("P06-google-citation-card", async () => {
    const page = (activePage = await context.newPage())
    await page.route("https://www.google.com/search?*", (route) =>
      route.fulfill({ status: 200, contentType: "text/html", body: googlePage() }),
    )
    await page.goto(googleUrl, { waitUntil: "domcontentloaded" })
    await sleep(800)
    await page.locator("#open-card").click()
    const inspect = () =>
      page.evaluate((wrapperSelector) => {
        function box(selector) {
          const element = document.querySelector(selector),
            style = getComputedStyle(element),
            rect = element.getBoundingClientRect()
          return {
            text: element.textContent,
            height: rect.height,
            top: rect.top,
            bottom: rect.bottom,
            clientHeight: element.clientHeight,
            scrollHeight: element.scrollHeight,
            scrollTop: element.scrollTop,
            overflowY: style.overflowY,
            maxHeight: style.maxHeight,
            lineClamp: style.webkitLineClamp,
            translatedWrappers: element.querySelectorAll(wrapperSelector).length,
          }
        }
        const snippet = document.querySelector("#source-snippet")
        return {
          url: location.href,
          selectorMatchCount: document.querySelectorAll(
            `[role=dialog][data-skip-highlighting] :has(${wrapperSelector})`,
          ).length,
          snippet: box("#source-snippet"),
          inner: box("#inner-scroll"),
          outside: box("#outside-control"),
          visibleTranslatedText:
            !!snippet.querySelector(wrapperSelector) &&
            getComputedStyle(snippet).visibility === "visible",
          injectedRulePresent: [
            ...[...document.querySelectorAll("style")].map((style) => style.textContent),
            ...document.adoptedStyleSheets.flatMap((sheet) =>
              [...sheet.cssRules].map((rule) => rule.cssText),
            ),
          ].some(
            (cssText) =>
              cssText.includes('[role="dialog"][data-skip-highlighting]') ||
              cssText.includes("[role=dialog][data-skip-highlighting]"),
          ),
        }
      }, wrapper)
    const before = await inspect()
    const beforeScreenshot = await screenshot(page, "P06-card-original")
    assert.equal(before.snippet.lineClamp, "2")
    assert.equal(before.snippet.maxHeight, "54px")
    await validateConfig(chunks)
    const requestStart = result.requests.length
    await toggle(page, true)
    await page
      .locator(`#source-snippet ${wrapper}`)
      .filter({ hasText: "卡片末端可见标记" })
      .first()
      .waitFor({ state: "visible", timeout: 30000 })
    await sleep(500)
    const after = await inspect()
    result.p06Diagnostics = { before, after }
    flush()
    assert.equal(new URL(after.url).hostname, "www.google.com")
    assert.ok(
      after.injectedRulePresent && after.selectorMatchCount > 0,
      "Actual Google built-in CSS must be injected",
    )
    assert.ok(
      ["none", "unset"].includes(after.snippet.lineClamp),
      `Unexpected clamp ${after.snippet.lineClamp}`,
    )
    assert.equal(after.snippet.maxHeight, "none")
    assert.ok(
      after.snippet.height > 54,
      "Long actual translation expands past original clipping height",
    )
    assert.equal(after.inner.overflowY, "auto")
    assert.ok(
      after.inner.scrollHeight > after.inner.clientHeight + 100,
      "Card retains internal scroll range",
    )
    assert.equal(after.outside.overflowY, before.outside.overflowY)
    assert.equal(after.outside.maxHeight, before.outside.maxHeight)
    assert.equal(after.outside.height, before.outside.height)
    const expandedScreenshot = await screenshot(page, "P06-card-long-translation-top")
    await page.locator("#inner-scroll").evaluate((element) => {
      element.scrollTop = element.scrollHeight
    })
    await sleep(200)
    const bottom = await inspect()
    assert.ok(bottom.inner.scrollTop > 0)
    const tailVisibility = await page.evaluate((wrapperSelector) => {
      const translated = document.querySelector(`#source-snippet ${wrapperSelector}`),
        scroller = document.querySelector("#inner-scroll")
      const walker = document.createTreeWalker(translated, NodeFilter.SHOW_TEXT)
      let tail, node
      while ((node = walker.nextNode()))
        if (node.textContent.includes("卡片末端可见标记")) tail = node
      const start = tail.textContent.lastIndexOf("卡片末端可见标记"),
        range = document.createRange()
      range.setStart(tail, start)
      range.setEnd(tail, start + "卡片末端可见标记".length)
      const rect = range.getBoundingClientRect(),
        container = scroller.getBoundingClientRect()
      return {
        marker: range.toString(),
        top: rect.top,
        bottom: rect.bottom,
        containerTop: container.top,
        containerBottom: container.bottom,
        visibleInsideScroller: rect.top >= container.top && rect.bottom <= container.bottom,
        visibleInsideViewport:
          rect.top >= 0 && rect.bottom <= innerHeight && rect.left >= 0 && rect.right <= innerWidth,
      }
    }, wrapper)
    assert.ok(
      tailVisibility.visibleInsideScroller && tailVisibility.visibleInsideViewport,
      "Final translated characters must be reachable by internal scroll",
    )
    const bottomScreenshot = await screenshot(page, "P06-card-long-translation-bottom")
    const requests = result.requests
      .slice(requestStart)
      .filter((r) => r.phase === phase)
      .map((r) => ({ url: r.url, method: r.method, bodySha256: r.bodySha256 }))
    await toggle(page, false)
    await page.close()
    activePage = null
    return {
      fixtureUrl: safeUrl(googleUrl),
      routeFulfill: true,
      exactRule:
        "[role=dialog][data-skip-highlighting] :has(.read-frog-translated-content-wrapper) {-webkit-line-clamp: unset!important;max-height: unset!important;}",
      before,
      after,
      bottom,
      tailVisibility,
      requests,
      screenshots: [beforeScreenshot, expandedScreenshot, bottomScreenshot],
      boundaries:
        "Exact built-in Google selector and actual host translation on a Google URL; controlled citation markup, not Google's live personalized AI Overview response.",
    }
  })
} catch (error) {
  result.fatal = String(error.stack ?? error)
} finally {
  if (context)
    await context
      .close()
      .catch((error) => result.errors.push({ source: "browser-cleanup", error: error.message }))
  if (server) await new Promise((done) => server.close(done))
  if (profile) rmSync(profile, { recursive: true, force: true })
  if (result.identity) {
    result.identity.artifactAfterTreeSha256 = digestTree(artifact).treeSha256
    result.identity.artifactUnchangedDuringRun =
      result.identity.artifactAfterTreeSha256 === result.identity.artifact.treeSha256
    if (!result.identity.artifactUnchangedDuringRun)
      result.fatal = "Built artifact changed during browser run"
  }
  result.completedAt = new Date().toISOString()
  result.cleanup = {
    browserClosed: true,
    serverClosed: true,
    freshProfileRemoved: profile ? !existsSync(profile) : null,
  }
  result.networkPolicy = {
    blocking: "none; no routes aborted or external hosts blocked",
    fixtureFulfillment: [safeUrl(articleUrl), safeUrl(googleUrl)],
    persistedFields:
      "URL without query/fragment, method and context only; no request headers, keys or account data",
  }
  result.limitations.push(
    "Chrome for Testing 151 only; no Edge installed or tested.",
    "Controlled localhost responses exercise real built extension execution; no real provider/account, model quality or billing acceptance.",
    "Third-party fixture responses are controlled; live site rollout and changing personalized markup remain outside this evidence.",
    "P02 webDescription has no public custom-action prompt token; no claim of final description-field transport from custom action.",
    "Network listener attaches immediately after owned browser launch; this is an unblocked in-run record, not a complete browser-startup netlog or full commercial-isolation verdict.",
    "P02 Markdown input is bounded at whole-node boundaries (observed 2182 text characters), then webContent is capped exactly at 2000. A strict pre-Markdown 2000-character guarantee is not claimed.",
  )
  flush()
  console.log(`Result: ${join(output, "result.json")}`)
  if (result.fatal || result.cases.some((item) => item.status === "FAIL")) process.exitCode = 1
}
