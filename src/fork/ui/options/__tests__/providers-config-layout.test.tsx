// @vitest-environment jsdom
import { render } from "@testing-library/react"
import { createStore, Provider } from "jotai"
import { describe, expect, it, vi } from "vitest"
import { ConfigSection } from "@/entrypoints/options/components/config-section"
import { FORK_BRANDING } from "@/fork/branding"
import { configAtom } from "@/utils/atoms/config"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { PROVIDER_CONFIG_SECTION_ID } from "@/utils/navigation"

// 只验布局，登录态/网关拉取一律压平——否则要连上 storage.watch 与 browser.tabs。
vi.mock("@/fork/membership/atoms", () => ({
  useForkSession: () => null,
  useOpenForkLogin: () => () => {},
}))

vi.mock("@/fork/providers/use-ensure-renyimiao-seeded", () => ({
  useEnsureRenyimiaoSeeded: () => {},
}))

const { ProvidersConfig } = await import("@/fork/ui/options/providers-config")

function renderPage(): HTMLElement {
  const store = createStore()
  store.set(configAtom, DEFAULT_CONFIG)
  const { container } = render(
    <Provider store={store}>
      <ProvidersConfig />
    </Provider>,
  )
  return container
}

function renderBlock(): HTMLElement {
  return renderPage().querySelector(`#${PROVIDER_CONFIG_SECTION_ID}`) as HTMLElement
}

/** 同页下方「功能提供商」「语言检测」的分组外壳，作为同构基准。 */
function renderReferenceSection(): HTMLElement {
  const { container } = render(
    <ConfigSection title="参照分组">
      <div />
    </ConfigSection>,
  )
  return container.querySelector("section") as HTMLElement
}

// 「任译喵 API」是这一页的一个分组，必须与下方「功能提供商」「语言检测」同构：
// 外层 ConfigSection 出分组标题 + 分隔线，内层 ConfigItem 走 vertical 取满宽
// （horizontal 自带的 items-center + min-w-[320px] 会把整块缩成一条居中窄块）。
describe("fork 选项页「任译喵 API」分组", () => {
  // 「请在 API 提供商 页面设置 API Key」徽标与命令面板都按 PROVIDER_CONFIG_SECTION_ID 滚动，
  // fork 换皮时把这块的 id 写成了 api-providers，两条入口都只跳到页面顶部、滚不到本块。
  it("锚点用导航约定的 id，跳转才滚得到", () => {
    expect(renderPage().querySelector(`#${PROVIDER_CONFIG_SECTION_ID}`)).not.toBeNull()
  })

  it("有与下方分组同款的标题和分隔线", () => {
    const heading = renderBlock().querySelector("h2")
    const referenceHeading = renderReferenceSection().querySelector("h2")

    expect(heading?.textContent).toBe(`${FORK_BRANDING.displayName} API`)
    expect(heading?.className).toBe(referenceHeading!.className)
  })

  it("表单区纵向铺满，不套用 horizontal 的居中", () => {
    // ConfigSection 的结构：<section id><h2/><div>{children}</div></section>，children 首项即表单块。
    const [, content] = [...renderBlock().children] as HTMLElement[]
    const item = content!.firstElementChild as HTMLElement

    expect(item.className).toContain("flex-col")
    expect(item.className).not.toContain("items-center")
    for (const column of [...item.children] as HTMLElement[]) {
      expect(column.className).toContain("w-full")
    }
  })
})
