import { afterEach, expect, it, vi } from "vitest"
import {
  prepareGoogleTranslation,
  requestGoogleTranslationBatch,
  restoreGoogleTranslation,
} from "@/utils/host/translate/api/google"
import { requestMicrosoftTranslationBatch } from "@/utils/host/translate/api/microsoft"
import { normalizeTranslationOutput } from "@/utils/host/translate/translation-output-normalization"

afterEach(() => vi.unstubAllGlobals())
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
