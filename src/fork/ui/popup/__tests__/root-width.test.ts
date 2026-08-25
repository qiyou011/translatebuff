// @vitest-environment jsdom
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

// fork popup 壳按 392px 布局，宽度声明在 fork 自有的 popup/index.html 里。
// 但上游 main.tsx 初始化时会 `root.className = "... w-[320px] ..."`——**整个覆盖** class，
// 于是 body 被 min-w-[392px] 撑到 392、#root 只剩 320，右侧露出一条 72px 白边。
// 所以宽度必须写成行内 style：className 覆盖不掉 style 属性。
describe("popup 根容器宽度", () => {
  it("上游覆盖 className 之后仍保持 fork 布局宽度", () => {
    const html = readFileSync("src/entrypoints/popup/index.html", "utf8")
    document.documentElement.innerHTML = html.slice(html.indexOf("<body"))

    const root = document.getElementById("root")
    expect(root).not.toBeNull()

    // 复现上游 main.tsx 的行为
    root!.className = "text-base antialiased w-[320px] bg-background"

    expect(root!.style.width).toBe("392px")
  })
})
