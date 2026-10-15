import { describe, expect, it } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import {
  findSelectionToolbarAction,
  getBuiltInActions,
  getSelectionToolbarActions,
} from "../custom-actions"

describe("fork action admission", () => {
  it("keeps the approved dictionary and user actions without changing saved built-in state", () => {
    const config = structuredClone(DEFAULT_CONFIG.selectionToolbar)
    config.builtInActions.sentenceAnalysis.enabled = true
    config.builtInActions.improveWriting.enabled = true
    config.customActions = [{ ...getBuiltInActions(config)[0]!, id: "user-action", name: "Mine" }]
    const before = structuredClone(config)

    expect(getBuiltInActions(config).map(({ id }) => id)).toEqual(["default-dictionary"])
    expect(getSelectionToolbarActions(config).map(({ id }) => id)).toEqual([
      "default-dictionary",
      "user-action",
    ])
    expect(findSelectionToolbarAction(config, "user-action")).toBe(config.customActions[0])
    expect(config).toEqual(before)
  })

  it.each(["default-sentence-analysis", "default-improve-writing"])(
    "does not resolve unapproved built-in %s from a direct link or saved default",
    (id) => {
      expect(findSelectionToolbarAction(DEFAULT_CONFIG.selectionToolbar, id)).toBeUndefined()
    },
  )
})
