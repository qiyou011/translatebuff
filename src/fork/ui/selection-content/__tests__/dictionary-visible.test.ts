import { describe, expect, it } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { BUILT_IN_DICTIONARY_ACTION_ID } from "@/utils/constants/custom-action"
import { getSelectionToolbarActions } from "@/utils/custom-actions"

// 上游 v1.43.6 把内置「词典」从 selectionToolbar.customActions 搬进了 builtInActions.dictionary，
// 并给出 getSelectionToolbarActions() 统一取「内置 + 自定义」。
// fork 的划词工具栏若还直接读 customActions，词典按钮会整个消失（冒烟实测）。
describe("划词工具栏的动作来源", () => {
  it("默认配置下 customActions 里已经没有词典了", () => {
    expect(DEFAULT_CONFIG.selectionToolbar.customActions).toHaveLength(0)
  })

  it("必须经 getSelectionToolbarActions 才能拿到内置词典", () => {
    const actions = getSelectionToolbarActions(DEFAULT_CONFIG.selectionToolbar)
    expect(actions.length).toBeGreaterThan(0)
    expect(actions.some((action) => action.id === BUILT_IN_DICTIONARY_ACTION_ID)).toBe(true)
  })
})
