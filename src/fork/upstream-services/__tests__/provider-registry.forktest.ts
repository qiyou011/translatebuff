import type { ProvidersConfig } from "@/types/config/provider"
import { describe, expect, it } from "vitest"
import { resolveProviderRefForCapability } from "@/utils/providers/provider-registry"

const candidate = {
  id: "renyimiao-test",
  name: "Test model",
  enabled: true,
  provider: "openai-compatible" as const,
  apiKey: "test-key",
  baseURL: "https://gateway.example/v1",
  model: { model: "use-custom-model" as const, isCustomModel: true, customModel: "test-model" },
}

describe("fork legacy provider resolution", () => {
  it.each([
    "pageTranslation",
    "selectionTranslation",
    "inputTranslation",
    "videoSubtitles",
    "customAction",
  ] as const)("resolves %s before request construction", (capability) => {
    expect(resolveProviderRefForCapability(capability, [candidate], "read-frog-free-ai")).toEqual({
      kind: "local",
      id: candidate.id,
      name: candidate.name,
      config: candidate,
    })
  })

  it("skips disabled, keyless and unrelated candidates in config order", () => {
    const providers: ProvidersConfig = [
      { ...candidate, id: "unrelated" },
      { ...candidate, id: "renyimiao-disabled", enabled: false },
      { ...candidate, id: "renyimiao-keyless", apiKey: "" },
      candidate,
      { ...candidate, id: "renyimiao-later" },
    ]
    const before = structuredClone(providers)
    expect(
      resolveProviderRefForCapability("customAction", providers, "read-frog-advance-ai")?.id,
    ).toBe("renyimiao-test")
    expect(providers).toEqual(before)
  })

  it("does not route generation to an incompatible translator", () => {
    const providers: ProvidersConfig = [
      { id: "renyimiao-legacy", provider: "google-translate", name: "Legacy", enabled: true },
    ]
    expect(
      resolveProviderRefForCapability("customAction", providers, "read-frog-free-ai"),
    ).toBeNull()
  })

  it("returns no provider when no eligible candidate exists", () => {
    expect(resolveProviderRefForCapability("pageTranslation", [], "read-frog-free-ai")).toBeNull()
  })

  it("does not treat an omitted optional key as usable credentials", () => {
    expect(
      resolveProviderRefForCapability(
        "pageTranslation",
        [{ ...candidate, apiKey: undefined }],
        "read-frog-free-ai",
      ),
    ).toBeNull()
  })

  it.each(["languageDetection", "noteSuggestion"] as const)(
    "does not assign a paid fallback to %s",
    (capability) => {
      expect(
        resolveProviderRefForCapability(capability, [candidate], "read-frog-free-ai"),
      ).toBeNull()
    },
  )

  it("preserves an explicitly selected local provider and unknown IDs", () => {
    const local = { ...candidate, id: "my-own-model" }
    const ref = resolveProviderRefForCapability("pageTranslation", [candidate, local], local.id)
    expect(ref?.kind).toBe("local")
    if (ref?.kind !== "local") throw new Error("Expected local provider")
    expect(ref.config).toBe(local)
    expect(resolveProviderRefForCapability("pageTranslation", [candidate], "missing")).toBeNull()
  })
})
