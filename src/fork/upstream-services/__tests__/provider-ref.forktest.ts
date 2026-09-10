import { beforeEach, describe, expect, it, vi } from "vitest"
import { fakeBrowser } from "wxt/testing/fake-browser"
import { buildRenyimiaoProvider } from "@/fork/providers/renyimiao"
import { configSchema } from "@/types/config/config"
import { CONFIG_STORAGE_KEY, DEFAULT_CONFIG } from "@/utils/constants/config"
import { sendMessage } from "@/utils/message"
import {
  checkProviderAvailability,
  getProviderCacheIdentity,
  resolvePageTranslationProvider,
  serializeProviderRef,
} from "@/utils/providers/provider-ref"
import { getRequestErrorMeta } from "@/utils/request/retry-policy"

vi.mock("@/utils/message", () => ({
  sendMessage: vi.fn<() => Promise<null>>().mockResolvedValue(null),
}))

const system = {
  kind: "system" as const,
  id: "read-frog-free-ai" as const,
  name: "Legacy",
  modelTier: "normal" as const,
}
const local = buildRenyimiaoProvider("test-model", "test-key", "https://gateway.example/v1")

beforeEach(() => {
  fakeBrowser.reset()
  vi.clearAllMocks()
})

describe("fork provider refs", () => {
  it("converts explicit legacy snapshots without hosted status or storage writes", async () => {
    const config = {
      ...DEFAULT_CONFIG,
      providersConfig: [...DEFAULT_CONFIG.providersConfig, local],
    }
    expect(configSchema.safeParse(config).error?.issues).toBeUndefined()
    await fakeBrowser.storage.local.set({ [CONFIG_STORAGE_KEY]: config })
    const before = await fakeBrowser.storage.local.get(null)
    const ref = await serializeProviderRef(system, "pageTranslation")
    expect(ref).toMatchObject({ kind: "local", config: local })
    expect(getProviderCacheIdentity(ref)).not.toContain("modelRevision")
    expect(await fakeBrowser.storage.local.get(null)).toEqual(before)
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it("rejects missing candidates without retrying or failing sibling jobs", async () => {
    await expect(serializeProviderRef(system, "inputTranslation")).rejects.toMatchObject({
      code: "UPSTREAM_CLOUD_DISABLED",
      isRetryable: false,
    })
    const availability = await checkProviderAvailability(system, "pageTranslation")
    expect(availability).toMatchObject({ available: false })
    const results = await Promise.allSettled([
      serializeProviderRef(system, "pageTranslation"),
      serializeProviderRef(local, "pageTranslation"),
    ])
    expect(results[1]).toEqual({ status: "fulfilled", value: { kind: "local", config: local } })
    if (results[0].status !== "rejected") throw new Error("Legacy request unexpectedly succeeded")
    expect(getRequestErrorMeta(results[0].reason)).toMatchObject({
      isRetryable: false,
      kind: "unknown",
    })
    expect(sendMessage).not.toHaveBeenCalled()
  })

  it("resolves page configuration with the same fork policy", () => {
    expect(
      resolvePageTranslationProvider({
        ...DEFAULT_CONFIG,
        providersConfig: [local],
        pageTranslation: { ...DEFAULT_CONFIG.pageTranslation, providerId: system.id },
      }),
    ).toEqual(local)
  })

  it("does not serialize a paid language fallback", async () => {
    await fakeBrowser.storage.local.set({
      [CONFIG_STORAGE_KEY]: {
        ...DEFAULT_CONFIG,
        providersConfig: [...DEFAULT_CONFIG.providersConfig, local],
      },
    })
    await expect(serializeProviderRef(system, "languageDetection")).rejects.toMatchObject({
      code: "UPSTREAM_CLOUD_DISABLED",
    })
    expect(sendMessage).not.toHaveBeenCalled()
  })
})
