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
import { fileURLToPath, pathToFileURL } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(process.env.TEST_REPO ?? join(here, "../../../../.."))
const extensionPath = resolve(process.env.EXTENSION_PATH ?? join(repo, ".output/chrome-mv3"))
const output = resolve(
  process.env.YOUTUBE_EVIDENCE_DIR ??
    join(here, "runs", new Date().toISOString().replaceAll(":", "-")),
)
const hash = (value) => createHash("sha256").update(value).digest("hex")
const sleep = (ms) => new Promise((done) => setTimeout(done, ms))
const videoId = "fixtureP09a1"
const watchUrl = `https://www.youtube.com/watch?v=${videoId}`
const providerId = "renyimiao-youtube-fixture-local"
const marker = "受控字幕译文："
const first = "The first automatic sentence remains visible for the entire declared cue duration."
const offsetFirst =
  "The next automatic sentence ends exactly where the following segment offset begins."
const offsetSecond =
  "The following automatic sentence remains visible until its native event duration ends."
const final = "The final automatic sentence retains its duration until the native event ends."
const timedtext = {
  events: [
    { tStartMs: 0, wWinId: 1, aAppend: 1, segs: [{ utf8: "\n" }] },
    { tStartMs: 1000, dDurationMs: 3000, wWinId: 1, segs: [{ utf8: first }] },
    {
      tStartMs: 5000,
      dDurationMs: 2000,
      wWinId: 1,
      segs: [
        { utf8: offsetFirst, tOffsetMs: 0 },
        { utf8: offsetSecond, tOffsetMs: 1000 },
      ],
    },
    { tStartMs: 9000, dDurationMs: 4000, wWinId: 1, segs: [{ utf8: final }] },
  ],
}
const evidence = {
  startedAt: new Date().toISOString(),
  fixture: true,
  cases: [],
  requests: [],
  network: [],
  cdp: [],
  errors: [],
  routeFulfilled: [],
  fixtureScope: {
    documentUrl: watchUrl,
    controlled: [
      "YouTube-shaped watch document and player public API",
      "JSON3 automatic captionTrack response",
      "locally recorded Canvas WebM",
      "localhost OpenAI-compatible provider",
      "native-menu z-order probe",
    ],
    actual: [
      "built extension MAIN interceptor bridge",
      "YouTube native adapter fetch/parser/optimizer",
      "HTMLVideoElement playback currentTime and timeupdate",
      "subtitles scheduler/translation queue/Shadow DOM",
      "trusted mouse and wheel input, browser pointer capture",
    ],
    notCovered: [
      "Live YouTube application or account",
      "Shorts, embedded, ads and SPA navigation",
      "Google signed URLs, PO tokens, DRM and network timing",
      "Complete cloud/commercial acceptance",
    ],
  },
}
let temp,
  context,
  server,
  popup,
  page,
  origin,
  media,
  phase = "preflight"

function safeUrl(value) {
  try {
    const url = new URL(value)
    return `${url.protocol}//${url.host}${url.pathname.replace(/(?:sk-[\w-]+|eyJ[\w.-]{20,})/g, "[redacted]")}`
  } catch {
    return "[unresolved]"
  }
}
function commercial(value) {
  try {
    const url = new URL(value)
    const stub = origin && url.origin === origin && url.pathname === "/api/rpc/chat/completions"
    return (
      (/\/api\/(identity|rpc|blog)(\/|$)/.test(url.pathname) && !stub) ||
      (/(^|\.)(readfrog\.app|read-frog\.com)$/.test(url.hostname) &&
        /hosted|subscription|billing|purchase|notebase|transcri/i.test(url.pathname)) ||
      (/^(?:www\.)?googleapis\.com$/.test(url.hostname) && url.pathname.includes("/drive/")) ||
      url.hostname === "oauth2.googleapis.com"
    )
  } catch {
    return false
  }
}
function artifactHash(directory) {
  const files = []
  function walk(current) {
    for (const name of readdirSync(current).sort()) {
      const full = join(current, name)
      if (statSync(full).isDirectory()) walk(full)
      else
        files.push({
          path: relative(directory, full),
          bytes: statSync(full).size,
          sha256: hash(readFileSync(full)),
        })
    }
  }
  walk(directory)
  return {
    algorithm:
      "SHA-256 of compact JSON.stringify(files); files are depth-first sorted by readdir names, each object has ordered keys path (relative), bytes, sha256. Same as browser-regression digestArtifact.",
    treeSha256: hash(JSON.stringify(files)),
    files,
  }
}
function flush() {
  mkdirSync(output, { recursive: true })
  writeFileSync(
    join(output, "partial-result.json"),
    `${JSON.stringify({ ...evidence, phase }, null, 2)}\n`,
  )
}
async function until(check, label, timeout = 20000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    const found = await check()
    if (found) return found
    await sleep(100)
  }
  throw new Error(`Timed out: ${label}`)
}
async function shot(name) {
  const path = join(output, `${name}.png`)
  await page.screenshot({ path, fullPage: true })
  return path
}
async function snapshot() {
  return page.evaluate(() => ({
    title: document.title,
    video: {
      time: document.querySelector("video")?.currentTime,
      paused: document.querySelector("video")?.paused,
      readyState: document.querySelector("video")?.readyState,
      duration: String(document.querySelector("video")?.duration),
    },
    overlay: document.querySelector("#read-frog-subtitles-ui-host")?.shadowRoot?.innerHTML,
    button: document.querySelector("#read-frog-subtitles-translate-button-container")?.shadowRoot
      ?.innerHTML,
    fixture: window.__youtubeFixture,
  }))
}
async function run(id, task) {
  phase = id
  const result = {
    id,
    status: "RUNNING",
    scope: "controlled YouTube watch fixture with actual extension and real media playback",
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
    result.screenshot = await shot(`${id}-failure`).catch(() => null)
    result.snapshot = await snapshot().catch(() => null)
  }
  result.completedAt = new Date().toISOString()
  console.log(`${id}: ${result.status}`)
  flush()
}
function playerHtml() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Controlled automatic subtitle duration fixture - YouTube</title><style>
  *{box-sizing:border-box}body{margin:28px;background:#101217;color:#e2e8f0;font:16px/1.6 system-ui}header{margin-bottom:14px}button{cursor:pointer}#movie_player{position:relative;width:960px;height:540px;background:#172032;overflow:hidden;margin-top:12px}video{position:absolute;inset:0;width:100%;height:100%;object-fit:fill}.ytp-chrome-bottom{position:absolute;bottom:0;left:0;right:0;height:48px;background:#0009;z-index:40;display:flex;justify-content:flex-end}.ytp-right-controls{height:48px;display:flex;align-items:center;padding-right:10px}.ytp-subtitles-button{height:32px}.ytp-caption-window-container{position:absolute;bottom:65px;left:20px;color:#aaa}.ytp-settings-menu{display:none;position:absolute;top:40px;right:16px;width:270px;height:360px;background:rebeccapurple;color:white;z-index:100;padding:16px;pointer-events:auto}#fixture-controls{display:flex;gap:12px}#fixture-status{color:#94a3b8;margin-top:12px}</style></head><body>
  <header>Controlled YouTube-shaped fixture · real extension and real video clock · no live YouTube account</header>
  <div id="fixture-controls"><button type="button" id="fixture-play">Play actual media</button><button type="button" id="fixture-pause">Pause actual media</button></div>
  <div id="movie_player" class="html5-video-player paused-mode"><video class="html5-main-video" muted playsinline preload="auto" src="/controlled-video.webm"></video><div class="ytp-caption-window-container">Controlled native captions layer</div><div class="ytp-chrome-bottom"><div class="ytp-right-controls"><button type="button" class="ytp-subtitles-button" aria-pressed="true">CC</button></div></div><div class="ytp-settings-menu">Controlled native player menu z-index probe</div></div>
  <div id="fixture-status">Automatic track: asr / English · controlled JSON3 single and offset segments</div><script src="/controlled-player.js"></script></body></html>`
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
    if (req.method === "POST" && req.url === "/api/rpc/chat/completions") {
      try {
        const chunks = []
        for await (const chunk of req) chunks.push(chunk)
        const body = JSON.parse(Buffer.concat(chunks).toString("utf8"))
        const input = (body.messages ?? [])
          .filter((row) => row.role === "user")
          .map((row) =>
            typeof row.content === "string"
              ? row.content
              : row.content.map((part) => part.text ?? "").join("\n"),
          )
          .join("\n")
        const sourceText = input.replace(/^Translate to[^:]*:\s*/i, "")
        const content = sourceText.startsWith('{"t0"')
          ? JSON.stringify(
              Object.fromEntries(
                Object.entries(JSON.parse(sourceText)).map(([key, value]) => [
                  key,
                  `${marker}${value}`,
                ]),
              ),
            )
          : sourceText
              .split("\n\n%%\n\n")
              .map((line) => `${marker}${line}`)
              .join("\n\n%%\n\n")
        evidence.requests.push({
          phase,
          model: body.model,
          stream: Boolean(body.stream),
          input,
          content,
          bodySha256: hash(JSON.stringify(body)),
        })
        flush()
        await sleep(150)
        const base = {
          id: `chatcmpl-${randomUUID()}`,
          created: Math.floor(Date.now() / 1000),
          model: body.model,
        }
        if (body.stream) {
          res.writeHead(200, { "content-type": "text/event-stream" })
          res.end(
            `data: ${JSON.stringify({ ...base, object: "chat.completion.chunk", choices: [{ index: 0, delta: { role: "assistant", content }, finish_reason: null }] })}\n\ndata: ${JSON.stringify({ ...base, object: "chat.completion.chunk", choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`,
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
        evidence.errors.push({ source: "controlled-provider", error: error.message })
        res
          .writeHead(400)
          .end(JSON.stringify({ error: { message: "Controlled fixture request decode failed" } }))
      }
      return
    }
    res.writeHead(404).end()
  })
  await new Promise((done, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", done)
  })
  origin = `http://127.0.0.1:${server.address().port}`
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
      frame: frameUrl ? safeUrl(frameUrl) : undefined,
      worker: workerUrl ? safeUrl(workerUrl) : undefined,
      commercial: commercial(request.url()),
    })
  })
  async function attachCdp(targetPage) {
    targetPage.on("pageerror", (error) =>
      evidence.errors.push({ phase, source: "page", error: error.message }),
    )
    const session = await context.newCDPSession(targetPage)
    session.on("Network.requestWillBeSent", (event) => {
      const frames = event.initiator?.stack?.callFrames ?? []
      evidence.cdp.push({
        phase,
        method: event.request.method,
        url: safeUrl(event.request.url),
        target: safeUrl(targetPage.url()),
        type: event.initiator?.type,
        stack: frames.slice(0, 8).map((frame) => ({
          url: safeUrl(frame.url),
          name: frame.functionName,
          line: frame.lineNumber,
        })),
        context: targetPage.url().startsWith("chrome-extension:")
          ? "extension-page"
          : frames.some((frame) => frame.url.startsWith("chrome-extension:"))
            ? "content-script"
            : "page-or-unresolved",
        commercial: commercial(event.request.url),
      })
    })
    await session.send("Network.enable")
  }
  context.on(
    "page",
    (targetPage) =>
      void attachCdp(targetPage).catch((error) =>
        evidence.errors.push({ source: "cdp", error: error.message }),
      ),
  )
  for (const currentPage of context.pages()) await attachCdp(currentPage)
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
        Boolean((await chrome.storage.local.get("config")).config?.videoSubtitles),
      ),
    "complete initial config",
  )
  evidence.config = await popup.evaluate(
    async ({ provider, baseURL, chunks }) => {
      const { config } = await chrome.storage.local.get("config")
      config.providersConfig = [
        ...config.providersConfig.filter((row) => row.id !== provider),
        {
          id: provider,
          name: "Controlled YouTube localhost provider",
          provider: "openai-compatible",
          enabled: true,
          apiKey: "youtube-fixture-only-dummy",
          baseURL,
          model: {
            model: "use-custom-model",
            isCustomModel: true,
            customModel: "controlled-youtube-model",
          },
        },
      ]
      config.language = { ...config.language, sourceCode: "eng", targetCode: "cmn" }
      config.uiLanguage = "en"
      config.pageTranslation = {
        ...config.pageTranslation,
        providerId: provider,
        enableAIContentAware: false,
      }
      config.videoSubtitles = {
        ...config.videoSubtitles,
        enabled: true,
        autoStart: false,
        providerId: provider,
        aiSegmentation: false,
        style: { ...config.videoSubtitles.style, displayMode: "bilingual" },
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
          providerId: parsed.data.videoSubtitles.providerId,
          aiSegmentation: parsed.data.videoSubtitles.aiSegmentation,
          autoStart: parsed.data.videoSubtitles.autoStart,
        }
      }
      throw new Error("Actual built schema not found")
    },
    { provider: providerId, baseURL: `${origin}/api/rpc`, chunks: schemaChunks },
  )
  assert.ok(evidence.config.success, JSON.stringify(evidence.config))
  flush()
}
async function createMedia() {
  phase = "actual-media-recording"
  const generator = await context.newPage()
  const recording = await generator.evaluate(async () => {
    const canvas = document.createElement("canvas")
    canvas.width = 640
    canvas.height = 360
    document.body.append(canvas)
    const graphics = canvas.getContext("2d")
    const stream = canvas.captureStream(10)
    const recorder = new MediaRecorder(stream, {
      mimeType: "video/webm;codecs=vp8",
      videoBitsPerSecond: 160000,
    })
    const chunks = []
    recorder.addEventListener("dataavailable", (event) => chunks.push(event.data))
    const start = performance.now()
    const draw = setInterval(() => {
      graphics.fillStyle = "#172032"
      graphics.fillRect(0, 0, 640, 360)
      graphics.fillStyle = "#d7e9ff"
      graphics.font = "24px sans-serif"
      graphics.fillText("Actual locally recorded video", 28, 80)
      graphics.fillText(`${((performance.now() - start) / 1000).toFixed(1)} seconds`, 28, 125)
    }, 80)
    recorder.start(1000)
    await new Promise((done) => setTimeout(done, 16000))
    await new Promise((done) => {
      recorder.addEventListener("stop", done, { once: true })
      recorder.stop()
    })
    clearInterval(draw)
    for (const track of stream.getTracks()) track.stop()
    const blob = new Blob(chunks, { type: recorder.mimeType })
    const data = await new Promise((done) => {
      const reader = new FileReader()
      reader.onload = () => done(reader.result)
      reader.readAsDataURL(blob)
    })
    return { data, mime: recorder.mimeType, recordedWallMs: performance.now() - start }
  })
  media = Buffer.from(recording.data.split(",")[1], "base64")
  evidence.media = {
    generator: "actual Chrome Canvas captureStream + MediaRecorder VP8",
    mime: recording.mime,
    recordedWallMs: recording.recordedWallMs,
    bytes: media.length,
    sha256: hash(media),
  }
  await generator.close()
  flush()
}
async function routeFixtures() {
  await context.route("https://www.youtube.com/**", async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    let kind
    if (url.pathname === "/watch" && url.searchParams.get("v") === videoId) {
      kind = "controlled-watch-document"
      await route.fulfill({
        status: 200,
        contentType: "text/html; charset=utf-8",
        body: playerHtml(),
      })
    } else if (url.pathname === "/controlled-player.js") {
      kind = "controlled-player-public-api"
      await route.fulfill({
        status: 200,
        contentType: "text/javascript",
        body: readFileSync(join(here, "player-fixture.js")),
      })
    } else if (url.pathname === "/controlled-video.webm") {
      kind = "actual-recorded-media"
      const range = request.headers().range?.match(/bytes=(\d+)-(\d*)/)
      const startByte = range ? Number(range[1]) : 0
      const endByte = range?.[2] ? Math.min(Number(range[2]), media.length - 1) : media.length - 1
      await route.fulfill({
        status: range ? 206 : 200,
        headers: {
          "content-type": "video/webm",
          "accept-ranges": "bytes",
          "content-length": String(endByte - startByte + 1),
          ...(range ? { "content-range": `bytes ${startByte}-${endByte}/${media.length}` } : {}),
        },
        body: media.subarray(startByte, endByte + 1),
      })
    } else if (url.pathname === "/api/timedtext" && url.searchParams.get("v") === videoId) {
      kind = "controlled-native-asr-json3"
      evidence.timedtextRequests ??= []
      evidence.timedtextRequests.push({
        phase,
        fmt: url.searchParams.get("fmt"),
        kind: url.searchParams.get("kind"),
        language: url.searchParams.get("lang"),
        source: safeUrl(request.url()),
        responseSha256: hash(JSON.stringify(timedtext)),
      })
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(timedtext),
      })
    } else {
      await route.continue()
      return
    }
    evidence.routeFulfilled.push({ phase, url: safeUrl(request.url()), kind })
  })
}
async function dragBy(delta) {
  const handle = page.locator("#read-frog-subtitles-ui-host .cursor-grab")
  const rect = await handle.boundingBox()
  assert.ok(rect)
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2)
  await page.mouse.down()
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2 + delta, { steps: 12 })
  await page.mouse.up()
  await sleep(450)
}
async function subtitleTop() {
  return page
    .locator("#read-frog-subtitles-ui-host .read-frog-subtitles-box")
    .evaluate((element) => element.getBoundingClientRect().top)
}

try {
  temp = mkdtempSync(join(tmpdir(), "translatebuff-youtube-fixture-"))
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
    buildEdition: process.env.BUILD_EDITION ?? "UNSPECIFIED",
    buildEnvironment: process.env.BUILD_ENVIRONMENT ?? "UNSPECIFIED",
    manifest: {
      name: manifest.name,
      version: manifest.version,
      manifestVersion: manifest.manifest_version,
    },
    manifestSha256: hash(readFileSync(manifestPath)),
    artifact: artifactHash(extensionPath),
    harnessSha256: hash(readFileSync(fileURLToPath(import.meta.url))),
    playerFixtureSha256: hash(readFileSync(join(here, "player-fixture.js"))),
  }
  const { chromium } = await import(
    pathToFileURL(
      process.env.PLAYWRIGHT_MODULE ??
        "/Users/yisen/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs",
    ).href
  )
  await serve()
  context = await chromium.launchPersistentContext(join(temp, "profile"), {
    executablePath: process.env.BROWSER_EXECUTABLE ?? chromium.executablePath(),
    headless: false,
    ignoreDefaultArgs: ["--disable-extensions"],
    viewport: { width: 1320, height: 900 },
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
    context.serviceWorkers().find((candidate) => candidate.url().startsWith("chrome-extension:")) ??
    (await context.waitForEvent("serviceworker", { timeout: 30000 }))
  const extensionId = new URL(worker.url()).hostname
  evidence.identity.extensionId = extensionId
  popup = await context.newPage()
  await popup.goto(`chrome-extension://${extensionId}/popup.html`)
  await installConfig()
  await createMedia()
  await routeFixtures()
  page = await context.newPage()
  await run("P09-native-automatic-cue-duration", async () => {
    await page.goto(watchUrl)
    await until(
      () =>
        page.evaluate(
          () => window.__youtubeFixture?.ready && document.querySelector("video").readyState >= 2,
        ),
      "actual media ready",
    )
    const panelButton = page.getByRole("button", {
      name: "Subtitle Translation Panel",
      exact: true,
    })
    await panelButton.click()
    await page.getByRole("switch", { name: "TranslateBuff Video Subtitles", exact: true }).click()
    await panelButton.click()
    await until(
      () => Boolean(evidence.timedtextRequests?.length),
      "native adapter actual timedtext fetch",
    )
    await page.evaluate(() => window.__youtubeFixture.beginSamples())
    await page.locator("#fixture-play").click()
    await until(
      () => page.evaluate(() => document.querySelector("video").currentTime >= 13.65),
      "actual video plays through native cue duration",
      23000,
    )
    await page.locator("#fixture-pause").click()
    await page.evaluate(() => window.__youtubeFixture.endSamples())
    const state = await snapshot()
    evidence.p09 = {
      samples: state.fixture.samples,
      mediaEvents: state.fixture.mediaEvents,
      bridgeMessages: state.fixture.bridgeMessages,
      playerCalls: state.fixture.playerCalls,
    }
    flush()
    const checks = [
      { name: "single-segment survives 200ms estimate", from: 1.6, to: 2.3, text: first },
      { name: "single-segment persists near declared end", from: 3.3, to: 3.8, text: first },
      { name: "first event end creates empty gap", from: 4.35, to: 4.8, text: "" },
      {
        name: "next segment offset owns preceding sentence",
        from: 5.4,
        to: 5.8,
        text: offsetFirst,
      },
      { name: "following segment owns event remainder", from: 6.4, to: 6.8, text: offsetSecond },
      { name: "second event end creates empty gap", from: 7.35, to: 8.0, text: "" },
      {
        name: "final single segment persists near declared end",
        from: 12.2,
        to: 12.7,
        text: final,
      },
      { name: "final event expires at declared end", from: 13.3, to: 13.6, text: "" },
    ]
    for (const check of checks) {
      const samples = state.fixture.samples.filter(
        (sample) => sample.time >= check.from && sample.time <= check.to,
      )
      assert.ok(samples.length >= 2, `${check.name}: real media samples missing`)
      assert.ok(
        samples.every((sample) => sample.original === check.text),
        `${check.name}: ${JSON.stringify(samples)}`,
      )
      if (check.text)
        assert.ok(
          samples.some((sample) => sample.translation.includes(marker)),
          `${check.name}: actual local translation not visible`,
        )
    }
    assert.ok(state.fixture.mediaEvents.filter((event) => event.type === "timeupdate").length >= 30)
    assert.ok(
      state.fixture.bridgeMessages.some(
        (message) =>
          message.type === "READ_FROG_PLAYER_DATA" &&
          message.success &&
          message.tracks?.some((track) => track.kind === "asr"),
      ),
    )
    assert.ok(
      evidence.timedtextRequests.every(
        (request) => request.fmt === "json3" && request.kind === "asr",
      ),
    )
    assert.ok(evidence.requests.some((request) => request.input.includes(first)))
    await page.evaluate(() => {
      document.querySelector("video").currentTime = 3.5
    })
    await page
      .locator("#read-frog-subtitles-ui-host .subtitles-main")
      .filter({ hasText: first })
      .waitFor({ state: "visible" })
    await shot("P09-real-video-near-end")
    return {
      checks,
      samples: state.fixture.samples.length,
      timeupdates: state.fixture.mediaEvents.filter((event) => event.type === "timeupdate").length,
      actualTimedtextRequests: evidence.timedtextRequests.length,
      providerRequests: evidence.requests.length,
      screenshot: join(output, "P09-real-video-near-end.png"),
    }
  })
  await run("P13-pointercapture-menu", async () => {
    await page.evaluate(() => {
      const video = document.querySelector("video")
      video.pause()
      video.currentTime = 2.5
    })
    const original = page
      .locator("#read-frog-subtitles-ui-host .subtitles-main")
      .filter({ hasText: first })
    await original.waitFor({ state: "visible", timeout: 20000 })
    await page.evaluate(() => window.__youtubeFixture.observeHandle())
    const before = await subtitleTop()
    const eventBaseline = await page.evaluate(() => window.__youtubeFixture.playerEvents.length)
    await dragBy(-90)
    const after = await subtitleTop()
    assert.ok(before - after > 60, "Trusted mouse drag must visibly move subtitles")
    const handle = page.locator("#read-frog-subtitles-ui-host .cursor-grab")
    const box = await handle.boundingBox()
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - 40, { steps: 6 })
    const captured = await handle.evaluate((element) =>
      element.hasPointerCapture(window.__youtubeFixture.lastPointerId),
    )
    assert.equal(captured, true, "Actual browser pointer capture must be active")
    const previousLossCount = await page.evaluate(
      () =>
        window.__youtubeFixture.pointerEvents.filter((event) => event.type === "lostpointercapture")
          .length,
    )
    await handle.evaluate((element) =>
      element.releasePointerCapture(window.__youtubeFixture.lastPointerId),
    )
    await until(
      () =>
        page.evaluate(
          (lossCount) =>
            window.__youtubeFixture.pointerEvents.filter(
              (event) => event.type === "lostpointercapture",
            ).length > lossCount,
          previousLossCount,
        ),
      "browser lostpointercapture",
    )
    await sleep(350)
    const releasedTop = await subtitleTop()
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - 110, { steps: 8 })
    await sleep(350)
    const afterLostMove = await subtitleTop()
    await page.mouse.up()
    assert.ok(
      Math.abs(afterLostMove - releasedTop) < 3,
      "Lost capture must end drag before subsequent movement",
    )
    await dragBy(45)
    const restartedTop = await subtitleTop()
    assert.ok(restartedTop - afterLostMove > 25, "New trusted drag after capture loss must work")
    await page.locator("#read-frog-subtitles-ui-host .read-frog-subtitles-box").click()
    const leaked = await page.evaluate(
      (baseline) => window.__youtubeFixture.playerEvents.slice(baseline),
      eventBaseline,
    )
    assert.deepEqual(
      leaked,
      [],
      "Subtitle drag, capture loss and text click must not reach player handlers",
    )
    const pointers = await page.evaluate(() => window.__youtubeFixture.pointerEvents)
    assert.ok(pointers.filter((event) => event.type === "pointerdown").length >= 3)
    assert.ok(
      pointers.every((event) => event.trusted),
      "Pointer evidence must come from trusted browser events",
    )
    await shot("P13-trusted-drag-after-capture-loss")
    const panelButton = page.getByRole("button", {
      name: "Subtitle Translation Panel",
      exact: true,
    })
    await panelButton.click()
    const menu = page.locator("#read-frog-subtitles-ui-host [data-slot='subtitles-settings-panel']")
    await menu.waitFor({ state: "visible" })
    const mainMenuText = await menu.innerText()
    assert.ok(
      !/AI subtitles|AI smart segmentation|Video summary/i.test(mainMenuText),
      "Cloud-only affordances must stay unavailable without suppressing native subtitles",
    )
    await page.getByRole("button", { name: "Subtitle style", exact: true }).click()
    const styleText = await menu.innerText()
    const playerRect = await page.locator("#movie_player").boundingBox()
    const menuRect = await menu.boundingBox()
    assert.ok(
      menuRect.x >= playerRect.x &&
        menuRect.y >= playerRect.y &&
        menuRect.x + menuRect.width <= playerRect.x + playerRect.width + 1 &&
        menuRect.y + menuRect.height <= playerRect.y + playerRect.height + 1,
      "Long menu must remain inside actual video bounds",
    )
    const scroll = menu.locator(".overflow-y-auto")
    const scrollBefore = await scroll.evaluate((element) => ({
      top: element.scrollTop,
      height: element.clientHeight,
      total: element.scrollHeight,
    }))
    assert.ok(
      scrollBefore.total > scrollBefore.height,
      "Actual style menu must be long enough to exercise clipping",
    )
    const menuBaseline = await page.evaluate(() => window.__youtubeFixture.playerEvents.length)
    const scrollBox = await scroll.boundingBox()
    await page.mouse.move(scrollBox.x + scrollBox.width / 2, scrollBox.y + scrollBox.height / 2)
    await page.mouse.wheel(0, 900)
    await sleep(350)
    const scrollAfter = await scroll.evaluate((element) => element.scrollTop)
    assert.ok(scrollAfter > 0, "Trusted wheel must access long menu content")
    await page.mouse.wheel(0, -1000)
    await sleep(350)
    const modeTrigger = menu.locator("[data-slot='select-trigger']").first()
    await modeTrigger.click()
    const originalOption = page.getByRole("option", { name: "Original only", exact: true })
    await originalOption.click()
    assert.ok(await menu.isVisible(), "Portalled select must leave the menu open and usable")
    assert.equal(
      await popup.evaluate(
        async () =>
          (await chrome.storage.local.get("config")).config.videoSubtitles.style.displayMode,
      ),
      "originalOnly",
    )
    await modeTrigger.click()
    await page.getByRole("option", { name: "Bilingual", exact: true }).click()
    const menuLeaks = await page.evaluate(
      (baseline) => window.__youtubeFixture.playerEvents.slice(baseline),
      menuBaseline,
    )
    assert.deepEqual(menuLeaks, [], "Menu wheel and select clicks must not reach player handlers")
    await sleep(350)
    await page.evaluate(() => {
      document.querySelector(".ytp-settings-menu").style.display = "block"
    })
    const stacking = await page.evaluate(() => {
      const host = document.querySelector("#read-frog-subtitles-ui-host")
      const nativeMenu = document.querySelector(".ytp-settings-menu")
      const panel = host.shadowRoot.querySelector("[data-slot='subtitles-settings-panel']")
      const nativeBounds = nativeMenu.getBoundingClientRect(),
        panelBounds = panel.getBoundingClientRect()
      const x = Math.max(nativeBounds.left, panelBounds.left) + 15,
        y = Math.max(nativeBounds.top, panelBounds.top) + 15
      return {
        hostZ: getComputedStyle(host).zIndex,
        nativeZ: getComputedStyle(nativeMenu).zIndex,
        overlap:
          x < Math.min(nativeBounds.right, panelBounds.right) &&
          y < Math.min(nativeBounds.bottom, panelBounds.bottom),
        hitNative: document.elementFromPoint(x, y) === nativeMenu,
      }
    })
    assert.ok(
      Number(stacking.nativeZ) > Number(stacking.hostZ) && stacking.overlap && stacking.hitNative,
      "Player native-menu probe must actually stack above subtitle menu",
    )
    await shot("P13-native-menu-above-subtitles-menu")
    await page.evaluate(() => {
      document.querySelector(".ytp-settings-menu").style.display = "none"
    })
    await shot("P13-long-menu-within-player")
    evidence.p13 = {
      before,
      after,
      releasedTop,
      afterLostMove,
      restartedTop,
      pointers,
      leaked,
      mainMenuText,
      styleText,
      playerRect,
      menuRect,
      scrollBefore,
      scrollAfter,
      menuLeaks,
      stacking,
    }
    return evidence.p13
  })
} catch (error) {
  evidence.fatal = String(error.stack ?? error)
  console.error(evidence.fatal)
  process.exitCode = 1
} finally {
  if (context)
    await context
      .close()
      .catch((error) => evidence.errors.push({ source: "browser-close", error: error.message }))
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
      ].map((url) => ({ url: safeUrl(url), commercial: commercial(url) }))
    } catch (error) {
      evidence.errors.push({ source: "netlog", error: error.message })
    }
  }
  if (evidence.identity) {
    evidence.identity.endArtifactSha256 = artifactHash(extensionPath).treeSha256
    evidence.identity.artifactUnchanged =
      evidence.identity.endArtifactSha256 === evidence.identity.artifact.treeSha256
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
    noCommercialBlocking: true,
    serviceWorkerPlaywright: true,
    pageCdpInitiators: true,
    directWorkerCdp: false,
    defaultNetlogStartupUrls: true,
  }
  if (
    evidence.cases.some((result) => result.status !== "PASS") ||
    evidence.commercialRequests.length
  )
    process.exitCode = 1
  flush()
  writeFileSync(join(output, "result.json"), `${JSON.stringify(evidence, null, 2)}\n`)
  console.log(
    JSON.stringify(
      {
        output,
        cases: evidence.cases.map(({ id, status }) => ({ id, status })),
        fatal: evidence.fatal,
        commercialRequests: evidence.commercialRequests.length,
      },
      null,
      2,
    ),
  )
}
