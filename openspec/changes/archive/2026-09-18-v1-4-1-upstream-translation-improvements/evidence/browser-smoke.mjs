import { mkdtempSync, writeFileSync } from "node:fs"
import { createServer } from "node:http"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { chromium } from "file:///C:/Users/susu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs"

const evidence = resolve("openspec/changes/v1-4-1-upstream-translation-improvements/evidence")
const profile = mkdtempSync(join(tmpdir(), "translatebuff-upstream-browser-"))
const server = createServer((_req, res) => {
  res.setHeader("content-type", "text/html; charset=utf-8")
  res.end(`<!doctype html><html><head><title>Translation fixture</title></head><body>
    <main><h1>Formula translation</h1><p id="formula">The energy is <math><mi>E</mi><mo>=</mo><mi>m</mi><msup><mi>c</mi><mn>2</mn></msup></math> in this example.</p>
    <div id="carousel" style="width:500px;height:180px;touch-action:manipulation;background:#ddd">Drag this carousel</div>
    <button id="click">Page click</button><output id="count">0</output></main>
    <script>let count=0;document.querySelector('#click').onclick=()=>document.querySelector('#count').textContent=++count;window.events=[];for(const t of ['pointerdown','pointermove','pointerup','pointercancel'])document.querySelector('#carousel').addEventListener(t,e=>events.push(e.type));</script>
  </body></html>`)
})
await new Promise((done) => server.listen(0, "127.0.0.1", done))
const context = await chromium.launchPersistentContext(profile, {
  executablePath:
    process.env.TEST_BROWSER ??
    "C:/Users/susu/AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe",
  ignoreDefaultArgs: ["--disable-extensions"],
  headless: true,
  viewport: { width: 1280, height: 900 },
  hasTouch: true,
  args: [
    `--disable-extensions-except=${resolve(".output/chrome-mv3")}`,
    `--load-extension=${resolve(".output/chrome-mv3")}`,
  ],
})
try {
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"))
  const id = new URL(worker.url()).host
  const popup = await context.newPage()
  await popup.goto(`chrome-extension://${id}/popup.html`)
  await popup.waitForTimeout(4000)
  const configInfo = await popup.evaluate(async () => {
    const { config } = await chrome.storage.local.get("config")
    return {
      exists: !!config,
      keys: Object.keys(config ?? {}),
      providers: config?.providersConfig?.map((p) => ({
        id: p.id,
        provider: p.provider,
        enabled: p.enabled,
      })),
    }
  })
  const page = await context.newPage()
  const errors = []
  page.on("pageerror", (e) => errors.push(e.message))
  await page.goto(`http://127.0.0.1:${server.address().port}`)
  await page.waitForTimeout(1500)
  await page.locator("#click").click()
  const initial = await page.evaluate(() => {
    const all = (root) =>
      [...root.querySelectorAll("*")].flatMap((e) => [
        e,
        ...(e.shadowRoot ? all(e.shadowRoot) : []),
      ])
    return {
      clickCount: document.querySelector("#count").textContent,
      overlays: all(document)
        .filter((e) => e.hasAttribute("data-rf-selection-overlay-root"))
        .map((e) => ({
          width: e.getBoundingClientRect().width,
          height: e.getBoundingClientRect().height,
        })),
      floating: all(document)
        .filter((e) => e.getAttribute("data-testid") === "floating-button-container")
        .map((e) => ({ pointerEvents: getComputedStyle(e).pointerEvents })),
      math: document.querySelectorAll("math").length,
    }
  })
  const cdp = await context.newCDPSession(page)
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: 400, y: 190 }],
  })
  for (let x = 390; x >= 190; x -= 20)
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: 190 }] })
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
  const events = await page.evaluate(() => window.events)
  await page.screenshot({ path: join(evidence, "browser-fixture.png") })
  const options = await context.newPage()
  await options.goto(`chrome-extension://${id}/options.html`)
  await options.waitForTimeout(1000)
  await options.screenshot({ path: join(evidence, "browser-options.png") })
  const result = {
    browser: await context.browser()?.version(),
    profile,
    extensionId: id,
    configInfo,
    initial,
    events,
    errors,
    optionsTitle: await options.title(),
  }
  writeFileSync(join(evidence, "browser-smoke.json"), JSON.stringify(result, null, 2))
  console.log(JSON.stringify(result, null, 2))
} finally {
  await context.close()
  server.close()
}
