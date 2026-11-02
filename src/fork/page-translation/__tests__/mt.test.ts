import type { PageTranslationData } from "../types"
import { afterEach, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import {
  prepareGoogleTranslation,
  requestGoogleTranslationBatch,
  restoreGoogleTranslation,
} from "@/utils/host/translate/api/google"
import { requestMicrosoftTranslationBatch } from "@/utils/host/translate/api/microsoft"
import { normalizeTranslationOutput } from "@/utils/host/translate/translation-output-normalization"
import { decodePageMt, requestPageMt } from "../mt"

afterEach(() => vi.unstubAllGlobals())

it("restores punctuation and line state independently for every Google batch item", async () => {
  const provider = DEFAULT_CONFIG.providersConfig.find(
    (item) => item.provider === "google-translate",
  )!
  const make = (text: string, textFormat: "plain" | "html"): PageTranslationData => ({
    text,
    textFormat,
    provider,
    preserveLineBreaks: true,
    hash: text,
    scheduleAt: 0,
    langConfig: { ...DEFAULT_CONFIG.language, sourceCode: "eng", targetCode: "cmn" },
    promptConfig: DEFAULT_CONFIG.pageTranslation.customPromptsConfig,
  })
  const items = [
    make("<b>===== Hello\nWorld -----</b>", "html"),
    make("----- Hello\nWorld =====", "plain"),
  ]
  const fetcher = vi.fn<typeof fetch>(async (_url, options) => {
    const body = options?.body
    if (typeof body !== "string") throw new Error("Expected a serialized Google request")
    const inputs = JSON.parse(body)[0][0] as string[]
    // A provider that damages visible punctuation cannot damage empty markers.
    return {
      ok: true,
      json: async () => [
        inputs.map((text) =>
          text
            .replaceAll("Hello", "你好")
            .replaceAll("World", "世界")
            .replace(/={3,}|-{3,}/g, ""),
        ),
      ],
    } as Response
  })
  vi.stubGlobal("fetch", fetcher)
  const raw = await requestPageMt(items)
  expect(decodePageMt(raw, items)).toEqual([
    "<b>===== 你好\n世界 -----</b>",
    "----- 你好\n世界 =====",
  ])
  expect(fetcher).toHaveBeenCalledTimes(1)
  expect(JSON.parse(fetcher.mock.calls[0]![1]!.body as string)[0][0]).toHaveLength(2)
})
it("Google sends multiple items in one call while keeping per-item newline state", async () => {
  const fetcher = vi
    .fn<(...args: any[]) => any>()
    .mockResolvedValue({ ok: true, json: async () => [["first", "second"]] })
  vi.stubGlobal("fetch", fetcher)
  const first = prepareGoogleTranslation("a\nb", { preserveLineBreaks: true })
  const second = prepareGoogleTranslation("c & d")
  expect(second.requestText).toBe("c &amp; d")
  expect(
    await requestGoogleTranslationBatch([first.requestText, second.requestText], "auto", "zh"),
  ).toEqual([["first", "second"]])
  expect(fetcher).toHaveBeenCalledTimes(1)
  expect(JSON.parse(fetcher.mock.calls[0]![1].body)[0][0]).toHaveLength(2)
  const restored = restoreGoogleTranslation(
    '甲<br data-read-frog-lb="1"><br data-read-frog-lb="1">乙',
    first.preservedLines,
  )
  expect(restored).toBe("甲\n乙")
})
it("Microsoft raw page entry preserves partial results for out-of-queue decoding", async () => {
  const raw = [{ translations: [{ text: "&amp;amp;" }] }, { translations: [] }]
  const fetcher = vi
    .fn<(...args: any[]) => any>()
    .mockResolvedValue({ ok: true, json: async () => raw })
  vi.stubGlobal("fetch", fetcher)
  expect(await requestMicrosoftTranslationBatch(["&amp;", "second"], "en", "zh")).toEqual(raw)
  expect(JSON.parse(fetcher.mock.calls[0]![1].body)).toEqual(["&amp;amp;", "second"])
  expect(
    normalizeTranslationOutput({ provider: "microsoft-translate" }, raw[0]!.translations[0]!.text),
  ).toBe("&amp;")
  await expect(
    requestMicrosoftTranslationBatch(["<a>x</a>"], "en", "zh", { textFormat: "html" }),
  ).rejects.toThrow("HTML")
  expect(fetcher).toHaveBeenCalledTimes(1)
})
