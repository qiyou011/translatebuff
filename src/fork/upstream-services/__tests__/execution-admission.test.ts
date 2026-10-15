// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest"
import { buildCustomActionExecutionPlan } from "@/components/custom-action/use-custom-action-execution"
import {
  runNoteSuggestionStreamInBackground,
  runStructuredObjectStreamInBackground,
} from "@/entrypoints/background/background-stream"
import { buildRenyimiaoProvider } from "@/fork/providers/renyimiao"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { getBuiltInAction } from "@/utils/custom-actions"

const { getModelById } = vi.hoisted(() => ({
  getModelById: vi
    .fn<(...args: unknown[]) => Promise<never>>()
    .mockRejectedValue(new Error("Model must not be initialized")),
}))
vi.mock("@/utils/providers/model", () => ({
  getModelById,
  getLanguageModelForConfig: getModelById,
}))

const provider = buildRenyimiaoProvider("model", "key", "https://gateway.example/v1")
const resolved = { kind: "local" as const, config: provider, id: provider.id, name: provider.name }

describe("execution admission before paid model work", () => {
  it.each(["default-sentence-analysis", "default-improve-writing"] as const)(
    "rejects an explicit stale %s action snapshot before context or provider work",
    (id) => {
      const result = buildCustomActionExecutionPlan(
        {
          action: getBuiltInAction(DEFAULT_CONFIG.selectionToolbar, id),
          provider: resolved,
          language: DEFAULT_CONFIG.language,
        },
        "Selected text",
        "Context",
        null,
      )
      expect(result.executionContext === null).toBe(true)
      expect(result.error === null).toBe(false)
    },
  )

  it("keeps the approved dictionary execution available", () => {
    const result = buildCustomActionExecutionPlan(
      {
        action: getBuiltInAction(DEFAULT_CONFIG.selectionToolbar, "default-dictionary"),
        provider: resolved,
        language: DEFAULT_CONFIG.language,
      },
      "Word",
      "Context",
      null,
    )
    expect(result.error).toBeNull()
    expect(result.executionContext?.action.id).toBe("default-dictionary")
  })

  it("rejects a direct unapproved action message before model initialization", async () => {
    const payload = {
      actionId: "default-sentence-analysis",
      providerId: provider.id,
      prompt: "Explain this",
      outputSchema: [{ name: "result", type: "string" as const }],
    }
    await expect(runStructuredObjectStreamInBackground(payload)).rejects.toMatchObject({
      code: "UPSTREAM_CLOUD_DISABLED",
      isRetryable: false,
    })
    expect(getModelById).not.toHaveBeenCalled()
  })

  it("rejects direct note-suggestion messages even with a valid local model", async () => {
    await expect(
      runNoteSuggestionStreamInBackground({
        providerId: provider.id,
        instructions: "System",
        prompt: "Suggest notes",
      }),
    ).rejects.toMatchObject({ code: "UPSTREAM_CLOUD_DISABLED", isRetryable: false })
    expect(getModelById).not.toHaveBeenCalled()
  })
})
