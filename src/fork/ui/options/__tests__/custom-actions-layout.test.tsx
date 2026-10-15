// @vitest-environment jsdom

import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { cleanup, render } from "@testing-library/react"
import { generate, parse, walk } from "css-tree"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { ConfigItem } from "@/entrypoints/options/components/config-item"
import { EntityEditorLayout } from "@/entrypoints/options/components/entity-editor-layout"

const theme = parse(
  readFileSync(resolve(process.cwd(), "src/fork/ui/options/custom-actions-theme.css"), "utf8"),
)

function matchingDeclarations(element: Element) {
  const declarations: { property: string; value: string }[] = []
  walk(theme, {
    visit: "Rule",
    enter(rule) {
      if (rule.prelude.type !== "SelectorList") return
      if (!rule.prelude.children.some((selector) => element.matches(generate(selector)))) return
      rule.block.children.forEach((node) => {
        if (node.type === "Declaration") {
          declarations.push({ property: node.property, value: generate(node.value) })
        }
      })
    },
  })
  return declarations
}

beforeEach(() => document.documentElement.setAttribute("data-translatebuff-options-theme", ""))
afterEach(() => {
  cleanup()
  document.documentElement.removeAttribute("data-translatebuff-options-theme")
})

function renderLayout(id = "custom-actions") {
  const view = render(
    <ConfigItem id={id} orientation="vertical" title="指令配置">
      <EntityEditorLayout
        list={<span>Actions</span>}
        editor={<input aria-label="名称" defaultValue="Acceptance action" />}
      />
    </ConfigItem>,
  )
  const editor = view.getByRole("textbox", { name: "名称" }).parentElement!
  const row = editor.parentElement!
  const container = row.parentElement!
  return { row, container, editor }
}

describe("custom action theme with the shared entity editor container", () => {
  it("does not constrain the full layout or editor to a fixed sidebar width", () => {
    const { container, row, editor } = renderLayout()
    for (const element of [container, row, editor]) {
      const fixedSizes = matchingDeclarations(element).filter(({ property, value }) => {
        if (["width", "max-width", "flex-basis"].includes(property)) {
          return /^\d+(?:\.\d+)?(?:px|rem|em)$/.test(value)
        }
        return property === "flex" && /\d+(?:\.\d+)?(?:px|rem|em)$/.test(value)
      })
      expect(fixedSizes).toEqual([])
    }
  })

  it("applies the branded gutter to the actual row rather than its container", () => {
    const { row, container } = renderLayout()
    expect(matchingDeclarations(row)).toContainEqual({ property: "gap", value: "24px" })
    expect(matchingDeclarations(container)).not.toContainEqual({ property: "gap", value: "24px" })
  })

  it("does not apply custom action spacing to another shared editor page", () => {
    const { row, editor } = renderLayout("api-providers")
    expect(matchingDeclarations(row)).toEqual([])
    expect(matchingDeclarations(editor)).toEqual([])
  })
})
