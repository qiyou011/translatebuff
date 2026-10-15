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
import { dirname, join, relative, resolve as resolvePath } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolvePath(here, "../../../../..")
const artifact = join(repo, ".output/chrome-mv3")
const runId = new Date().toISOString().replace(/:/g, "-")
const output = join(here, "runs", runId)
mkdirSync(output, { recursive: true })
const expectedTree = "2440c52300adfeed0fa087659a2a3dedbda2c614d0c2b7ba12f17654c1253906"
const playwrightPath =
  "/Users/yisen/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs"
const executablePath =
  "/Users/yisen/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"
const disabledMessage =
  "Upstream cloud services are disabled. Sign in to TranslateBuff or select an available model."
const providerId = "renyimiao-admission-browser-local"
const evidence = {
  runId,
  startedAt: new Date().toISOString(),
  cases: [],
  network: [],
  cdp: [],
  providerRequests: [],
  errors: [],
  limitations: [
    "Real Chrome for Testing 151 with a fresh owned profile. Controlled local transport is not proof of a real own-account gateway.",
    "Runtime-message/port and direct built-module calls are explicitly separate from user UI navigation. This is a bounded denied-capability subset, not full G4/G5 acceptance.",
    "No commercial API route blocking is used. Content traffic without an extension initiator remains page-or-unresolved.",
  ],
}
let context,
  server,
  profile,
  popup,
  extensionId,
  origin,
  browserCdp,
  phase = "startup"
const cdpTasks = new Set(),
  attachedTargets = new Set()
const hash = (value) => createHash("sha256").update(value).digest("hex")
const sleep = (ms) => new Promise((done) => setTimeout(done, ms))
function digest(root) {
  const files = []
  function walk(dir) {
    for (const name of readdirSync(dir).sort()) {
      const p = join(dir, name)
      if (statSync(p).isDirectory()) walk(p)
      else
        files.push({
          path: relative(root, p),
          bytes: statSync(p).size,
          sha256: hash(readFileSync(p)),
        })
    }
  }
  walk(root)
  return { treeSha256: hash(JSON.stringify(files)), files }
}
function safeUrl(raw) {
  try {
    const u = new URL(raw)
    return ["http:", "https:", "chrome-extension:"].includes(u.protocol)
      ? `${u.protocol}//${u.host}${u.pathname}`
      : u.protocol
  } catch {
    return "[unparseable]"
  }
}
function commercial(raw) {
  try {
    const u = new URL(raw)
    if (u.origin === origin && u.pathname === "/api/rpc/chat/completions") return false
    return (
      /^\/api\/(identity|rpc|blog)(\/|$)/.test(u.pathname) ||
      ((u.hostname === "readfrog.app" ||
        u.hostname.endsWith(".readfrog.app") ||
        u.hostname === "read-frog.com" ||
        u.hostname.endsWith(".read-frog.com")) &&
        /hosted|subscri|billing|purchase|notebase|transcri/i.test(u.pathname)) ||
      (/googleapis\.com$/.test(u.hostname) && u.pathname.includes("/drive/")) ||
      u.hostname === "oauth2.googleapis.com"
    )
  } catch {
    return false
  }
}
function flush() {
  writeFileSync(join(output, "partial-result.json"), JSON.stringify(evidence, null, 2) + "\n")
}
async function runCase(id, mode, fn) {
  phase = id
  const row = {
    id,
    mode,
    startedAt: new Date().toISOString(),
    providerRequestsBefore: evidence.providerRequests.length,
  }
  evidence.cases.push(row)
  flush()
  try {
    row.details = await fn()
    row.status = "PASS"
  } catch (e) {
    row.status = "FAIL"
    row.error = String(e.stack ?? e)
    process.exitCode = 1
    if (popup && !popup.isClosed())
      await popup.screenshot({ path: join(output, `${id}-failure.png`) }).catch(() => {})
  }
  row.providerRequestsAfter = evidence.providerRequests.length
  row.completedAt = new Date().toISOString()
  flush()
}
function track(p) {
  cdpTasks.add(p)
  p.catch((e) =>
    evidence.errors.push({ phase, source: "network-capture", error: e.message }),
  ).finally(() => cdpTasks.delete(p))
}
function recordCdp(p, target) {
  const frames = p.initiator?.stack?.callFrames ?? []
  evidence.cdp.push({
    phase,
    target,
    context:
      target.type === "service_worker"
        ? "service-worker"
        : target.url.startsWith("chrome-extension:")
          ? "extension-page"
          : frames.some((f) => f.url.startsWith("chrome-extension:"))
            ? "content-script"
            : "page-or-unresolved",
    url: safeUrl(p.request.url),
    method: p.request.method,
    resourceType: p.type,
    initiator: {
      type: p.initiator?.type,
      stack: frames.slice(0, 8).map((f) => ({
        functionName: f.functionName,
        url: safeUrl(f.url),
        lineNumber: f.lineNumber,
      })),
    },
    commercial: commercial(p.request.url),
  })
}
async function attachPage(page) {
  page.on("pageerror", (e) =>
    evidence.errors.push({ phase, source: safeUrl(page.url()), error: e.message }),
  )
  const session = await context.newCDPSession(page)
  session.on("Network.requestWillBeSent", (p) =>
    recordCdp(p, { type: "page", url: safeUrl(page.url()) }),
  )
  await session.send("Network.enable")
}
async function attachWorker(target) {
  if (
    target.type !== "service_worker" ||
    !target.url.startsWith("chrome-extension:") ||
    attachedTargets.has(target.targetId)
  )
    return
  attachedTargets.add(target.targetId)
  const { sessionId } = await browserCdp.send("Target.attachToTarget", {
    targetId: target.targetId,
    flatten: false,
  })
  browserCdp.on("Target.receivedMessageFromTarget", (message) => {
    if (message.sessionId !== sessionId) return
    const event = JSON.parse(message.message)
    if (event.method === "Network.requestWillBeSent")
      recordCdp(event.params, {
        type: target.type,
        url: safeUrl(target.url),
        targetId: target.targetId,
      })
  })
  await browserCdp.send("Target.sendMessageToTarget", {
    sessionId,
    message: JSON.stringify({ id: 1, method: "Network.enable" }),
  })
}
async function sendRuntimeMessage(runtimeType, payloadData) {
  const response = await popup.evaluate(
    async ({ type, data }) => {
      const now = Date.now()
      return chrome.runtime.sendMessage({ id: now, type, data, timestamp: now })
    },
    { type: runtimeType, data: payloadData },
  )
  evidence.runtimeCalls ??= []
  evidence.runtimeCalls.push({
    phase,
    transport: "message",
    type: runtimeType,
    data: payloadData,
    response,
  })
  flush()
  return response
}
async function port(portName, portPayload) {
  const response = await popup.evaluate(
    ({ name, payload }) =>
      new Promise((resolve) => {
        const p = chrome.runtime.connect({ name })
        const messages = []
        const started = performance.now()
        let done = false
        function finish(reason) {
          if (done) return
          done = true
          clearTimeout(timer)
          try {
            p.disconnect()
          } catch {}
          resolve({ reason, elapsedMs: performance.now() - started, messages })
        }
        const timer = setTimeout(() => finish("timeout"), 8000)
        p.onMessage.addListener((m) => {
          messages.push(m)
          if (["done", "error"].includes(m.type)) finish(m.type)
        })
        p.onDisconnect.addListener(() => finish("disconnect"))
        p.postMessage({ type: "start", streamRequestId: `admission-${Date.now()}`, payload })
      }),
    { name: portName, payload: portPayload },
  )
  evidence.runtimeCalls ??= []
  evidence.runtimeCalls.push({
    phase,
    transport: "port",
    name: portName,
    payload: portPayload,
    response,
  })
  flush()
  return response
}
function unwrap(response) {
  if (response?.err) throw new Error(response.err.message)
  return response && Object.hasOwn(response, "res") ? response.res : response
}
async function denyPort(name, payload) {
  const result = await port(name, payload)
  assert.equal(result.reason, "error")
  assert.equal(result.messages.length, 1)
  assert.match(result.messages[0].error.message, /Upstream cloud services are disabled/)
  assert.ok(result.elapsedMs < 5000)
  return {
    ...result,
    transportNote:
      "Port protocol carries message/action/reason only; code and isRetryable are verified separately by actual built serializeProviderRef export.",
  }
}
async function screenshot(page, name) {
  await page.screenshot({ path: join(output, `${name}.png`), fullPage: true })
  return `${name}.png`
}

try {
  const built = digest(artifact)
  assert.equal(built.treeSha256, expectedTree)
  const manifest = JSON.parse(readFileSync(join(artifact, "manifest.json"), "utf8"))
  const providerChunk = built.files.find(
    (f) =>
      f.path.startsWith("chunks/provider-ref-") &&
      f.path.endsWith(".js") &&
      readFileSync(join(artifact, f.path), "utf8").includes("async function l(e,i)"),
  )
  assert.ok(providerChunk, "Exact built provider-ref module must be found")
  const providerSource = readFileSync(join(artifact, providerChunk.path), "utf8")
  assert.ok(
    providerSource.includes(
      "async function l(e,i){if(e.kind===`local`)return{kind:`local`,config:e.config}",
    ),
  )
  assert.ok(providerSource.endsWith("export{a,s as i,i as n,o as r,l as t};"))
  evidence.identity = {
    candidateSha: execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: repo,
      encoding: "utf8",
    }).trim(),
    targetSha: "55bcef1e684fb4e70f4dce3063e7bd3066f46891",
    artifactPath: artifact,
    artifact: built,
    manifest,
    manifestSha256: hash(readFileSync(join(artifact, "manifest.json"))),
    browserExecutable: executablePath,
    providerModule: {
      ...providerChunk,
      sourceFunction: "serializeProviderRef",
      minifiedLocal: "l",
      exportName: "t",
      mappingProof: providerSource,
    },
    freshOwnedProfile: true,
  }
  const { chromium } = await import(pathToFileURL(playwrightPath).href)
  evidence.identity.playwrightVersion = JSON.parse(
    readFileSync(join(dirname(playwrightPath), "package.json"), "utf8"),
  ).version
  server = createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*")
    res.setHeader("Access-Control-Allow-Headers", "*")
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    if (req.method === "OPTIONS") {
      res.writeHead(204).end()
      return
    }
    if (req.method === "POST" && req.url.startsWith("/api/rpc/")) {
      const chunks = []
      for await (const c of req) chunks.push(c)
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8"))
      const input = (body.messages ?? [])
        .filter((m) => m.role === "user")
        .map((m) => (typeof m.content === "string" ? m.content : JSON.stringify(m.content)))
        .join("\n")
      const jsonStart = input.indexOf('{"t0"')
      let content
      if (jsonStart >= 0)
        content = JSON.stringify(
          Object.fromEntries(
            Object.entries(JSON.parse(input.slice(jsonStart).trim())).map(([k, v]) => [
              k,
              `受控准入译文：${v}`,
            ]),
          ),
        )
      else content = "受控准入译文：" + input
      evidence.providerRequests.push({
        phase,
        method: req.method,
        path: req.url,
        model: body.model,
        stream: body.stream,
        bodySha256: hash(JSON.stringify(body)),
        input,
        content,
      })
      flush()
      const base = {
        id: `chatcmpl-${randomUUID()}`,
        created: Math.floor(Date.now() / 1000),
        model: body.model,
      }
      if (body.stream) {
        res.setHeader("Content-Type", "text/event-stream")
        res.end(
          `data: ${JSON.stringify({ ...base, object: "chat.completion.chunk", choices: [{ index: 0, delta: { role: "assistant", content }, finish_reason: null }] })}\n\ndata: ${JSON.stringify({ ...base, object: "chat.completion.chunk", choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`,
        )
      } else {
        res.setHeader("Content-Type", "application/json")
        res.end(
          JSON.stringify({
            ...base,
            object: "chat.completion",
            choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
          }),
        )
      }
      return
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8")
    res.end(
      '<!doctype html><html lang="en"><title>Admission controlled fixture</title><body><article><p id="positive">The working local provider must translate this complete paragraph after the denied capability checks.</p></article></body></html>',
    )
  })
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
  origin = `http://127.0.0.1:${server.address().port}`
  profile = mkdtempSync(join(tmpdir(), "translatebuff-admission-"))
  context = await chromium.launchPersistentContext(profile, {
    executablePath,
    headless: false,
    ignoreDefaultArgs: ["--disable-extensions"],
    viewport: { width: 1440, height: 1000 },
    args: [
      "--no-first-run",
      "--no-default-browser-check",
      `--disable-extensions-except=${artifact}`,
      `--load-extension=${artifact}`,
      `--log-net-log=${join(profile, "netlog.json")}`,
      "--net-log-capture-mode=Default",
    ],
  })
  evidence.identity.browserVersion = context.browser().version()
  context.on("request", (r) => {
    let frame, worker
    try {
      frame = r.frame()?.url()
    } catch {}
    try {
      worker = r.serviceWorker()?.url()
    } catch {}
    evidence.network.push({
      phase,
      url: safeUrl(r.url()),
      method: r.method(),
      context: worker
        ? "service-worker"
        : frame?.startsWith("chrome-extension:")
          ? "extension-page"
          : "content-page-or-content-script",
      commercial: commercial(r.url()),
    })
  })
  context.on("page", (p) => track(attachPage(p)))
  for (const p of context.pages()) track(attachPage(p))
  browserCdp = await context.browser().newBrowserCDPSession()
  browserCdp.on("Target.targetCreated", ({ targetInfo }) => track(attachWorker(targetInfo)))
  await browserCdp.send("Target.setDiscoverTargets", { discover: true })
  for (const t of (await browserCdp.send("Target.getTargets")).targetInfos) track(attachWorker(t))
  await Promise.allSettled([...cdpTasks])
  const worker =
    context.serviceWorkers().find((w) => w.url().startsWith("chrome-extension:")) ??
    (await context.waitForEvent("serviceworker", { timeout: 30000 }))
  extensionId = new URL(worker.url()).hostname
  evidence.identity.extensionId = extensionId
  popup = await context.newPage()
  await popup.goto(`chrome-extension://${extensionId}/popup.html`)
  const configDeadline = Date.now() + 30000
  while (
    !(await popup.evaluate(async () =>
      Boolean((await chrome.storage.local.get("config")).config?.selectionToolbar?.builtInActions),
    ))
  ) {
    assert.ok(Date.now() < configDeadline, "Fresh-install config did not initialize")
    await sleep(100)
  }
  evidence.freshConfig = await popup.evaluate(async () => {
    const { config } = await chrome.storage.local.get("config")
    return {
      builtInActions: config.selectionToolbar.builtInActions,
      providerIds: config.providersConfig.map((p) => ({
        id: p.id,
        enabled: p.enabled,
        apiKeyPresent: Boolean(p.apiKey),
      })),
    }
  })

  await runCase("G5-serialize-system-nonretry", "direct-built-public-module", async () => {
    const results = await popup.evaluate(
      async ({ chunkPath }) => {
        const module = await import(chrome.runtime.getURL(chunkPath))
        const rows = []
        for (const id of ["read-frog-free-ai", "read-frog-advance-ai"]) {
          try {
            rows.push({
              id,
              result: await module.t(
                {
                  kind: "system",
                  id,
                  name: id,
                  modelTier: id === "read-frog-free-ai" ? "normal" : "advance",
                },
                "pageTranslation",
              ),
            })
          } catch (e) {
            rows.push({
              id,
              error: { name: e.name, message: e.message, code: e.code, isRetryable: e.isRetryable },
            })
          }
        }
        return { actualFunctionSource: module.t.toString(), rows }
      },
      { chunkPath: providerChunk.path },
    )
    for (const row of results.rows) {
      assert.equal(row.error?.code, "UPSTREAM_CLOUD_DISABLED")
      assert.equal(row.error.isRetryable, false)
      assert.equal(row.error.message, disabledMessage)
    }
    assert.equal(evidence.providerRequests.length, 0)
    return results
  })
  const systemRef = {
    kind: "system",
    providerId: "read-frog-free-ai",
    modelTier: "normal",
    modelRevision: "admission-test",
  }
  const videoPayload = {
    transcript: "Controlled transcript",
    targetLanguage: "cmn",
    providerRef: systemRef,
  }
  await runCase("G5-video-cache-and-save-runtime", "real-runtime-message", async () => {
    const cached = await sendRuntimeMessage("getCachedVideoSummary", videoPayload)
    const saved = await sendRuntimeMessage("saveVideoSummary", {
      ...videoPayload,
      summary: "Controlled summary must not be saved",
    })
    assert.equal(unwrap(cached), null)
    assert.ok(saved.err)
    assert.equal(saved.err.message, disabledMessage)
    assert.equal(saved.err.code, "UPSTREAM_CLOUD_DISABLED")
    assert.equal(saved.err.isRetryable, false)
    return {
      cached,
      saved,
      note: "Cache read deliberately returns null; save explicitly rejects with code and non-retry metadata instead of falsely succeeding.",
    }
  })
  for (const actionId of ["default-sentence-analysis", "default-improve-writing"])
    await runCase(`G5-denied-${actionId}`, "real-runtime-port", async () =>
      denyPort("stream-structured-object", {
        providerId: "read-frog-free-ai",
        actionId,
        prompt: "Controlled blocked action",
        outputSchema: [{ name: "result", type: "string" }],
      }),
    )
  await runCase("G5-note-suggestion-runtime", "real-runtime-port", async () =>
    denyPort("stream-note-suggestion", {
      providerId: "read-frog-free-ai",
      prompt: "Controlled blocked note suggestion",
    }),
  )
  await runCase("G5-old-system-stream-runtime", "real-runtime-port", async () =>
    denyPort("stream-text", {
      providerKind: "system",
      providerId: "read-frog-free-ai",
      hostedFeature: "pageTranslation",
      instructions: "Translate to Chinese",
      prompt: "Controlled old system request",
    }),
  )
  await runCase("G5-old-system-generate-runtime", "real-runtime-message", async () => {
    const response = await sendRuntimeMessage("backgroundGenerateText", {
      providerRef: systemRef,
      hostedFeature: "pageTranslation",
      instructions: "Translate to Chinese",
      prompt: "Controlled old system generation",
    })
    assert.ok(response.err)
    assert.equal(response.err.message, disabledMessage)
    assert.equal(response.err.code, "UPSTREAM_CLOUD_DISABLED")
    assert.equal(response.err.isRetryable, false)
    return { response }
  })

  // A valid local provider exists before checking forbidden actions. This proves they cannot borrow it.
  const localProvider = {
    id: providerId,
    name: "Controlled admission local provider",
    enabled: true,
    provider: "openai-compatible",
    baseURL: `${origin}/api/rpc`,
    apiKey: "admission-browser-local-only",
    model: {
      model: "use-custom-model",
      isCustomModel: true,
      customModel: "controlled-fixture-model",
    },
    temperature: 0,
  }
  await popup.evaluate(
    async ({ provider }) => {
      const { config } = await chrome.storage.local.get("config")
      config.providersConfig.push(provider)
      config.language.sourceCode = "eng"
      config.language.targetCode = "cmn"
      config.pageTranslation.providerId = provider.id
      config.pageTranslation.enableAIContentAware = false
      config.pageTranslation.page.range = "all"
      config.pageTranslation.page.minCharactersPerNode = 0
      config.pageTranslation.page.minWordsPerNode = 0
      config.pageTranslation.page.enableTargetLanguageSkip = false
      config.pageTranslation.page.autoTranslatePatterns = []
      config.pageTranslation.page.neverAutoTranslatePatterns = []
      config.selectionToolbar.builtInActions.sentenceAnalysis.enabled = true
      config.selectionToolbar.builtInActions.improveWriting.enabled = true
      await chrome.storage.local.set({ config })
    },
    { provider: localProvider },
  )
  const schemaPaths = built.files
    .filter(
      (f) =>
        f.path.startsWith("chunks/") &&
        f.path.endsWith(".js") &&
        readFileSync(join(artifact, f.path), "utf8").includes("Note suggestion action"),
    )
    .map((f) => f.path)
  evidence.seedValidation = await popup.evaluate(async (paths) => {
    const { config } = await chrome.storage.local.get("config")
    for (const path of paths) {
      const module = await import(chrome.runtime.getURL(path))
      for (const [name, exp] of Object.entries(module)) {
        if (exp?.safeParse && exp.shape?.pageTranslation && exp.shape?.providersConfig) {
          const parsed = exp.safeParse(config)
          return {
            path,
            exportName: name,
            success: parsed.success,
            issues: parsed.success ? [] : parsed.error.issues,
          }
        }
      }
    }
    throw new Error("Exact build schema not found")
  }, schemaPaths)
  assert.equal(
    evidence.seedValidation.success,
    true,
    JSON.stringify(evidence.seedValidation.issues),
  )
  await runCase("G5-denied-action-with-working-local-provider", "real-runtime-port", async () => {
    const before = evidence.providerRequests.length
    const result = await denyPort("stream-structured-object", {
      providerId,
      actionId: "default-sentence-analysis",
      prompt: "Must not borrow paid provider",
      outputSchema: [{ name: "result", type: "string" }],
    })
    assert.equal(evidence.providerRequests.length, before)
    return result
  })

  await runCase("G4-options-denied-deep-links", "real-options-UI-navigation", async () => {
    const options = await context.newPage()
    const rows = []
    for (const [name, route] of [
      ["drive", "/preference?section=google-drive-sync"],
      [
        "notebase",
        "/custom-actions?actionId=default-dictionary&tab=notebase&section=custom-actions-notebase",
      ],
      ["sentence", "/custom-actions?actionId=default-sentence-analysis"],
      ["writing", "/custom-actions?actionId=default-improve-writing"],
    ]) {
      await options.goto(`chrome-extension://${extensionId}/options.html#${route}`)
      await options.waitForTimeout(1200)
      const state = await options.evaluate(() => ({
        url: location.href,
        text: document.body.innerText,
        googleDriveSection: Boolean(document.getElementById("google-drive-sync")),
        notebaseSection: Boolean(document.getElementById("custom-actions-notebase")),
        buttons: Array.from(document.querySelectorAll("button")).map((b) => ({
          text: b.textContent,
          disabled: b.disabled,
          state: b.getAttribute("data-state"),
        })),
      }))
      assert.ok(
        state.text.includes("任译喵") || state.text.includes("TranslateBuff"),
        "Actual branded options must mount",
      )
      assert.equal(state.googleDriveSection, false)
      assert.equal(state.notebaseSection, false)
      assert.equal(
        /Google Drive|Save to Notebase|Connect Notebase|保存到知识库|连接知识库/.test(state.text),
        false,
      )
      if (["sentence", "writing"].includes(name)) {
        assert.ok(state.text.includes("词典"), "Approved dictionary entry remains")
        assert.ok(
          state.text.includes("暂无自定义 AI 指令"),
          "Denied action deep link must not mount its editor",
        )
        assert.equal(/系统提示词|输出 Schema/.test(state.text), false)
      }
      rows.push({
        name,
        route,
        state,
        screenshot: await screenshot(options, `G4-${name}-deep-link`),
      })
    }
    const stored = await popup.evaluate(
      async () => (await chrome.storage.local.get("config")).config.selectionToolbar.builtInActions,
    )
    assert.equal(stored.sentenceAnalysis.enabled, true)
    assert.equal(stored.improveWriting.enabled, true)
    await options.close()
    return {
      rows,
      storedBuiltInActionsAfterNavigation: stored,
      assertionScope:
        "Forbidden sections and cloud connection controls remain absent on deep links; legacy persisted enabled flags stay true. Screenshots/DOM retained. Does not assert every settings route is audited.",
    }
  })
  await runCase(
    "G5-normal-provider-positive",
    "real-runtime-message-and-content-translation",
    async () => {
      const generated = await sendRuntimeMessage("backgroundGenerateText", {
        providerRef: { kind: "local", config: localProvider },
        instructions: "Translate to Chinese",
        prompt: "Positive local request after denied cases",
        maxRetries: 0,
      })
      assert.match(unwrap(generated).text, /受控准入译文/)
      const page = await context.newPage()
      await page.goto(origin)
      await page.waitForTimeout(500)
      const tabId = await popup.evaluate(
        async (url) =>
          (await chrome.tabs.query({})).find((t) => t.url === url || t.url === `${url}/`)?.id,
        origin,
      )
      assert.ok(Number.isInteger(tabId))
      unwrap(
        await sendRuntimeMessage("tryToSetEnablePageTranslationByTabId", { tabId, enabled: true }),
      )
      await page
        .locator("#positive")
        .filter({ hasText: "受控准入译文" })
        .waitFor({ timeout: 30000 })
      const text = await page.locator("#positive").innerText()
      assert.match(text, /受控准入译文/)
      return {
        generated,
        text,
        screenshot: await screenshot(page, "G5-provider-positive"),
        requests: evidence.providerRequests.filter((r) => r.phase === phase),
        transport:
          "Actual extension background generation and content page translation use localhost fixture through a normal configured provider.",
      }
    },
  )
  phase = "settle-after-denials"
  await sleep(1500)
} catch (e) {
  evidence.fatal = String(e.stack ?? e)
  process.exitCode = 1
} finally {
  phase = "cleanup"
  if (context)
    await context.close().catch((e) => evidence.errors.push({ source: "close", error: e.message }))
  if (profile && existsSync(join(profile, "netlog.json"))) {
    const log = JSON.parse(readFileSync(join(profile, "netlog.json"), "utf8"))
    const types = Object.fromEntries(
      Object.entries(log.constants?.logSourceType ?? {}).map(([k, v]) => [v, k]),
    )
    const rows = []
    for (const event of log.events ?? []) {
      const url = event.params?.url
      if (typeof url === "string" && /^https?:/.test(url))
        rows.push({
          time: event.time,
          url: safeUrl(url),
          sourceType: types[event.source?.type] ?? event.source?.type,
          commercial: commercial(url),
        })
    }
    evidence.netlog = {
      captureMode: "Default",
      eventsWithUrls: rows.length,
      urls: [...new Map(rows.map((r) => [r.url, r])).values()],
    }
    writeFileSync(join(output, "netlog-url-events.json"), JSON.stringify(rows, null, 2) + "\n")
  }
  if (server)
    await new Promise((done) => {
      server.close(done)
      server.closeAllConnections()
    })
  if (profile) rmSync(profile, { recursive: true, force: true })
  evidence.cleanup = {
    ownedProfileRemoved: profile ? !existsSync(profile) : null,
    localServerClosed: server ? !server.listening : null,
    browserContextClosed: true,
  }
  evidence.completedAt = new Date().toISOString()
  evidence.networkSummary = {
    noCommercialRouteBlocking: true,
    playwrightRequests: evidence.network.length,
    cdpRequests: evidence.cdp.length,
    contexts: [...new Set(evidence.cdp.map((r) => r.context))],
    providerRequests: evidence.providerRequests.length,
    commercial: [...evidence.network, ...evidence.cdp, ...(evidence.netlog?.urls ?? [])].filter(
      (r) => r.commercial,
    ),
  }
  evidence.artifactEndTreeSha256 = digest(artifact).treeSha256
  evidence.artifactUnchanged = evidence.artifactEndTreeSha256 === expectedTree
  evidence.status =
    evidence.fatal ||
    !evidence.netlog ||
    !evidence.artifactUnchanged ||
    evidence.cases.some((c) => c.status !== "PASS") ||
    evidence.networkSummary.commercial.length
      ? "INCOMPLETE_OR_FAIL"
      : "PASS_BOUNDED_SUBSET"
  writeFileSync(join(output, "result.json"), JSON.stringify(evidence, null, 2) + "\n")
  flush()
  console.log(
    JSON.stringify(
      {
        output,
        status: evidence.status,
        cases: evidence.cases.map((c) => ({ id: c.id, status: c.status, error: c.error })),
        fatal: evidence.fatal,
        networkSummary: evidence.networkSummary,
        cleanup: evidence.cleanup,
      },
      null,
      2,
    ),
  )
}
