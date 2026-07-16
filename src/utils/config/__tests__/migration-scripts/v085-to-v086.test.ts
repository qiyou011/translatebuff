import { describe, expect, it } from "vitest"
import { migrate } from "../../migration-scripts/v085-to-v086"

describe("v085-to-v086 migration", () => {
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
    expect(migrate(config)).toEqual(config)
  })

  it("returns unrelated and non-object values unchanged", () => {
    const config = { selectionToolbar: { enabled: true } }
    expect(migrate(config)).toBe(config)
    expect(migrate(null)).toBeNull()
  })
})
