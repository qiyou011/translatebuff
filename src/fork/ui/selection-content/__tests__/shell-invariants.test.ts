import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

// fork 翻译浮窗壳的两条源级不变量（TDD 红→绿）：
//   ① 彻底省略 notebase/猜你想存——壳内绝不引用其 hook/组件/请求 → 连 AI 请求都不发（比 redirect 空组件彻底）。
//   ② D4 三元组绑定——fork 消费者读 fork 自建 context，绝不 import 上游 provider（上游 context 是 module-private，
//      混用运行时抛 "must be used within Provider"）。
// 运行时「不发请求 / 不崩」由实机核对（Phase 3）；此处锁死结构，防复刻时误接 + 防后续回归。

const SHELL_DIR = join(__dirname, "..")

function readShell(relPath: string): string {
  const full = join(SHELL_DIR, relPath)
  if (!existsSync(full)) {
    throw new Error(`fork 壳文件尚未实现：${relPath}`)
  }
  return readFileSync(full, "utf8")
}

describe("fork 翻译浮窗壳 · 不变量①：彻底省略 notebase/猜你想存", () => {
  const FORBIDDEN = [
    "useSaveSuggestion",
    "SaveSuggestionCard",
    "SaveToNotebaseButton",
    "SaveToNotebaseDialogHost",
    "streamNoteSuggestion",
    "isSaveToNotebaseDialogOpenAtom",
    "save-to-notebase",
    "save-suggestion",
  ]
  const SHELL_FILES = [
    "use-selection-translation-controller.ts",
    "SelectionTranslationProvider.tsx",
    "use-custom-action-controller.ts",
    "SelectionCustomActionProvider.tsx",
  ]

  for (const file of SHELL_FILES) {
    it(`${file} 不含任何 save-suggestion/notebase 引用`, () => {
      const src = readShell(file)
      for (const pattern of FORBIDDEN) {
        expect(src, `${file} 不应引用 ${pattern}`).not.toContain(pattern)
      }
    })
  }
})

describe("fork 翻译浮窗壳 · 不变量②：D4 三元组绑定（读 fork context、不读上游 provider）", () => {
  const CONSUMERS = ["SelectionToolbar.tsx", "TranslateButton.tsx", "CustomActionTrigger.tsx"]
  // 上游 provider 文件承载 module-private context——fork 消费者绝不能 import 它（否则读上游 context 崩）。
  const UPSTREAM_PROVIDER =
    /@\/entrypoints\/selection\.content\/selection-toolbar\/(translate-button|custom-action-button)\/provider/

  for (const file of CONSUMERS) {
    it(`${file} 引用 fork context 且不 import 上游 provider`, () => {
      const src = readShell(file)
      expect(src, `${file} 应从 fork context 取上下文`).toContain("context")
      expect(
        src,
        `${file} 不应 import 上游 provider（会读上游 module-private context）`,
      ).not.toMatch(UPSTREAM_PROVIDER)
    })
  }
})
