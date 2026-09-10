import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { fakeBrowser } from "wxt/testing/fake-browser"
import { buildRenyimiaoProvider } from "@/fork/providers/renyimiao"
import { CONFIG_STORAGE_KEY, DEFAULT_CONFIG } from "@/utils/constants/config"
import {
  detectLanguage,
  detectLanguageWithLLM,
  detectLanguageWithSource,
} from "@/utils/content/language"
import { sendMessage } from "@/utils/message"

vi.mock("@/utils/message", () => ({
  sendMessage: vi
    .fn<() => Promise<{ text: string }>>()
    .mockResolvedValue({ text: '{"code":"eng","reason":"English text"}' }),
}))

const text = "This is a sufficiently long English sentence for reliable local language detection."
const system = {
  kind: "system" as const,
  providerId: "read-frog-free-ai" as const,
  modelTier: "normal" as const,
  modelRevision: "legacy",
}
const local = { kind: "local" as const, config: buildRenyimiaoProvider("test-model", "test-key") }

beforeEach(async () => {
  fakeBrowser.reset()
  vi.clearAllMocks()
  await fakeBrowser.storage.local.set({
    [CONFIG_STORAGE_KEY]: {
      ...DEFAULT_CONFIG,
      providersConfig: [...DEFAULT_CONFIG.providersConfig, local.config],
      languageDetection: { ...DEFAULT_CONFIG.languageDetection, providerId: system.providerId },
    },
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("fork language fallback", () => {
  it("uses local detection for explicit system refs through both public entries", async () => {
    expect(await detectLanguageWithSource(text, { enableLLM: true, providerRef: system })).toEqual({
      code: "eng",
      source: "franc",
    })
    expect(await detectLanguage(text, { enableLLM: true, providerRef: system })).toBe("eng")
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it("ends direct hosted detection before any of the three attempts", async () => {
    expect(await detectLanguageWithLLM(text, system)).toBeNull()
    expect(await detectLanguageWithLLM(text)).toBeNull()
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it("downgrades stored system configuration without persisting a replacement", async () => {
    const before = await fakeBrowser.storage.local.get(null)
    expect(await detectLanguageWithSource(text, { enableLLM: true })).toEqual({
      code: "eng",
      source: "franc",
    })
    expect(await fakeBrowser.storage.local.get(null)).toEqual(before)
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it("falls back to franc with source when config storage cannot be read", async () => {
    vi.spyOn(fakeBrowser.storage.local, "get").mockRejectedValue(new Error("Storage unavailable"))

    await expect(detectLanguageWithSource(text, { enableLLM: true })).resolves.toEqual({
      code: "eng",
      source: "franc",
    })
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it("returns the locally detected language when config storage cannot be read", async () => {
    vi.spyOn(fakeBrowser.storage.local, "get").mockRejectedValue(new Error("Storage unavailable"))

    await expect(detectLanguage(text, { enableLLM: true })).resolves.toBe("eng")
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it("ends direct LLM detection without generation when config storage cannot be read", async () => {
    vi.spyOn(fakeBrowser.storage.local, "get").mockRejectedValue(new Error("Storage unavailable"))

    await expect(detectLanguageWithLLM(text)).resolves.toBeNull()
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it("honors explicit local refs through all public entries when config storage cannot be read", async () => {
    vi.spyOn(fakeBrowser.storage.local, "get").mockRejectedValue(new Error("Storage unavailable"))

    await expect(
      detectLanguageWithSource(text, { enableLLM: true, providerRef: local }),
    ).resolves.toEqual({ code: "eng", source: "llm" })
    await expect(detectLanguage(text, { enableLLM: true, providerRef: local })).resolves.toBe("eng")
    await expect(detectLanguageWithLLM(text, local)).resolves.toBe("eng")
    expect(sendMessage).toHaveBeenCalledTimes(3)
    expect(sendMessage).toHaveBeenCalledWith(
      "backgroundGenerateText",
      expect.objectContaining({ providerRef: local }),
    )
  })

  it("honors explicit local refs over old stored configuration", async () => {
    expect(await detectLanguageWithSource(text, { enableLLM: true, providerRef: local })).toEqual({
      code: "eng",
      source: "llm",
    })
    expect(sendMessage).toHaveBeenCalledTimes(1)
    expect(sendMessage).toHaveBeenCalledWith(
      "backgroundGenerateText",
      expect.objectContaining({ providerRef: local }),
    )
  })
})
