/* global chrome */
const fs = require("node:fs")
const path = require("node:path")
const os = require("node:os")
const http = require("node:http")
const puppeteer = require(
  path.join(os.tmpdir(), "translatebuff-format-browser/node_modules/puppeteer-core"),
)
const dir = __dirname
const wrapper = ".read-frog-translated-content-wrapper"
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
async function main() {
  const server = http.createServer((req, res) => {
    const name = req.url === "/" ? "format-fixture.html" : req.url.slice(1).split("?")[0]
    if (
      ![
        "format-fixture.html",
        "original-site-20261113.html",
        "original-site-docs-20261113.css",
      ].includes(name)
    ) {
      res.writeHead(404)
      res.end()
      return
    }
    res.setHeader("Content-Type", name.endsWith(".css") ? "text/css" : "text/html; charset=utf-8")
    res.end(fs.readFileSync(path.join(dir, name)))
  })
  await new Promise((resolve) => server.listen(18843, "127.0.0.1", resolve))
  const browser = await puppeteer.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: false,
    pipe: true,
    enableExtensions: true,
    args: ["--no-first-run", "--window-size=1280,950", "--proxy-server=http://127.0.0.1:7897"],
  })
  const report = {
    browser: await browser.version(),
    builtExtension: path.resolve(".output/chrome-mv3"),
    runs: [],
    errors: [],
  }
  try {
    report.extensionId = await browser.installExtension(report.builtExtension)
    const workerTarget = await browser.waitForTarget(
      (t) =>
        t.type() === "service_worker" &&
        t.url().startsWith(`chrome-extension://${report.extensionId}/`),
    )
    const worker = await workerTarget.worker()
    await pause(5000)
    const configure = async (provider) =>
      worker.evaluate(async (providerId) => {
        const { config } = await chrome.storage.local.get("config")
        if (!config) throw new Error("Missing initialized config")
        config.language.targetCode = "cmn"
        config.language.sourceCode = "eng"
        config.pageTranslation.mode = "bilingual"
        config.pageTranslation.providerId = providerId
        config.pageTranslation.page.skipLanguages = []
        await chrome.storage.local.set({ config })
        return {
          mode: config.pageTranslation.mode,
          target: config.language.targetCode,
          provider: config.pageTranslation.providerId,
        }
      }, provider)
    const page = await browser.newPage()
    await page.setViewport({ width: 1200, height: 900 })
    page.on("pageerror", (error) => report.errors.push(error.message))
    page.on("console", (message) => {
      if (/Bilingual format integrity|Translation failed|NotFoundError/.test(message.text()))
        report.errors.push(message.text().slice(0, 500))
    })
    const toggle = async (enabled) =>
      worker.evaluate(
        async (url, on) => {
          const tabs = await chrome.tabs.query({})
          const tab = tabs.find((t) => t.url === url)
          if (!tab) throw new Error("Missing acceptance tab")
          await chrome.tabs.sendMessage(tab.id, {
            id: Math.floor(Math.random() * 1e9),
            type: "askManagerToTogglePageTranslation",
            data: { enabled: on },
            timestamp: Date.now(),
          })
        },
        page.url(),
        enabled,
      )
    for (const provider of ["google-translate-default", "microsoft-translate-default"]) {
      const config = await configure(provider)
      await pause(500)
      await page.goto("http://127.0.0.1:18843/", { waitUntil: "networkidle0" })
      await pause(1200)
      await page.evaluate(() => {
        window.originalButton = document.getElementById("sample-action")
        window.originalButton?.click()
        const checkbox = document.querySelector("#F22 input")
        if (checkbox) checkbox.checked = true
        const details = document.querySelector("#F22 details")
        if (details) details.open = true
      })
      await toggle(true)
      for (let number = 1; number <= 27; number++) {
        const id = `F${String(number).padStart(2, "0")}`
        await page.$eval(`#${id}`, (el) => el.scrollIntoView({ block: "center" }))
        await pause(550)
      }
      await page
        .waitForFunction(() => document.querySelectorAll(".read-frog-spinner").length === 0, {
          timeout: 90000,
        })
        .catch(() => report.errors.push(`${provider}: spinner timeout`))
      await pause(2000)
      const cases = await page.evaluate(
        (selector) =>
          [...document.querySelectorAll("section[id]")].map((section) => ({
            id: section.id,
            translations: [...section.querySelectorAll(selector)].map((el) => ({
              text: el.textContent,
              html: el.innerHTML,
              status:
                el.querySelector("[data-read-frog-format-status]")?.dataset.readFrogFormatStatus ??
                "legacy",
              strong: [...el.querySelectorAll("strong,b")].map((x) => x.textContent),
              marks: [...el.querySelectorAll("mark")].map((x) => ({
                text: x.textContent,
                background: getComputedStyle(x).backgroundImage,
                color: getComputedStyle(x).color,
              })),
              atoms: [...el.querySelectorAll("code,kbd,samp,sup,sub,math")].map((x) => ({
                tag: x.localName,
                text: x.textContent,
              })),
            })),
          })),
        wrapper,
      )
      await page.$eval("#F01", (el) => el.scrollIntoView())
      await page.screenshot({ path: path.join(dir, `browser-${provider}-F01.png`) })
      await page.$eval("#F24", (el) => el.scrollIntoView())
      await page.screenshot({ path: path.join(dir, `browser-${provider}-F24.png`) })
      await page.$eval("#F23", (el) => el.scrollIntoView())
      await page.click("#append-dynamic")
      await page
        .waitForFunction(
          (selector) => !!document.querySelector("#dynamic-added " + selector),
          { timeout: 15000 },
          wrapper,
        )
        .catch(() => {})
      await pause(2500)
      const dynamic = await page.$eval("#dynamic-added", (el) => ({
        text: el.textContent,
        html: el.innerHTML,
      }))
      await toggle(false)
      await pause(1500)
      const restored = await page.evaluate(
        (selector) => ({
          wrappers: document.querySelectorAll(selector).length,
          sameButton: window.originalButton === document.getElementById("sample-action"),
          checkbox: document.querySelector("#F22 input")?.checked,
          details: document.querySelector("#F22 details")?.open,
          clickCount: document.getElementById("click-count")?.textContent,
        }),
        wrapper,
      )
      report.runs.push({ provider, config, cases, dynamic, restored })
      fs.writeFileSync(
        path.join(dir, "browser-acceptance-results.json"),
        JSON.stringify(report, null, 2),
      )
      console.log(
        JSON.stringify({
          provider,
          translatedCases: cases.filter((c) => c.translations.length).length,
          normal: cases.flatMap((c) => c.translations).filter((t) => t.status === "normal").length,
          degraded: cases.flatMap((c) => c.translations).filter((t) => t.status === "degraded")
            .length,
          restored,
        }),
      )
      await page.goto("https://iphone-use.leeguoo.com/en/", {
        waitUntil: "networkidle2",
        timeout: 60000,
      })
      await pause(1200)
      await toggle(true)
      for (const selector of ["p.du-lede", "h2", "pre", 'a.du-nav-item[href="/en/install"]']) {
        const element = await page.$(selector)
        if (element) {
          await element.evaluate((el) => el.scrollIntoView())
          await pause(1500)
        }
      }
      await page
        .waitForFunction(() => document.querySelectorAll(".read-frog-spinner").length === 0, {
          timeout: 60000,
        })
        .catch(() => {})
      const live = await page.evaluate(
        (selector) => ({
          url: location.href,
          lede: document.querySelector("p.du-lede")?.innerHTML,
          headings: [...document.querySelectorAll("h2")].map((el) => el.innerHTML),
          code: [...document.querySelectorAll("pre")].map((el) => el.textContent),
          nav: document.querySelector('a.du-nav-item[href="/en/install"]')?.getAttribute("href"),
          copyButton: !!document.querySelector("button.du-copy-page"),
          wrappers: document.querySelectorAll(selector).length,
        }),
        wrapper,
      )
      await page.$eval("p.du-lede", (el) => el.scrollIntoView())
      await page.screenshot({ path: path.join(dir, `browser-${provider}-original.png`) })
      await toggle(false)
      await pause(1000)
      report.runs.at(-1).originalSite = {
        ...live,
        restoredWrappers: await page.$$eval(wrapper, (els) => els.length),
      }
    }
  } finally {
    fs.writeFileSync(
      path.join(dir, "browser-acceptance-results.json"),
      JSON.stringify(report, null, 2),
    )
    await browser.close()
    server.close()
  }
}
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
