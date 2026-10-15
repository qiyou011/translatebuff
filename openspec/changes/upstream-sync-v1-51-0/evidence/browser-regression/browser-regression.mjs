import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { createHash, randomUUID } from "node:crypto"
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { createServer } from "node:http"
import { tmpdir } from "node:os"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { fixture } from "./fixtures.mjs"

// No account/profile reuse, no network blocking, and no credentials in evidence.
const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(process.env.TEST_REPO ?? join(here, "../../../../.."))
const extensionPath = resolve(process.env.EXTENSION_PATH ?? join(repo, ".output/chrome-mv3"))
const stages = new Set(
  (process.env.TEST_STAGES ?? "core,glossary,isolation").split(",").filter(Boolean),
)
const runId = new Date().toISOString().replaceAll(":", "-")
const output = resolve(process.env.BROWSER_EVIDENCE_DIR ?? join(here, "runs", runId))
// Same schema/visible identity shape as buildRenyimiaoProvider, with localhost transport only.
// This avoids existing fork UI repoint rules for intentionally hidden arbitrary LLM rows.
const providerId = "renyimiao-browser-regression-local"
const wrapper = ".read-frog-translated-content-wrapper"
const spinner = ".read-frog-spinner"
const sourceTitle = "Controlled translation title"
const upstreamHosts = [
  "readfrog.app",
  "read-frog.com",
  ...(process.env.UPSTREAM_HOSTS ?? "").split(",").filter(Boolean),
]
const sha256 = (value) => createHash("sha256").update(value).digest("hex")
const sleep = (ms) => new Promise((done) => setTimeout(done, ms))
const evidence = {
  runId,
  stages: [...stages],
  cases: [],
  network: [],
  cdp: [],
  providerRequests: [],
  errors: [],
  limitations: [],
}
let context,
  browserCdp,
  server,
  profile,
  popup,
  extensionId,
  providerOrigin,
  casePage,
  configSchemaChunks,
  phase = "startup",
  providerDelay = 1200
const cdpTasks = new Set()
const attachedTargets = new Set()

const planned = [
  ["core", "normal", "Real unpacked extension: loading, bilingual, translationOnly, restore"],
  ["core", "P01", "Controlled zero-line-height block footnote"],
  ["core", "P03", "Controlled dynamic wrapper, new paragraph, visibility and mode toggles"],
  ["core", "P12", "Title default, off/on restore and no additional body requests"],
  ["core", "P15", "Same selection host and mounted DOM after body replacement; live control"],
  [
    "glossary",
    "glossary",
    "Real options CSV import/export; captured LLM glossary, edit invalidation, delete",
  ],
  ["privacy", "P05", "Isolated-world value getter observations and explicit selection action"],
  [
    "iframe",
    "P11",
    "Controlled same-origin trusted keyboard gesture, synthetic event and opaque sandbox",
  ],
  ["sites", "P07", "Wikipedia URL served with controlled fixture; global short-text threshold"],
  ["sites", "P08", "Kaggle URL served with controlled fixture; formula preservation"],
  ["sites", "P10", "ar5iv URL served with controlled fixture; inline code in both modes"],
  [
    "isolation",
    "G5-subset",
    "Unblocked network capture, hosted status, cached state, pending-save preservation, reload",
  ],
]
if (process.argv.includes("--list")) {
  writeFileSync(
    1,
    `${JSON.stringify({ planned, pending: ["P02 long-page AI action", "P04 actual React 19 rewrite", "P06 Google citation card", "P09 real YouTube cue timing", "P13 real YouTube pointer/menu", "P14 actual Lexical/Reddit and Telegram/Discord", "G4 full brand and admission UI", "G5 real own-account service paths and all denied capabilities", "G6 schema100 upgrade/backup/rollback"] }, null, 2)}\n`,
  )
  process.exit(0)
}

function safeUrl(value) {
  try {
    const url = new URL(value)
    if (!["http:", "https:", "chrome-extension:"].includes(url.protocol)) return url.protocol
    return `${url.protocol}//${url.host}${url.pathname.replace(/(?:sk-[\w-]+|eyJ[\w.-]{20,})/g, "[redacted]")}`
  } catch {
    return "[unparseable-url]"
  }
}
function commercialUrl(value) {
  try {
    const url = new URL(value)
    const upstream = upstreamHosts.some(
      (host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
    )
    return (
      (upstream &&
        /\/api\/(identity|rpc|blog)(\/|$)|hosted|subscri|billing|purchase|notebase|transcri/i.test(
          url.pathname,
        )) ||
      (/^(?:www\.)?googleapis\.com$/.test(url.hostname) && url.pathname.includes("/drive/")) ||
      url.hostname === "oauth2.googleapis.com"
    )
  } catch {
    return false
  }
}
function digestArtifact(directory) {
  const files = []
  function walk(path) {
    for (const entry of readdirSync(path).sort()) {
      const full = join(path, entry)
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
async function waitUntil(check, label, timeout = 15000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const value = await check()
    if (value) return value
    await sleep(150)
  }
  throw new Error(`Timed out: ${label}`)
}
async function screenshot(page, name) {
  const path = join(output, `${name}.png`)
  await page.screenshot({ path, fullPage: true })
  return path
}
function flushPartial() {
  mkdirSync(output, { recursive: true })
  writeFileSync(
    join(output, "partial-result.json"),
    `${JSON.stringify({ ...evidence, activePhase: phase, updatedAt: new Date().toISOString() }, null, 2)}\n`,
  )
}
async function runCase(id, fn) {
  phase = id
  const result = {
    id,
    status: "RUNNING",
    startedAt: new Date().toISOString(),
    scope: "controlled-fixture",
  }
  evidence.cases.push(result)
  flushPartial()
  try {
    result.details = await fn()
    result.status = "PASS"
  } catch (error) {
    result.status = "FAIL"
    result.error = String(error?.message ?? error)
    result.errorStack = String(error?.stack ?? error)
    const page =
      casePage && !casePage.isClosed()
        ? casePage
        : context
            ?.pages()
            .filter((p) => !p.isClosed() && /^https?:/.test(p.url()))
            .at(-1)
    if (page) {
      result.failureUrl = safeUrl(page.url())
      result.failureSnapshot = await snapshot(page).catch(() => null)
      result.failureScreenshot = await screenshot(page, `${id}-failure`).catch(() => null)
    }
    result.providerRequestsAtFailure = evidence.providerRequests.length
    console.error(`${id}: ${result.error}`)
  }
  result.completedAt = new Date().toISOString()
  console.log(`${id}: ${result.status}`)
  flushPartial()
}
function messagesText(body) {
  return (body.messages ?? []).map((chatMessage) => ({
    role: chatMessage.role,
    text:
      typeof chatMessage.content === "string"
        ? chatMessage.content
        : (chatMessage.content ?? [])
            .filter((c) => c.type === "text")
            .map((c) => c.text)
            .join("\n"),
  }))
}
function makeTranslation(body) {
  const messages = messagesText(body)
  const system = messages
    .filter((m) => ["system", "developer"].includes(m.role))
    .map((m) => m.text)
    .join("\n")
  const input = messages
    .filter((m) => m.role === "user")
    .map((m) => m.text)
    .join("\n")
  const terms = [...system.matchAll(/^([^\n]+) => ([^\n]+)$/gm)].map((m) => ({
    source: m[1],
    target: m[2],
  }))
  function translate(text) {
    let value = String(text)
    for (const term of terms)
      value = value.replaceAll(
        term.source,
        term.target === "KEEP ORIGINAL" ? term.source : term.target,
      )
    return value
      .split(/(<[^>]+>)/g)
      .map((part) => (part.startsWith("<") || !/[A-Za-z]/.test(part) ? part : `受控译文：${part}`))
      .join("")
  }
  const jsonStart = input.indexOf('{"t0"')
  let content
  if (jsonStart >= 0) {
    const values = JSON.parse(input.slice(jsonStart).trim())
    content = JSON.stringify(
      Object.fromEntries(Object.entries(values).map(([key, value]) => [key, translate(value)])),
    )
  } else content = translate(input.replace(/^Translate to[^:]*:\s*/i, ""))
  return { content, system, input, terms }
}
async function startServer() {
  server = createServer(async (req, res) => {
    res.setHeader("access-control-allow-origin", "*")
    res.setHeader("access-control-allow-headers", "*")
    res.setHeader("access-control-allow-methods", "GET, POST, OPTIONS")
    if (req.method === "OPTIONS") {
      res.writeHead(204).end()
      return
    }
    if (req.method === "POST" && req.url.startsWith("/api/rpc/")) {
      try {
        const chunks = []
        for await (const chunk of req) chunks.push(chunk)
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8"))
        const translatedResponse = makeTranslation(body)
        evidence.providerRequests.push({
          index: evidence.providerRequests.length,
          phase,
          path: safeUrl(`${providerOrigin}${req.url}`),
          stream: body.stream === true,
          model: body.model,
          bodySha256: sha256(JSON.stringify(body)),
          system: translatedResponse.system,
          input: translatedResponse.input,
          glossary: translatedResponse.terms,
        })
        flushPartial()
        await sleep(providerDelay)
        const id = `chatcmpl-${randomUUID()}`
        const base = { id, created: Math.floor(Date.now() / 1000), model: body.model }
        if (body.stream) {
          res.setHeader("content-type", "text/event-stream")
          res.write(
            `data: ${JSON.stringify({ ...base, object: "chat.completion.chunk", choices: [{ index: 0, delta: { role: "assistant", content: translatedResponse.content }, finish_reason: null }] })}\n\n`,
          )
          res.end(
            `data: ${JSON.stringify({ ...base, object: "chat.completion.chunk", choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`,
          )
        } else {
          res.setHeader("content-type", "application/json")
          res.end(
            JSON.stringify({
              ...base,
              object: "chat.completion",
              choices: [
                {
                  index: 0,
                  message: { role: "assistant", content: translatedResponse.content },
                  finish_reason: "stop",
                },
              ],
              usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
            }),
          )
        }
      } catch (error) {
        evidence.errors.push({ source: "controlled-provider", error: String(error.message) })
        res.writeHead(400, { "content-type": "application/json" }).end(
          JSON.stringify({
            error: { message: "Controlled provider could not decode fixture request" },
          }),
        )
      }
      return
    }
    res.setHeader("content-type", "text/html; charset=utf-8")
    res.end(fixture(new URL(req.url, "http://fixture.invalid").pathname))
  })
  await new Promise((done, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", done)
  })
  providerOrigin = `http://127.0.0.1:${server.address().port}`
}

function recordCdp(params, target) {
  const initiator = params.initiator ?? {}
  const frames = initiator.stack?.callFrames ?? []
  const attributedContext =
    target.type === "service_worker"
      ? "service-worker"
      : target.url.startsWith("chrome-extension:")
        ? "extension-page"
        : frames.some((frame) => frame.url.startsWith("chrome-extension:"))
          ? "content-script"
          : "page-or-unresolved"
  evidence.cdp.push({
    phase,
    target,
    attributedContext,
    url: safeUrl(params.request.url),
    method: params.request.method,
    type: params.type,
    initiator: {
      type: initiator.type,
      url: initiator.url ? safeUrl(initiator.url) : undefined,
      stack: frames.slice(0, 8).map((frame) => ({
        functionName: frame.functionName,
        url: safeUrl(frame.url),
        lineNumber: frame.lineNumber,
      })),
    },
    commercial: commercialUrl(params.request.url),
  })
}
async function attachPage(page) {
  page.on("pageerror", (error) =>
    evidence.errors.push({
      phase,
      source: safeUrl(page.url()),
      error: String(error.message).replace(/(?:sk-[\w-]+|eyJ[\w.-]{20,})/g, "[redacted]"),
    }),
  )
  try {
    const cdp = await context.newCDPSession(page)
    cdp.on("Network.requestWillBeSent", (params) =>
      recordCdp(params, { type: "page", url: safeUrl(page.url()) }),
    )
    await cdp.send("Network.enable")
  } catch (error) {
    evidence.errors.push({ source: "page-cdp", error: error.message })
  }
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
  const targetInfo = { type: target.type, url: safeUrl(target.url), targetId: target.targetId }
  browserCdp.on("Target.receivedMessageFromTarget", (targetMessage) => {
    if (targetMessage.sessionId !== sessionId) return
    const event = JSON.parse(targetMessage.message)
    if (event.method === "Network.requestWillBeSent") recordCdp(event.params, targetInfo)
  })
  await browserCdp.send("Target.sendMessageToTarget", {
    sessionId,
    message: JSON.stringify({ id: 1, method: "Network.enable" }),
  })
}
function track(task) {
  cdpTasks.add(task)
  task
    .catch((error) =>
      evidence.errors.push({ source: "network-instrumentation", error: error.message }),
    )
    .finally(() => cdpTasks.delete(task))
}
async function startNetworkCapture() {
  context.on("request", (request) => {
    let frameUrl, serviceWorkerUrl
    try {
      frameUrl = request.frame()?.url()
    } catch {}
    try {
      serviceWorkerUrl = request.serviceWorker()?.url()
    } catch {}
    evidence.network.push({
      phase,
      url: safeUrl(request.url()),
      method: request.method(),
      resourceType: request.resourceType(),
      context: serviceWorkerUrl
        ? "service-worker"
        : frameUrl?.startsWith("chrome-extension:")
          ? "extension-page"
          : "content-page-or-content-script",
      frameUrl: frameUrl ? safeUrl(frameUrl) : undefined,
      serviceWorkerUrl: serviceWorkerUrl ? safeUrl(serviceWorkerUrl) : undefined,
      commercial: commercialUrl(request.url()),
    })
  })
  context.on("page", (page) => track(attachPage(page)))
  for (const page of context.pages()) track(attachPage(page))
  browserCdp = await context.browser().newBrowserCDPSession()
  browserCdp.on("Target.targetCreated", ({ targetInfo }) => track(attachWorker(targetInfo)))
  await browserCdp.send("Target.setDiscoverTargets", { discover: true })
  for (const target of (await browserCdp.send("Target.getTargets")).targetInfos)
    track(attachWorker(target))
  await Promise.allSettled([...cdpTasks])
}
async function message(type, data) {
  return popup.evaluate(
    async ({ runtimeType, payload }) => {
      const now = Date.now()
      const response = await chrome.runtime.sendMessage({
        id: now,
        type: runtimeType,
        data: payload,
        timestamp: now,
      })
      if (response?.err) throw new Error(response.err.message ?? `Runtime ${runtimeType} failed`)
      // Match @webext-core/messaging's public sendMessage contract, including res:null.
      return response && Object.hasOwn(response, "res") ? response.res : response
    },
    { runtimeType: type, payload: data },
  )
}
async function updateConfig(patch) {
  return popup.evaluate(async (configPatch) => {
    const { config } = await chrome.storage.local.get("config")
    function merge(base, changes) {
      for (const [key, value] of Object.entries(changes)) {
        if (key === "providersConfig" && Array.isArray(value)) {
          // Whole-config validation also checks disabled feature provider references.
          // Retain valid fresh-install rows rather than orphaning noteSuggestion/default actions.
          const replacementIds = new Set(value.map((providerRow) => providerRow.id))
          base[key] = [
            ...(base[key] ?? []).filter((providerRow) => !replacementIds.has(providerRow.id)),
            ...value,
          ]
        } else
          base[key] =
            value && typeof value === "object" && !Array.isArray(value)
              ? merge(base[key] ?? {}, value)
              : value
      }
      return base
    }
    await chrome.storage.local.set({ config: merge(config, configPatch) })
  }, patch)
}
async function validateBuiltConfig() {
  const validation = await popup.evaluate(async (chunkPaths) => {
    const { config } = await chrome.storage.local.get("config")
    for (const chunkPath of chunkPaths) {
      // The already-loaded shared chunk exposes the exact schema used by this build.
      const sharedModule = await import(chrome.runtime.getURL(chunkPath))
      for (const [exportName, exported] of Object.entries(sharedModule)) {
        if (
          !exported?.safeParse ||
          !exported.shape?.pageTranslation ||
          !exported.shape?.providersConfig ||
          !exported.shape?.siteControl
        )
          continue
        const parsed = exported.safeParse(config)
        return {
          chunkPath,
          exportName,
          success: parsed.success,
          issues: parsed.success
            ? []
            : parsed.error.issues.map((issue) => ({
                path: issue.path,
                code: issue.code,
                message: issue.message,
              })),
          pageProviderId: parsed.success ? parsed.data.pageTranslation.providerId : null,
          providers: config.providersConfig.map((providerRow) => ({
            id: providerRow.id,
            provider: providerRow.provider,
            enabled: providerRow.enabled,
          })),
        }
      }
    }
    throw new Error(
      "Exact built configSchema export was not found; do not treat a raw storage read as schema validation",
    )
  }, configSchemaChunks)
  evidence.configValidations ??= []
  evidence.configValidations.push({ phase, ...validation })
  flushPartial()
  assert.equal(
    validation.success,
    true,
    `Built configSchema rejected harness seed: ${JSON.stringify(validation.issues)}`,
  )
  assert.equal(
    validation.pageProviderId,
    providerId,
    "Schema-normalized config must retain controlled provider",
  )
  return validation
}
async function tabId(page) {
  const id = await popup.evaluate(
    async (url) => (await chrome.tabs.query({})).find((tab) => tab.url === url)?.id,
    page.url(),
  )
  assert.ok(Number.isInteger(id), `No real content tab found for ${page.url()}`)
  return id
}
async function toggle(page, enabled) {
  return message("tryToSetEnablePageTranslationByTabId", { tabId: await tabId(page), enabled })
}
async function translated(page, selector = "#normal") {
  await page
    .locator(`${selector} ${wrapper}`)
    .filter({ hasText: "受控译文" })
    .first()
    .waitFor({ state: "visible", timeout: 30000 })
  await waitUntil(
    () =>
      page
        .locator(spinner)
        .count()
        .then((n) => n === 0),
    "translation completion",
    30000,
  )
  await sleep(250)
}
async function newFixture(path = "/") {
  const page = await context.newPage()
  casePage = page
  await page.goto(`${providerOrigin}${path}`, { waitUntil: "domcontentloaded" })
  await page.waitForTimeout(500)
  await validateBuiltConfig()
  return page
}
async function snapshot(page) {
  return page.evaluate(
    ({ wrapperCss, spinnerCss }) => ({
      title: document.title,
      wrappers: document.querySelectorAll(wrapperCss).length,
      spinners: document.querySelectorAll(spinnerCss).length,
      paragraphs: [
        "normal",
        "dynamic",
        "footnote",
        "term",
        "inline",
        "guide",
        "short",
        "long",
      ].flatMap((id) => {
        const node = document.getElementById(id)
        return node
          ? [{ id, text: node.textContent, translations: node.querySelectorAll(wrapperCss).length }]
          : []
      }),
    }),
    { wrapperCss: wrapper, spinnerCss: spinner },
  )
}

async function core() {
  await runCase("normal-loading-bilingual", async () => {
    const page = await newFixture()
    await screenshot(page, "normal-before")
    const before = evidence.providerRequests.length
    await toggle(page, true)
    await page.locator(spinner).first().waitFor({ state: "visible", timeout: 15000 })
    const loading = await snapshot(page)
    await screenshot(page, "normal-loading")
    await translated(page)
    const complete = await snapshot(page)
    assert.ok(
      complete.paragraphs.find((p) => p.id === "normal").text.includes("A complete English"),
    )
    assert.ok(
      evidence.providerRequests.length > before,
      "Must reach controlled provider, not a fake DOM translation",
    )
    await screenshot(page, "normal-bilingual")
    return { loading, complete, requests: evidence.providerRequests.length - before }
  })
  await runCase("P01-footnote", async () => {
    const page = context.pages().find((p) => p.url() === `${providerOrigin}/`)
    assert.ok(page, "normal fixture prerequisite")
    assert.ok(
      evidence.providerRequests.length > 0,
      "Footnote fixture must have reached the selected controlled provider",
    )
    const box = await page
      .locator("#footnote .read-frog-translated-block-content")
      .first()
      .evaluate((node) => ({
        height: node.getBoundingClientRect().height,
        lineHeight: getComputedStyle(node).lineHeight,
        display: getComputedStyle(node).display,
        text: node.textContent,
      }))
    assert.notEqual(box.lineHeight, "0px")
    assert.ok(box.height > 20)
    await screenshot(page, "P01-footnote")
    return { ...box, limitation: "Controlled sub ancestor; real GitHub page is not covered" }
  })
  await runCase("P03-dynamic-wrapper", async () => {
    const page = context.pages().find((p) => p.url() === `${providerOrigin}/`)
    assert.ok(page, "normal fixture prerequisite")
    await waitUntil(
      () =>
        page
          .locator(spinner)
          .count()
          .then((n) => n === 0),
      "idle",
    )
    const before = evidence.providerRequests.length
    await page.evaluate((wrapperCss) => {
      const paragraph = document.querySelector("#dynamic")
      const walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT)
      let text
      while ((text = walker.nextNode())) {
        if (
          text.textContent.includes("This original dynamic") &&
          !text.parentElement.closest(wrapperCss)
        ) {
          const span = document.createElement("span")
          span.id = "temporary-wrapper"
          text.replaceWith(span)
          span.append(text)
          return
        }
      }
      throw new Error("No untranslated source text node found")
    }, wrapper)
    await sleep(1800)
    assert.equal(
      evidence.providerRequests.length,
      before,
      "Existing bilingual content must not request again",
    )
    assert.equal(await page.locator(`#dynamic ${wrapper}`).count(), 1)
    await page.evaluate(() => {
      const p = document.createElement("p")
      p.id = "new-paragraph"
      p.textContent =
        "A genuinely new independent paragraph must still receive one translation after the wrapper mutation."
      document.querySelector("main").append(p)
    })
    await translated(page, "#new-paragraph")
    assert.ok(evidence.providerRequests.length > before)
    await toggle(page, false)
    await toggle(page, true)
    await translated(page, "#dynamic")
    assert.equal(await page.locator(`#dynamic ${wrapper}`).count(), 1)
    await screenshot(page, "P03-dynamic")
    return {
      existingRequests: 0,
      totalNewRequests: evidence.providerRequests.length - before,
      snapshot: await snapshot(page),
    }
  })
  await runCase("P12-title", async () => {
    const page = context.pages().find((p) => p.url() === `${providerOrigin}/`)
    assert.ok(page, "normal fixture prerequisite")
    await waitUntil(
      () => page.title().then((title) => title.includes("受控译文")),
      "translated tab title",
    )
    const titleOn = await page.title()
    const before = evidence.providerRequests.length
    await updateConfig({ pageTranslation: { page: { translateTitle: false } } })
    await waitUntil(
      () => page.title().then((title) => title === sourceTitle),
      "source title restored",
    )
    await updateConfig({ pageTranslation: { page: { translateTitle: true } } })
    await waitUntil(
      () => page.title().then((title) => title.includes("受控译文")),
      "title enabled again",
    )
    await sleep(500)
    assert.equal(
      evidence.providerRequests.length,
      before,
      "Title toggle must reuse results without retranslating body",
    )
    await toggle(page, false)
    await waitUntil(
      () => page.title().then((title) => title === sourceTitle),
      "disabled page restores source title",
    )
    return { titleOn, restored: await page.title(), additionalRequests: 0 }
  })
  await runCase("translation-only-restore", async () => {
    await updateConfig({ pageTranslation: { mode: "translationOnly" } })
    const page = await newFixture("/?mode=only")
    await toggle(page, true)
    await translated(page)
    const on = await snapshot(page)
    const visible = await page.locator("#normal").innerText()
    assert.equal(
      visible.split("A complete English paragraph").length - 1,
      1,
      "translationOnly must show one translated copy, without a second visible source copy",
    )
    await screenshot(page, "normal-translation-only")
    await toggle(page, false)
    await waitUntil(
      () =>
        page
          .locator(`#normal ${wrapper}`)
          .count()
          .then((n) => n === 0) || Promise.resolve(false),
      "translated wrappers removed",
    ).catch(async () => {
      // Some implementations retain hidden wrappers. Visible content is authoritative.
      assert.equal(await page.locator(`#normal ${wrapper}:visible`).count(), 0)
    })
    assert.ok(await page.locator("#normal").isVisible())
    assert.ok(!(await page.locator("#normal").innerText()).includes("受控译文"))
    await screenshot(page, "normal-restored")
    await updateConfig({ pageTranslation: { mode: "bilingual" } })
    return { on, restored: await snapshot(page) }
  })
  await runCase("P15-body-replacement", async () => {
    const page = await newFixture("/?body=replace")
    await waitUntil(
      () =>
        page.evaluate(() =>
          [...document.querySelectorAll("*")].some(
            (node) => node.shadowRoot && /selection/i.test(node.tagName),
          ),
        ),
      "selection shadow host mounted",
    )
    await page.getByTestId("floating-main-button").hover()
    const before = await page.evaluate(() => {
      const host = [...document.querySelectorAll("*")].find(
        (node) => node.shadowRoot && /selection/i.test(node.tagName),
      )
      window.__regressionHost = host
      window.__regressionMount = host.shadowRoot.querySelector("div.notranslate")
      const side = [...document.querySelectorAll("*")].find((node) =>
        node.shadowRoot?.querySelector('[data-testid="floating-main-button"]'),
      )
      window.__regressionSideHost = side
      window.__regressionMainButton = side.shadowRoot.querySelector(
        '[data-testid="floating-main-button"]',
      )
      const body = document.createElement("body")
      body.innerHTML =
        '<main><p id="normal">A new body keeps the same extension host and mounted UI controls ready for real translation.</p><button id="page-control">Replacement page control</button></main>'
      document.body.replaceWith(body)
      return { hostTag: host.tagName, sideHostTag: side.tagName }
    })
    await waitUntil(
      () => page.evaluate(() => window.__regressionHost.isConnected),
      "original host reattached",
    )
    const after = await page.evaluate(() => ({
      sameHost: [...document.querySelectorAll("*")].includes(window.__regressionHost),
      sameMountedNode:
        window.__regressionHost.shadowRoot.querySelector("div.notranslate") ===
        window.__regressionMount,
      sameSideHost: window.__regressionSideHost.isConnected,
      sameMainButton:
        window.__regressionSideHost.shadowRoot.querySelector(
          '[data-testid="floating-main-button"]',
        ) === window.__regressionMainButton,
      hostCount: [...document.querySelectorAll("*")].filter(
        (node) => node.shadowRoot && /selection/i.test(node.tagName),
      ).length,
    }))
    assert.ok(
      after.sameHost &&
        after.sameMountedNode &&
        after.sameSideHost &&
        after.sameMainButton &&
        after.hostCount === 1,
    )
    const floating = page.getByTestId("floating-button-container")
    assert.ok(
      await floating.isVisible(),
      "Mounted extension floating control must be visible after body swap",
    )
    // This case deliberately requires the mounted control itself to work after the swap.
    await page.getByTestId("floating-main-button").click()
    await translated(page)
    await screenshot(page, "P15-body-replacement")
    return {
      before,
      after,
      controlVisible: true,
      limitation:
        "DOM mount identity and a working control are covered; arbitrary internal React state is not directly inspected",
    }
  })
}

async function glossary() {
  await runCase("glossary-csv-and-cache", async () => {
    const options = await context.newPage()
    casePage = options
    await options.goto(`chrome-extension://${extensionId}/options.html#/advanced/glossary`)
    await options.locator("#glossary-library button").first().click()
    await options.locator("#glossary-editor").waitFor()
    const glossaryUrl = options.url()
    async function importCsv(target) {
      const csv = `\uFEFFsource,target,targetLanguage,caseSensitive\r\nQuantumWidget,${target},cmn,false\r\nStableToken,,all,true\r\n`
      await options.locator("#glossary-import-file").setInputFiles({
        name: "controlled-glossary.csv",
        mimeType: "text/csv",
        buffer: Buffer.from(csv),
      })
      await options.getByRole("cell", { name: target, exact: true }).waitFor()
      await waitUntil(async () => {
        const glossarySnapshot = await message("getGlossarySnapshot", {
          url: `${providerOrigin}/glossary`,
          targetLang: "cmn",
        })
        return (
          glossarySnapshot?.entries?.some((entry) => entry.target === target) && glossarySnapshot
        )
      }, "glossary import visible to real background matcher")
    }
    await importCsv("量子组件甲")
    await screenshot(options, "glossary-imported")
    const downloadPromise = options.waitForEvent("download")
    await options
      .locator("#glossary-import-export")
      .getByRole("button", { name: /^Export$|^导出$/i })
      .click()
    const download = await downloadPromise
    const csvPath = join(output, "glossary-export.csv")
    await download.saveAs(csvPath)
    const exported = readFileSync(csvPath, "utf8")
    assert.ok(
      exported.includes("QuantumWidget") &&
        exported.includes("量子组件甲") &&
        exported.includes("StableToken"),
    )
    const page = await newFixture("/glossary")
    let before = evidence.providerRequests.length
    await toggle(page, true)
    await translated(page, "#term")
    assert.ok((await page.locator(`#term ${wrapper}`).textContent()).includes("量子组件甲"))
    const first = evidence.providerRequests.slice(before)
    assert.ok(
      first.some((request) =>
        request.glossary.some(
          (term) => term.source === "QuantumWidget" && term.target === "量子组件甲",
        ),
      ),
    )
    await screenshot(page, "glossary-first")
    // Import merge updates the existing match key through real repository/UI.
    await importCsv("量子组件乙")
    await toggle(page, false)
    before = evidence.providerRequests.length
    await toggle(page, true)
    await translated(page, "#term")
    assert.ok((await page.locator(`#term ${wrapper}`).textContent()).includes("量子组件乙"))
    const second = evidence.providerRequests.slice(before)
    assert.ok(
      second.some((request) => request.glossary.some((term) => term.target === "量子组件乙")),
      "Edited glossary must cause a new request with the new effective term",
    )
    assert.ok(
      !second.some((request) => request.glossary.some((term) => term.target === "量子组件甲")),
    )
    await screenshot(page, "glossary-updated")
    const row = options
      .getByRole("row")
      .filter({ has: options.getByRole("cell", { name: "QuantumWidget", exact: true }) })
    await row.getByRole("button", { name: /Delete|删除/i }).click()
    await waitUntil(
      async () =>
        !(
          await message("getGlossarySnapshot", { url: page.url(), targetLang: "cmn" })
        )?.entries?.some((entry) => entry.source === "QuantumWidget"),
      "term deleted in real background snapshot",
    )
    await toggle(page, false)
    before = evidence.providerRequests.length
    await toggle(page, true)
    await translated(page, "#term")
    const third = evidence.providerRequests.slice(before)
    assert.ok(
      !third.some((request) => request.glossary.some((term) => term.source === "QuantumWidget")),
    )
    const finalText = await page.locator(`#term ${wrapper}`).textContent()
    assert.ok(!finalText.includes("量子组件甲") && !finalText.includes("量子组件乙"))
    return {
      glossaryUrl,
      csvPath,
      initialRequests: first.length,
      editedRequests: second.length,
      deletedRequests: third.length,
      finalText,
      limitation:
        "Controlled LLM transport; MT enforcement, cross-revision pending batches and retry/fallback need separate cases",
    }
  })
}

async function privacy() {
  await runCase("P05-isolated-value-reads", async () => {
    const page = await newFixture("/privacy")
    const id = await tabId(page)
    async function reads(reset = false) {
      return popup.evaluate(
        async ({ targetTabId, resetReads }) => {
          const results = await chrome.scripting.executeScript({
            target: { tabId: targetTabId },
            world: "ISOLATED",
            func: (clearReads) => {
              if (!globalThis.__regressionValueReads) {
                globalThis.__regressionValueReads = []
                for (const prototype of [
                  HTMLInputElement.prototype,
                  HTMLTextAreaElement.prototype,
                ]) {
                  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value")
                  Object.defineProperty(prototype, "value", {
                    ...descriptor,
                    get() {
                      const field = this.getAttribute("data-field")
                      if (field)
                        globalThis.__regressionValueReads.push({ field, at: performance.now() })
                      return descriptor.get.call(this)
                    },
                  })
                }
              }
              if (clearReads) globalThis.__regressionValueReads.length = 0
              return [...globalThis.__regressionValueReads]
            },
            args: [resetReads],
          })
          return results[0].result
        },
        { targetTabId: id, resetReads: reset },
      )
    }
    await reads(true)
    const drag = await page.locator("#ordinary").evaluate((node) => {
      const box = node.getBoundingClientRect()
      const style = getComputedStyle(node)
      const canvas = document.createElement("canvas")
      const measure = canvas.getContext("2d")
      measure.font = style.font
      const start = box.left + parseFloat(style.paddingLeft) + parseFloat(style.borderLeftWidth) + 1
      return {
        start,
        end: start + measure.measureText("Selected ordinary sentence.").width,
        y: box.top + box.height / 2,
      }
    })
    await page.mouse.move(drag.start, drag.y)
    await page.mouse.down()
    await page.mouse.move(drag.end, drag.y, { steps: 8 })
    await page.mouse.up()
    await sleep(500)
    const selected = await page.evaluate(() => getSelection()?.toString() ?? "")
    assert.ok(
      selected.includes("Selected ordinary sentence") &&
        !selected.includes("PUBLIC_CONTEXT_CANARY"),
      "Explicit action must select only the sentence; canary must come from captured field context",
    )
    const displayReads = await reads()
    assert.deepEqual(
      displayReads,
      [],
      "Displaying input selection tools must not read the whole value in the content-script isolated world",
    )
    const before = evidence.providerRequests.length
    await page
      .getByRole("button", { name: /^Translate$|^翻译$/i })
      .first()
      .click()
    await waitUntil(
      () => evidence.providerRequests.length > before,
      "explicit selection action provider request",
    )
    const actionReads = await reads()
    assert.ok(actionReads.some((read) => read.field === "ordinary"))
    const requests = evidence.providerRequests.slice(before)
    assert.ok(
      requests.some((request) =>
        `${request.system}\n${request.input}`.includes("PUBLIC_CONTEXT_CANARY"),
      ),
    )
    await screenshot(page, "P05-explicit-action")
    await page.keyboard.press("Escape")
    const sensitive = []
    for (const field of ["email", "tel", "password", "otp", "payment"]) {
      await reads(true)
      await page.locator(`#${field}`).click({ clickCount: 3 })
      await sleep(250)
      const observed = await reads()
      assert.deepEqual(observed, [], `${field} must not be read to display selection tools`)
      sensitive.push({ field, reads: observed.length })
    }
    assert.ok(
      !evidence.providerRequests.some((request) =>
        /PRIVATE_(?:EMAIL|PHONE|PASSWORD|OTP|PAYMENT)_CANARY/.test(
          `${request.system}\n${request.input}`,
        ),
      ),
    )
    return {
      world: "ISOLATED",
      selected,
      displayReads,
      actionReads,
      sensitive,
      limitation:
        "Textarea paragraph extraction, search action and direct context-entry bypass remain pending",
    }
  })
}

async function iframe() {
  await runCase("P11-iframe-trusted-gesture", async () => {
    const page = await newFixture("/iframe")
    const id = await tabId(page)
    async function injected() {
      return popup.evaluate(
        async (frameTabId) =>
          (
            await chrome.scripting.executeScript({
              target: { tabId: frameTabId, allFrames: true },
              world: "ISOLATED",
              func: () => ({
                url: location.href,
                injected: globalThis.__READ_FROG_SELECTION_INJECTED__ === true,
                origin: origin,
              }),
            })
          ).map((result) => ({ frameId: result.frameId, ...result.result })),
        id,
      )
    }
    const initial = await injected()
    const allowedFrame = page.frameLocator("#allowed")
    await allowedFrame.locator("#frame-text").evaluate((node) => {
      const range = document.createRange()
      range.selectNodeContents(node)
      getSelection().removeAllRanges()
      getSelection().addRange(range)
      node.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }))
    })
    await sleep(500)
    const synthetic = await injected()
    assert.ok(
      synthetic.filter((frame) => frame.url.includes("/frame")).every((frame) => !frame.injected),
      "Synthetic selection must not activate frame runtime",
    )
    await allowedFrame.locator("#frame-text").click({ clickCount: 3 })
    const after = await waitUntil(async () => {
      const frames = await injected()
      return frames.some((frame) => frame.url.endsWith("/frame") && frame.injected) && frames
    }, "trusted frame activation")
    const opaque = after.filter((frame) => frame.url.includes("opaque=1"))
    assert.equal(
      opaque.length,
      1,
      "Opaque-frame instrumentation must be present; absence is not a passing denial check",
    )
    assert.equal(opaque[0].origin, "null")
    assert.equal(opaque[0].injected, false)
    await screenshot(page, "P11-frame")
    return {
      initial,
      synthetic,
      after,
      limitation:
        "Controlled mouse gesture and opaque denial; dual-layer site-control toggles, selection drift and cross-origin explicit injection remain pending",
    }
  })
}

async function sites() {
  async function sitePage(url, path) {
    const page = await context.newPage()
    casePage = page
    await page.route(url, (route) =>
      route.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: fixture(path) }),
    )
    await page.goto(url)
    await sleep(400)
    return page
  }
  await runCase("P07-wikipedia-fixture", async () => {
    await updateConfig({
      pageTranslation: { page: { minCharactersPerNode: 20, minWordsPerNode: 0 } },
    })
    const page = await sitePage(
      "https://en.wikipedia.org/wiki/Controlled_regression_fixture",
      "/site/wikipedia",
    )
    await toggle(page, true)
    await translated(page, "#long")
    assert.equal(await page.locator(`#short ${wrapper}`).count(), 0)
    await toggle(page, false)
    await updateConfig({
      pageTranslation: { page: { minCharactersPerNode: 0, minWordsPerNode: 0 } },
    })
    await toggle(page, true)
    await translated(page, "#short")
    await screenshot(page, "P07-wikipedia-fixture")
    return {
      fixture: true,
      origin: page.url(),
      shortTranslatedAtLowThreshold: true,
      shortSkippedAtHighThreshold: true,
    }
  })
  await runCase("P08-kaggle-fixture", async () => {
    const page = await sitePage(
      "https://www.kaggle.com/learn/controlled-regression-fixture",
      "/site/kaggle",
    )
    const before = await page.locator("[data-fixture-formula]").first().innerHTML()
    await toggle(page, true)
    await translated(page, "#guide")
    assert.equal(await page.locator("[data-fixture-formula]").first().innerHTML(), before)
    assert.ok(await page.locator("[data-fixture-formula]").first().isVisible())
    await screenshot(page, "P08-kaggle-fixture")
    return {
      fixture: true,
      origin: page.url(),
      formulaPreserved: true,
      limitation:
        "Source formula/visibility covered; actual Kaggle guide geometry needs live-page review",
    }
  })
  await runCase("P10-ar5iv-fixture", async () => {
    const page = await sitePage("https://ar5iv.labs.arxiv.org/html/0000.00000", "/site/ar5iv")
    const modes = []
    for (const mode of ["bilingual", "translationOnly"]) {
      await updateConfig({ pageTranslation: { mode } })
      await toggle(page, true)
      await translated(page, "#inline")
      const state = await page.locator("#inline").evaluate((node) => ({
        identifiers: [...node.querySelectorAll("code")].map((code) => ({
          text: code.textContent,
          visible: !!code.getBoundingClientRect().height,
        })),
        text: node.textContent,
      }))
      assert.ok(
        state.identifiers.filter((code) => code.text === "foo()" && code.visible).length >= 2,
      )
      assert.equal(await page.locator(`#code-only ${wrapper}`).count(), 0)
      await screenshot(page, `P10-${mode}-fixture`)
      await toggle(page, false)
      modes.push({ mode, ...state })
    }
    await updateConfig({ pageTranslation: { mode: "bilingual" } })
    return { fixture: true, origin: page.url(), modes }
  })
}

async function isolation() {
  await runCase("G5-status-and-old-state", async () => {
    const status = await message("getHostedAiStatus", undefined)
    assert.equal(status, null)
    const pending = {
      id: randomUUID(),
      createdAt: Date.now(),
      expiresAt: Date.now() + 600000,
      actionId: "controlled-fixture-action",
      actionName: "Controlled pending save",
      outputSchemaFingerprint: "controlled-fixture",
      kind: "create_notebase",
      notebaseId: randomUUID(),
      columns: [
        {
          localFieldId: "text",
          localFieldName: "Text",
          localFieldType: "string",
          notebaseColumnId: randomUUID(),
          notebaseColumnName: "Text",
        },
      ],
      rows: [{ id: randomUUID(), cells: { text: "PUBLIC_PENDING_SAVE_FIXTURE" } }],
    }
    await popup.evaluate(async (pendingSave) => {
      await chrome.storage.local.set({ notebasePendingSave: pendingSave })
      await chrome.storage.session.set({
        hostedAiStatus: { available: true, plan: "old-controlled-fixture" },
      })
    }, pending)
    const cachedStatus = await message("getHostedAiStatus", undefined)
    assert.equal(cachedStatus, null)
    // Reload only this temporary-profile extension; unlike profile reuse, this covers persisted fixture state.
    const beforeWorkerUrls = context.serviceWorkers().map((worker) => worker.url())
    await popup
      .evaluate(() => {
        setTimeout(() => chrome.runtime.reload(), 0)
      })
      .catch(() => {})
    await sleep(1500)
    popup = await context.newPage()
    await popup.goto(`chrome-extension://${extensionId}/popup.html`)
    await waitUntil(
      () =>
        popup.evaluate(async () =>
          Boolean((await chrome.storage.local.get("config")).config?.pageTranslation),
        ),
      "config after extension reload",
    )
    assert.equal(await message("getHostedAiStatus", undefined), null)
    const kept = await popup.evaluate(
      async () => (await chrome.storage.local.get("notebasePendingSave")).notebasePendingSave,
    )
    assert.deepEqual(kept, pending, "Disabled cloud processor must not delete pending-save fixture")
    await screenshot(popup, "G5-popup-after-reload")
    const page = await newFixture("/?after-reload=1")
    const beforeRequests = evidence.providerRequests.length
    await toggle(page, true)
    await translated(page)
    assert.ok(
      evidence.providerRequests.length > beforeRequests,
      "Local provider still works on /api/rpc path after reload",
    )
    await screenshot(page, "G5-provider-positive-control")
    await sleep(1000)
    const leaked = [...evidence.network, ...evidence.cdp].filter((request) => request.commercial)
    assert.equal(
      leaked.length,
      0,
      "Observed upstream commercial requests must be zero; no route blocks those requests",
    )
    return {
      status,
      cachedStatus,
      pendingSavePreserved: true,
      beforeWorkerUrls,
      afterWorkerUrls: context.serviceWorkers().map((worker) => worker.url()),
      providerPositiveControl: true,
      interceptedCommercialRequests: false,
      limitation:
        "No real account; hosted status, reload and pending-save subset only. Direct denied capabilities, schema100 migration and own login/permission/quota/gateway remain pending",
    }
  })
}

function parseNetlog(path) {
  if (!existsSync(path)) {
    evidence.limitations.push("Chromium startup netlog missing; cold-start gap is not covered")
    return
  }
  try {
    const log = JSON.parse(readFileSync(path, "utf8"))
    const types = Object.fromEntries(
      Object.entries(log.constants?.logSourceType ?? {}).map(([name, id]) => [id, name]),
    )
    const urls = new Map()
    for (const event of log.events ?? []) {
      const value = event.params?.url
      if (typeof value !== "string" || !/^https?:/.test(value)) continue
      const url = safeUrl(value)
      if (!urls.has(url))
        urls.set(url, {
          url,
          sourceType: types[event.source?.type] ?? event.source?.type,
          commercial: commercialUrl(value),
        })
    }
    evidence.startupNetlog = {
      captureMode: "Default",
      description:
        "Covers requests before Playwright launch returns; only redacted URL/source rows survive. Network headers and raw netlog are discarded with own temp profile.",
      urls: [...urls.values()],
    }
  } catch (error) {
    evidence.limitations.push(`Startup netlog could not be parsed: ${error.message}`)
  }
}

try {
  assert.ok(
    stages.size > 0 &&
      [...stages].every((stage) =>
        ["core", "glossary", "privacy", "iframe", "sites", "isolation"].includes(stage),
      ),
    "TEST_STAGES must be a nonempty comma-separated subset of core,glossary,privacy,iframe,sites,isolation",
  )
  const playwrightModule =
    process.env.PLAYWRIGHT_MODULE ??
    "/Users/yisen/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs"
  const { chromium } = await import(
    playwrightModule.startsWith("/") ? pathToFileURL(playwrightModule).href : playwrightModule
  )
  const executablePath = process.env.BROWSER_EXECUTABLE ?? chromium.executablePath()
  assert.ok(existsSync(executablePath), `Browser executable missing: ${executablePath}`)
  assert.ok(
    existsSync(join(extensionPath, "manifest.json")),
    `Build the frozen candidate first: ${extensionPath}/manifest.json`,
  )
  const manifest = JSON.parse(readFileSync(join(extensionPath, "manifest.json"), "utf8"))
  assert.equal(manifest.manifest_version, 3)
  const candidateSha = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: repo,
    encoding: "utf8",
  }).trim()
  evidence.identity = {
    candidateSha,
    candidateDirty:
      execFileSync("git", ["status", "--porcelain", "--untracked-files=no"], {
        cwd: repo,
        encoding: "utf8",
      }).trim().length > 0,
    targetSha: "55bcef1e684fb4e70f4dce3063e7bd3066f46891",
    buildEdition: process.env.BUILD_EDITION ?? "UNSPECIFIED",
    buildEnvironment: process.env.BUILD_ENVIRONMENT ?? "UNSPECIFIED",
    browserExecutable: executablePath,
    extensionPath,
    manifest: {
      name: manifest.name,
      version: manifest.version,
      manifestVersion: manifest.manifest_version,
      permissions: manifest.permissions,
      background: manifest.background,
    },
    manifestSha256: sha256(readFileSync(join(extensionPath, "manifest.json"))),
    artifact: digestArtifact(extensionPath),
  }
  configSchemaChunks = evidence.identity.artifact.files
    .filter(
      (file) =>
        file.path.startsWith("chunks/") &&
        file.path.endsWith(".js") &&
        readFileSync(join(extensionPath, file.path), "utf8").includes("Note suggestion action"),
    )
    .map((file) => file.path)
  assert.ok(configSchemaChunks.length > 0, "Candidate shared config-schema chunk is missing")
  if (process.argv.includes("--preflight")) {
    writeFileSync(
      1,
      `${JSON.stringify({ ...evidence.identity, artifact: { treeSha256: evidence.identity.artifact.treeSha256, fileCount: evidence.identity.artifact.files.length } }, null, 2)}\n`,
    )
    process.exit(0)
  }
  mkdirSync(output, { recursive: true })
  profile = mkdtempSync(join(tmpdir(), "translatebuff-v151-browser-"))
  await startServer()
  context = await chromium.launchPersistentContext(profile, {
    executablePath,
    headless: false,
    ignoreDefaultArgs: ["--disable-extensions"],
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true,
    args: [
      "--no-first-run",
      "--no-default-browser-check",
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      `--log-net-log=${join(profile, "startup-netlog.json")}`,
      "--net-log-capture-mode=Default",
    ],
  })
  evidence.identity.browserVersion = context.browser().version()
  evidence.identity.freshProfile = true
  await startNetworkCapture()
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
  const initial = await waitUntil(
    () =>
      popup.evaluate(async () => {
        const { config, configSchemaVersion } = await chrome.storage.local.get([
          "config",
          "configSchemaVersion",
        ])
        return config?.pageTranslation &&
          Array.isArray(config.providersConfig) &&
          config.selectionToolbar &&
          config.inputTranslation &&
          config.siteControl &&
          config.glossary
          ? {
              titleDefault: config.pageTranslation.page.translateTitle,
              schemaVersion: configSchemaVersion ?? config.schemaVersion ?? null,
              manifest: chrome.runtime.getManifest().version,
            }
          : null
      }),
    "fresh install worker completes full config",
    30000,
  )
  evidence.freshConfig = initial
  assert.equal(initial.titleDefault, true, "Fresh config must keep upstream translateTitle default")
  await updateConfig({
    language: { sourceCode: "eng", targetCode: "cmn" },
    providersConfig: [
      {
        id: providerId,
        name: "Controlled local browser provider",
        enabled: true,
        provider: "openai-compatible",
        baseURL: `${providerOrigin}/api/rpc`,
        apiKey: "browser-regression-local-only",
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
      requestQueueConfig: { capacity: 2, rate: 2 },
      batchQueueConfig: { maxItemsPerBatch: 8, maxCharactersPerBatch: 3000 },
    },
    selectionToolbar: {
      enabled: true,
      features: { translate: { enabled: true, providerId } },
      noteSuggestion: { enabled: false },
    },
    inputTranslation: { providerId },
    videoSubtitles: { providerId, autoStart: false },
    glossary: { enabled: true },
    siteControl: { mode: "blacklist", blacklistPatterns: [] },
  })
  await validateBuiltConfig()
  await screenshot(popup, "popup-fresh-config")
  for (const [stage, fn] of [
    ["core", core],
    ["glossary", glossary],
    ["privacy", privacy],
    ["iframe", iframe],
    ["sites", sites],
    ["isolation", isolation],
  ])
    if (stages.has(stage)) await fn()
  for (const [stage, id, description] of planned)
    if (!stages.has(stage))
      evidence.cases.push({
        id,
        status: "PENDING",
        reason: `Stage ${stage} was not requested`,
        description,
      })
  evidence.limitations.push(
    "Controlled translations prove execution and prompt transport, not translation quality or a live commercial model.",
    "Real React19/Lexical, long-page explicit AI action, live Google citation card, real YouTube subtitles/drag, own account and full migration/rollback are not covered by this run.",
    "Content-page requests use CDP initiators to distinguish isolated extension scripts where available. Attribution without an initiator stays unresolved and is not claimed as a content-script request.",
  )
} catch (error) {
  evidence.fatal = String(error?.stack ?? error)
  if (process.argv.includes("--preflight")) console.error(evidence.fatal)
  process.exitCode = 1
} finally {
  phase = "cleanup"
  if (context)
    await context
      .close()
      .catch((error) => evidence.errors.push({ source: "browser-close", error: error.message }))
  if (profile) parseNetlog(join(profile, "startup-netlog.json"))
  if (server)
    await new Promise((done) => {
      server.close(done)
      server.closeAllConnections()
    })
  if (profile) rmSync(profile, { recursive: true, force: true })
  if (evidence.identity?.artifact) {
    try {
      evidence.identity.artifactEndTreeSha256 = digestArtifact(extensionPath).treeSha256
    } catch (error) {
      evidence.errors.push({ source: "artifact-end-fingerprint", error: error.message })
    }
    evidence.identity.artifactUnchangedDuringRun =
      evidence.identity.artifactEndTreeSha256 === evidence.identity.artifact.treeSha256
    if (!evidence.identity.artifactUnchangedDuringRun) {
      evidence.limitations.push(
        "Extension artifact changed during the run; results do not bind one frozen artifact",
      )
      process.exitCode = 1
    }
  }
  evidence.completedAt = new Date().toISOString()
  evidence.networkSummary = {
    playwrightRequests: evidence.network.length,
    cdpRequests: evidence.cdp.length,
    contexts: [...new Set(evidence.network.map((request) => request.context))],
    commercial: [
      ...evidence.network,
      ...evidence.cdp,
      ...(evidence.startupNetlog?.urls ?? []),
    ].filter((request) => request.commercial),
    noCommercialRouteBlocking: true,
    providerRequests: evidence.providerRequests.length,
  }
  if (evidence.networkSummary.commercial.length) {
    evidence.isolationResult = "FAIL"
    process.exitCode = 1
  } else
    evidence.isolationResult =
      evidence.fatal || !evidence.startupNetlog
        ? "INCOMPLETE"
        : !stages.has("isolation")
          ? "ISOLATION_STAGE_NOT_EXECUTED"
          : !evidence.cases.some(
                (result) => result.id.startsWith("G5-") && result.status === "PASS",
              )
            ? "INCOMPLETE_SCENARIO_FAILURE"
            : "OBSERVED_ZERO_WITH_LIMITED_SCENARIOS"
  if (evidence.cases.some((result) => result.status === "FAIL")) process.exitCode = 1
  const coverageCases = {
    P01: ["P01-footnote"],
    P03: ["P03-dynamic-wrapper", "translation-only-restore"],
    P05: ["P05-isolated-value-reads"],
    P07: ["P07-wikipedia-fixture"],
    P08: ["P08-kaggle-fixture"],
    P10: ["P10-ar5iv-fixture"],
    P11: ["P11-iframe-trusted-gesture"],
    P12: ["P12-title"],
    P15: ["P15-body-replacement"],
  }
  evidence.productCoverage = Object.fromEntries(
    Array.from({ length: 15 }, (_, i) => {
      const id = `P${String(i + 1).padStart(2, "0")}`
      const results = (coverageCases[id] ?? [])
        .map((caseId) => evidence.cases.find((result) => result.id === caseId))
        .filter(Boolean)
      return [
        id,
        {
          status: results.some((result) => result.status === "FAIL")
            ? "FAIL"
            : results.some((result) => result.status === "PASS")
              ? "CONTROLLED_SUBSET_PASS"
              : "PENDING",
          cases: results.map(({ id: caseId, status }) => ({ id: caseId, status })),
          liveThirdPartySiteVerified: false,
        },
      ]
    }),
  )
  if (!process.argv.includes("--preflight")) {
    mkdirSync(output, { recursive: true })
    flushPartial()
    writeFileSync(join(output, "result.json"), `${JSON.stringify(evidence, null, 2)}\n`)
    console.log(
      JSON.stringify(
        {
          output,
          cases: evidence.cases.map(({ id, status }) => ({ id, status })),
          isolationResult: evidence.isolationResult,
          fatal: evidence.fatal,
        },
        null,
        2,
      ),
    )
  }
}
