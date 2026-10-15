import { describe, expect, it } from "vitest"
import { buildRenyimiaoProvider } from "@/fork/providers/renyimiao"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { resolvePageTranslationProvider, serializeProviderRef } from "../provider-ref"

const provider = buildRenyimiaoProvider("model", "key", "https://gateway.example/v1")
const resolved = { kind: "local" as const, config: provider, id: provider.id, name: provider.name }

describe("target resolved provider contract", () => {
  it("returns the target resolved ref while retaining legacy system fallback", () => {
    expect(
      resolvePageTranslationProvider({
        ...DEFAULT_CONFIG,
        providersConfig: [provider],
        pageTranslation: { ...DEFAULT_CONFIG.pageTranslation, providerId: "read-frog-free-ai" },
      }),
    ).toEqual(resolved)
  })

  it("serializes a valid local resolved ref without consulting hosted state", async () => {
    await expect(serializeProviderRef(resolved, "pageTranslation")).resolves.toEqual({
      kind: "local",
      config: provider,
    })
  })
})
