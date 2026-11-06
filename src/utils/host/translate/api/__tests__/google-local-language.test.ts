import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { googleTranslate, requestGoogleTranslationBatch } from "../google"

const fetcher = vi.fn<(...args: any[]) => any>()
const hidlion =
  "حاسس المراجعه منطقيه اللعبه حلوه بس بيتطبلوا كتير ❤ بس بصراحه انا جربتها و مش وحشه❤"
const persian = "این بازی بسیار زیبا و سرگرم کننده است"
const urdu = "یہ کھیل بہت اچھا ہے اور مجھے پسند آیا"
beforeEach(() => {
  fetcher.mockReset().mockImplementation(async (_url, init) => {
    const [texts] = JSON.parse(init.body)[0]
    return { ok: true, json: async () => [texts.map((text: string) => `译文:${text}`)] }
  })
  vi.stubGlobal("fetch", fetcher)
})
afterEach(() => vi.unstubAllGlobals())

it.each([
  [hidlion, "ar"],
  [persian, "fa"],
  [urdu, "ur"],
])("uses local identification for %s", async (source, expected) => {
  await googleTranslate(source, "auto", "zh")
  expect(fetcher).toHaveBeenCalledTimes(1)
  expect(fetcher.mock.calls[0]![0]).toBe("https://translate-pa.googleapis.com/v1/translateHtml")
  expect(JSON.parse(fetcher.mock.calls[0]![1].body)[0][1]).toBe(expected)
})

it.each(["Hello world", "このゲームはとても面白いです", "مرحبا", "استمر", "منور يا اخ كريم"])(
  "retains auto for ordinary or uncertain source %s",
  async (source) => {
    await googleTranslate(source, "auto", "zh")
    expect(JSON.parse(fetcher.mock.calls[0]![1].body)[0][1]).toBe("auto")
  },
)

it.each(["ar", "en"])("respects explicit source %s", async (from) => {
  await googleTranslate(hidlion, from, "zh")
  expect(JSON.parse(fetcher.mock.calls[0]![1].body)[0][1]).toBe(from)
})

it("identifies visible HTML without translating or removing its markup", async () => {
  const html = `<b data-rf-attr="0">${hidlion}</b><br data-read-frog-lb="1">`
  expect(await googleTranslate(html, "auto", "zh", { textFormat: "html" })).toBe(`译文:${html}`)
  expect(JSON.parse(fetcher.mock.calls[0]![1].body)[0]).toEqual([[html], "ar", "zh"])
  await googleTranslate(`<a title="${hidlion}">hello</a>`, "auto", "zh", { textFormat: "html" })
  expect(JSON.parse(fetcher.mock.calls[1]![1].body)[0][1]).toBe("auto")
})

it("batches by detected source and restores original item order", async () => {
  const texts = ["hello", hidlion, persian, "world", urdu, hidlion]
  const result = await requestGoogleTranslationBatch(texts, "auto", "zh")
  expect(result).toEqual([texts.map((t) => `译文:${t}`), ["auto", "ar", "fa", "auto", "ur", "ar"]])
  expect(fetcher).toHaveBeenCalledTimes(4)
  const bodies = fetcher.mock.calls.map(([, init]) => JSON.parse(init.body)[0])
  expect(bodies.find((b) => b[1] === "ar")[0]).toHaveLength(2)
  expect(bodies.find((b) => b[1] === "auto")[0]).toEqual(["hello", "world"])
})

it("isolates failed source groups", async () => {
  fetcher.mockImplementation(async (_url, init) => {
    const [texts, from] = JSON.parse(init.body)[0]
    if (from === "fa") throw new Error("offline")
    return { ok: true, json: async () => [texts.map(() => "正常译文")] }
  })
  expect(await requestGoogleTranslationBatch([hidlion, persian, "hello"], "auto", "zh")).toEqual([
    ["正常译文", undefined, "正常译文"],
    ["ar", "fa", "auto"],
  ])
})

it("cancels before starting another source group", async () => {
  const controller = new AbortController()
  fetcher.mockImplementation(async () => {
    controller.abort()
    throw new DOMException("Aborted", "AbortError")
  })
  await expect(
    requestGoogleTranslationBatch([hidlion, persian], "auto", "zh", controller.signal),
  ).rejects.toMatchObject({ name: "AbortError" })
  expect(fetcher).toHaveBeenCalledTimes(1)
})
