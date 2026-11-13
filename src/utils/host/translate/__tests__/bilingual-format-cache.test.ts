// @vitest-environment jsdom
import type { TranslateTextOptions } from "../translate-text"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import {
  clearInMemoryTranslationCache,
  storeInMemoryTranslation,
} from "../in-memory-translation-cache"
import { translateTextCore } from "../translate-text"
import { beginPageTranslationSession } from "../translation-session"

const send = vi.hoisted(() => vi.fn<(...args: any[]) => any>())
vi.mock("@/utils/message", () => ({ sendMessage: send }))
beforeEach(() => {
  clearInMemoryTranslationCache()
  send.mockReset().mockResolvedValue("保存⟦B0⟧账户⟦/B0⟧。")
})
function options(identity = "bold"): TranslateTextOptions {
  return {
    text: "Save ⟦B0⟧account⟦/B0⟧.",
    langConfig: { ...DEFAULT_CONFIG.language, targetCode: "cmn" },
    providerConfig: {
      kind: "local",
      id: "ms",
      name: "MS",
      config: { id: "ms", name: "MS", provider: "microsoft-translate", enabled: true },
    },
    hostedFeature: "pageTranslation",
    sessionId: beginPageTranslationSession(),
    bilingualFormat: { version: 1, identity, formats: [{ id: "B0" }], atoms: [] },
  }
}
describe("format cache identity and admission", () => {
  it("reuses only the same format/source identity and rejects damaged memory hits", async () => {
    const first = options()
    await translateTextCore(first)
    await translateTextCore(first)
    expect(send).toHaveBeenCalledTimes(1)
    const hash = send.mock.calls[0]![1].hash
    storeInMemoryTranslation(hash, "corrupted")
    await translateTextCore(first)
    expect(send).toHaveBeenCalledTimes(2)
    await translateTextCore({
      ...first,
      bilingualFormat: { ...first.bilingualFormat!, identity: "same-text-different-style-or-atom" },
    })
    expect(send).toHaveBeenCalledTimes(3)
    expect(send.mock.calls[2]![1].hash).not.toBe(hash)
  })
  it("never caches a damaged response or a protected plain recovery", async () => {
    const first = options()
    send.mockResolvedValueOnce("corrupted")
    await expect(translateTextCore(first)).rejects.toThrow("Bilingual format integrity")
    await translateTextCore(first)
    expect(send).toHaveBeenCalledTimes(2)
    const recovery = {
      ...first,
      text: "Save account.",
      bilingualFormat: { ...first.bilingualFormat!, formats: [], recovery: true },
    }
    send.mockResolvedValue("保存账户。")
    await translateTextCore(recovery)
    await translateTextCore(recovery)
    expect(send).toHaveBeenCalledTimes(4)
  })
})
