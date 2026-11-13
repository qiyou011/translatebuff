import type { PageTranslationData } from "../types"
import { afterEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { createPageTranslationQueues } from "../queues"

const transport = vi.hoisted(() => ({
  google: vi.fn<(...args: any[]) => any>(),
  microsoft: vi.fn<(...args: any[]) => any>(),
}))
vi.mock("@/utils/host/translate/api/google", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/utils/host/translate/api/google")>()),
  requestGoogleTranslationBatch: transport.google,
}))
vi.mock("@/utils/host/translate/api/microsoft", () => ({
  requestMicrosoftTranslationBatch: transport.microsoft,
}))
vi.mock("../microsoft-format", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../microsoft-format")>()),
  requestMicrosoftFormatBatch: transport.microsoft,
}))

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe("bilingual format in the production page queue", () => {
  it.each(["google-translate", "microsoft-translate"] as const)(
    "keeps complete paragraphs and isolates a damaged %s item without protocol retries",
    async (provider) => {
      vi.useFakeTimers()
      const queue = createPageTranslationQueues({
        requestQueueConfig: { rate: 100, capacity: 100 },
        batchQueueConfig: { maxItemsPerBatch: 10, maxCharactersPerBatch: 10000 },
        isScopeCancelled: () => false,
      })
      const item = (suffix: string): PageTranslationData => ({
        text: `Save the ⟦B0⟧account⟦/B0⟧ with ZXQATOM1QXZ ${suffix}.`,
        bilingualFormat: { version: 1, identity: suffix, formats: [{ id: "B0" }], atoms: ["1"] },
        hash: suffix,
        scheduleAt: 0,
        langConfig: { ...DEFAULT_CONFIG.language, targetCode: "cmn" },
        provider: { id: provider, name: provider, enabled: true, provider },
        promptConfig: DEFAULT_CONFIG.pageTranslation.customPromptsConfig,
        textFormat: "plain",
        hostedFeature: "pageTranslation",
      })
      transport.google.mockResolvedValue([
        [
          '保存<b data-rf-attr="B0">账户</b>，使用<span translate="no" data-rf-attr="A1">ZXQATOM1QXZ</span>。',
          "损坏结果",
        ],
      ])
      transport.microsoft.mockResolvedValue([
        { translations: [{ text: "保存<b>账户</b>，使用ZXQATOM1QXZ。" }] },
        { translations: [{ text: "损坏结果" }] },
      ])
      const result = Promise.allSettled([
        queue.batchQueue.enqueue(item("first")),
        queue.batchQueue.enqueue(item("second")),
      ])
      await vi.advanceTimersByTimeAsync(200)
      expect(await result).toEqual([
        { status: "fulfilled", value: "保存⟦B0⟧账户⟦/B0⟧，使用ZXQATOM1QXZ。" },
        {
          status: "rejected",
          reason: expect.objectContaining({
            message: expect.stringContaining("Bilingual format integrity"),
          }),
        },
      ])
      const send = provider === "google-translate" ? transport.google : transport.microsoft
      expect(send).toHaveBeenCalledTimes(1)
      expect(send.mock.calls[0]![0]).toHaveLength(2)
      const first = send.mock.calls[0]![0][0]
      expect(typeof first === "string" ? first : first.text).toMatch(
        /^Save the .+account.+ with .+first\.$/,
      )
    },
  )
})
