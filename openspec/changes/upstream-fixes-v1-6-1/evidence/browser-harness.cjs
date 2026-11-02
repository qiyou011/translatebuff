const fs = require("node:fs")
const http = require("node:http")
const path = require("node:path")
const assert = require("node:assert/strict")
const puppeteer = require("puppeteer-core")
const root = "D:/project/translatebuff"
const evidence = path.join(root, "openspec/changes/upstream-fixes-v1-6-1/evidence")
const requests = [],
  results = [],
  errors = [],
  forbidden = []
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const translated = (text) =>
  text
    .split(/(<[^>]*>|\{\{\d+\}\})/g)
    .map((part) =>
      part.startsWith("<") || part.startsWith("{{")
        ? part
        : part.replace(/[A-Za-z]+(?:[ \t]+[A-Za-z]+)*/g, "已译正文"),
    )
    .join("")
const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Headers", "*")
  if (req.method === "OPTIONS") {
    res.writeHead(204)
    res.end()
    return
  }
  let body = ""
  for await (const chunk of req) body += chunk
  if (!req.url.includes("/chat/completions")) {
    res.writeHead(404)
    res.end()
    return
  }
  const payload = JSON.parse(body)
  const prompt = payload.messages.at(-1).content
  const start = prompt.indexOf('{"t0"')
  let output
  if (start >= 0) {
    const input = JSON.parse(prompt.slice(start, prompt.lastIndexOf("}") + 1))
    output = JSON.stringify(
      Object.fromEntries(Object.entries(input).map(([key, value]) => [key, translated(value)])),
    )
    requests.push({ items: Object.keys(input).length, input })
  } else {
    output = translated(prompt.split(/Translate to[^:]*:\s*/).at(-1))
    requests.push({ items: 1, individual: true })
  }
  res.setHeader("content-type", "application/json")
  res.end(
    JSON.stringify({
      id: "fixture",
      object: "chat.completion",
      created: 1,
      model: "fixture",
      choices: [
        { index: 0, message: { role: "assistant", content: output }, finish_reason: "stop" },
      ],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    }),
  )
})
const fixtures = {
  "https://arxiv.org/html/upstream-fixes-fixture":
    '<main id="main"><svg class="ltx_picture" width="550" height="357"><path fill="#f3f8fa" d="M0 0H550V357H0Z"></path><foreignObject><span class="ltx_foreignobject_container"><span class="ltx_foreignobject_content"><span class="ltx_p">An abstract readers must be able to translate.</span></span></span></foreignObject></svg></main>',
  "https://github.com/upstream-fixture/issues":
    '<main><a data-testid="issue-pr-title-link">The new issue title should translate correctly.</a><div data-testid="list-row-repo-name-and-number">Repository number must stay original</div></main>',
  "https://web.telegram.org/upstream-fixture":
    '<main><div style="display:contents"><span id="boxless">This message belongs to a boxless container with a child layout box.</span></div></main>',
  "https://www.thenorthfacekorea.co.kr/upstream-fixture":
    '<style>.twoDepth_wrap{display:none}.twoDepth_hover:hover .twoDepth_wrap{display:block}</style><main class="header-gnb"><div class="onedepth twoDepth_hover" style="width:600px;min-height:60px">Open menu<div class="twoDepth_wrap"><p id="menu-text">The hidden product menu opens with CSS hover alone.</p></div></div></main>',
  "https://gamefaqs.gamespot.com/game/faqs/upstream-fixture":
    '<main id="faqtext"><pre id="faqspan-1">The first paragraph explains how to play this adventure.\n\nThe second paragraph describes where the hero should travel.</pre></main>',
  "http://localhost:8931/selection":
    '<main id="main"><p id="ruby"><ruby>Tokyo<rt>pronunciation</rt></ruby><br>Another selected sentence.</p><p id="plain">A fresh selection remains possible after closing a card.</p></main>',
}
const html = (body) =>
  '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Upstream fixture</title><style>body{font:18px sans-serif;padding:30px;line-height:1.6}</style></head><body>' +
  body +
  "</body></html>"
async function main() {
  await new Promise((resolve) => server.listen(8931, "127.0.0.1", resolve))
  const browser = await puppeteer.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: false,
    pipe: true,
    enableExtensions: true,
    args: ["--no-first-run", "--window-size=1200,900"],
  })
  try {
    const extensionId = await browser.installExtension(path.join(root, ".output/chrome-mv3"))
    let target
    for (let i = 0; i < 60; i++) {
      target = browser
        .targets()
        .find(
          (t) =>
            t.type() === "service_worker" &&
            t.url().startsWith("chrome-extension://" + extensionId),
        )
      if (target) break
      await sleep(250)
    }
    assert(target, "service worker present")
    const worker = await target.worker()
    const network = await target.createCDPSession()
    await network.send("Network.enable")
    network.on("Network.requestWillBeSent", (e) => {
      if (/api\.readfrog\.app|notebase|convex\.cloud|jalapenocloud\.com/.test(e.request.url))
        forbidden.push(e.request.url)
    })
    const patch = () =>
      worker.evaluate(async () => {
        const { config } = await chrome.storage.local.get("config")
        if (!config) return null
        config.language.targetCode = "cmn"
        config.language.sourceCode = "auto"
        config.pageTranslation.providerId = "fixture-local"
        config.pageTranslation.mode = "translationOnly"
        config.pageTranslation.page.autoTranslatePatterns = []
        config.pageTranslation.page.enableTargetLanguageSkip = false
        config.pageTranslation.page.translateTitle = false
        config.providersConfig = config.providersConfig.filter((p) => p.id !== "fixture-local")
        config.providersConfig.push({
          id: "fixture-local",
          name: "Local verification fixture",
          provider: "openai-compatible",
          enabled: true,
          apiKey: "fixture-only",
          baseURL: "http://127.0.0.1:8931/v1",
          model: { model: "use-custom-model", isCustomModel: true, customModel: "fixture" },
        })
        await chrome.storage.local.set({ config })
        return {
          mode: config.pageTranslation.mode,
          provider: config.pageTranslation.providerId,
          target: config.language.targetCode,
        }
      })
    for (let i = 0; i < 20; i++) {
      if (await patch()) break
      await sleep(250)
    }
    await sleep(4200)
    const config = await patch()
    console.log("CONFIG", config)
    const page = await browser.newPage()
    await page.setViewport({ width: 1200, height: 850 })
    page.on("pageerror", (e) => errors.push(String(e)))
    page.on("console", (e) => {
      if (/Minified React error|NotFoundError/.test(e.text())) errors.push(e.text())
    })
    await page.setRequestInterception(true)
    page.on("request", (request) => {
      const body = fixtures[request.url()]
      if (body && request.isNavigationRequest())
        request.respond({ status: 200, contentType: "text/html", body: html(body) })
      else if (request.url().includes("favicon.ico")) request.respond({ status: 204 })
      else request.continue()
    })
    const toggle = (enabled) =>
      worker.evaluate(
        async (on, url) => {
          const tabs = await chrome.tabs.query({})
          const tab = tabs.find((t) => t.url === url)
          if (!tab) throw Error("No fixture tab")
          await chrome.tabs.sendMessage(tab.id, {
            id: Math.floor(Math.random() * 1e9),
            type: "askManagerToTogglePageTranslation",
            data: { enabled: on },
            timestamp: Date.now(),
          })
        },
        enabled,
        page.url(),
      )
    const waitChinese = (selector) =>
      page.waitForFunction(
        (s) => /[一-鿿]/.test(document.querySelector(s)?.textContent || ""),
        { timeout: 20000 },
        selector,
      )
    const clean = (value) => value.replace(/\s*data-read-frog-[\w-]+="[^"]*"/g, "")
    for (const url of Object.keys(fixtures).filter((key) => !key.includes("/selection"))) {
      await page.mouse.move(1150, 800)
      await page.goto(url, { waitUntil: "domcontentloaded" })
      await sleep(800)
      if (url.includes("thenorthface"))
        console.log(
          "MENU BEFORE",
          await page.$eval(".twoDepth_wrap", (el) => ({
            display: getComputedStyle(el).display,
            hover: document.querySelector(".twoDepth_hover").matches(":hover"),
          })),
        )
      const original = await page.$eval("main", (el) => el.innerHTML)
      const requestStart = requests.length
      await toggle(true)
      if (url.includes("thenorthface")) {
        await sleep(1000)
        console.log(
          "MENU AFTER",
          await page.$eval("main", (el) => el.outerHTML),
          JSON.stringify(requests.slice(requestStart)),
        )
        assert.equal(
          await page.$eval("#menu-text", (el) => /[一-鿿]/.test(el.textContent)),
          false,
          "closed menu not translated",
        )
        await page.hover(".twoDepth_hover")
        await waitChinese("#menu-text")
      } else await waitChinese("main")
      const state = await page.evaluate(() => ({
        text: document.querySelector("main").textContent,
        wrappers: document.querySelectorAll(".read-frog-translated-content-wrapper").length,
        anchors: document.querySelectorAll("[data-read-frog-translation-only]").length,
        reflows: document.querySelectorAll("[data-read-frog-latexml-text-box]").length,
      }))
      if (url.includes("arxiv")) assert.equal(state.reflows, 1)
      if (url.includes("github"))
        assert.equal(
          await page.$eval("[data-testid=list-row-repo-name-and-number]", (el) => el.textContent),
          "Repository number must stay original",
        )
      await page.screenshot({
        path: path.join(evidence, "browser-" + new URL(url).hostname + ".png"),
      })
      await toggle(false)
      await page.waitForFunction(
        () =>
          !document.querySelector(
            ".read-frog-translated-content-wrapper,[data-read-frog-translation-only],[data-read-frog-latexml-text-box]",
          ),
        { timeout: 10000 },
      )
      assert.equal(
        clean(await page.$eval("main", (el) => el.innerHTML)),
        clean(original),
        "restored source DOM",
      )
      results.push({
        url,
        kind: "controlled DOM fixture in real built extension",
        translated: true,
        restored: true,
        requests: requests.length - requestStart,
        state,
      })
      console.log("PASS", url)
    }
    await page.goto("http://localhost:8931/selection", { waitUntil: "domcontentloaded" })
    await sleep(800)
    await page.keyboard.down("Control")
    await page.keyboard.press("KeyA")
    await page.keyboard.up("Control")
    const selected = await page.evaluate(() => getSelection().toString())
    assert(selected.includes("Tokyo"))
    assert(!selected.includes("任译喵"), "select all excludes extension host")
    await page.evaluate(() => {
      document.body.style.display = "none"
    })
    await sleep(300)
    const hosts = await page.evaluate(() =>
      [...document.querySelectorAll("*")]
        .filter((el) => el.shadowRoot && el.tagName.toLowerCase().includes("read-frog"))
        .map((el) => ({
          tag: el.tagName,
          parent: el.parentElement.tagName,
          display: getComputedStyle(el).display,
        })),
    )
    await page.evaluate(() => {
      document.body.style.display = ""
    })
    results.push({ kind: "selection Ctrl+A and hidden-body smoke", selected, hosts })
    assert.equal(forbidden.length, 0, "no upstream commercial requests observed")
    assert.equal(errors.length, 0, "no page runtime errors")
    fs.writeFileSync(
      path.join(evidence, "browser-results.json"),
      JSON.stringify(
        {
          browser: await browser.version(),
          extensionId,
          build: path.join(root, ".output/chrome-mv3"),
          config,
          results,
          providerRequests: requests,
          forbidden,
          errors,
        },
        null,
        2,
      ),
    )
    console.log("BROWSER DONE", results.length, "cases", requests.length, "provider requests")
  } finally {
    await browser.close()
    server.close()
  }
}
main().catch((error) => {
  console.error(error)
  server.close()
  process.exitCode = 1
})
