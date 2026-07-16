import { describe, expect, it } from "vitest"
import { migrate } from "../../migration-scripts/v085-to-v086"

describe("v085-to-v086 migration", () => {
  it("adds saveSuggestion with enabled default", () => {
    const migrated = migrate({
      selectionToolbar: { enabled: true, customActions: [] },
    })
    expect(migrated.selectionToolbar.saveSuggestion).toEqual({ enabled: true })
  })

  it("preserves an already-set saveSuggestion (idempotent)", () => {
    const migrated = migrate({
      selectionToolbar: { enabled: true, saveSuggestion: { enabled: false } },
    })
    expect(migrated.selectionToolbar.saveSuggestion).toEqual({ enabled: false })
  })

  it("leaves other selectionToolbar fields and top-level fields untouched", () => {
    const migrated = migrate({
      uiLanguage: "ja",
      selectionToolbar: { enabled: false, opacity: 80, customActions: [] },
    })
    expect(migrated.uiLanguage).toBe("ja")
    expect(migrated.selectionToolbar.enabled).toBe(false)
    expect(migrated.selectionToolbar.opacity).toBe(80)
    expect(migrated.selectionToolbar.customActions).toEqual([])
  })

  it("returns non-object input unchanged", () => {
    expect(migrate(null)).toBeNull()
    expect(migrate(undefined)).toBeUndefined()
  })

  it("repairs localized custom-action fields that were persisted as undefined", () => {
    const migrated = migrate({
      untouched: { apiKey: "keep-me" },
      selectionToolbar: {
        enabled: true,
        customActions: [
          {
            id: "default-dictionary",
            icon: "tabler:book-2",
            providerId: "read-frog-free-ai",
            outputSchema: [{ id: "term", type: "string", speaking: true }],
          },
        ],
      },
    })

    expect(migrated.untouched).toEqual({ apiKey: "keep-me" })
    expect(migrated.selectionToolbar.customActions[0]).toMatchObject({
      id: "default-dictionary",
      name: "Recovered action 1",
      systemPrompt: "",
      prompt: "",
      outputSchema: [
        {
          id: "term",
          name: "Recovered field 1",
          type: "string",
          description: "",
          speaking: true,
        },
      ],
    })
  })

  it("is idempotent and preserves valid custom-action values", () => {
    const config = {
      selectionToolbar: {
        customActions: [
          {
            id: "custom",
            name: "Summarize",
            enabled: false,
            icon: "tabler:notes",
            providerId: "provider",
            systemPrompt: "System",
            prompt: "Prompt",
            outputSchema: [
              {
                id: "summary",
                name: "Summary",
                type: "number",
                description: "Description",
                speaking: true,
              },
            ],
          },
        ],
      },
    }

    expect(migrate(migrate(config))).toEqual(migrate(config))
    expect(migrate(config)).toEqual({
      ...config,
      selectionToolbar: {
        ...config.selectionToolbar,
        saveSuggestion: { enabled: true },
      },
    })
  })

  it("returns unrelated and non-object values unchanged", () => {
    const config = { selectionToolbar: { enabled: true } }
    expect(migrate(config)).toEqual({
      selectionToolbar: {
        enabled: true,
        saveSuggestion: { enabled: true },
      },
    })
    expect(migrate(null)).toBeNull()
  })
})
