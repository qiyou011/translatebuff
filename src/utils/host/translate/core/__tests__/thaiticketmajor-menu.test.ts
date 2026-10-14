// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://unconfigured-menu.example/user/myticket.php"}

import { expect, it, vi } from "vitest"
import { DEFAULT_CONFIG } from "@/utils/constants/config"
import { CONTENT_WRAPPER_CLASS } from "@/utils/constants/dom-labels"
import { flushBatchedOperations } from "@/utils/host/dom/batch-dom"
import { walkAndLabelElement } from "@/utils/host/dom/traversal"
import { translateWalkedElement } from "../translation-walker"

const labels = [
  ["ตั๋วของฉัน", "我的票"],
  ["ประวัติการสั่งซื้อ", "订单记录"],
  ["แก้ไขข้อมูลส่วนตัว", "编辑个人资料"],
  ["เปลี่ยนรหัสผ่าน", "更改密码"],
  ["ออกจากระบบ", "登出"],
]

vi.mock("@/utils/host/translate/translate-variants", () => ({
  translateTextForPage: vi.fn<(text: string) => Promise<string>>(async (text) => {
    const translations: Record<string, string> = {
      ตั๋วของฉัน: "我的票",
      ประวัติการสั่งซื้อ: "订单记录",
      แก้ไขข้อมูลส่วนตัว: "编辑个人资料",
      เปลี่ยนรหัสผ่าน: "更改密码",
      ออกจากระบบ: "登出",
    }
    return translations[text] ?? `译文：${text}`
  }),
}))

it.each([
  ["inline-block", false],
  ["inline flow-root", false],
  ["inline-block", true],
])(
  "inserts a translation inside each account link without a site rule (display: %s, nested: %s)",
  async (display, nested) => {
    document.body.innerHTML = `
    <nav class="member-nav" style="display:block">
      <div class="inner popup-menu-list" style="display:${display}">
        ${labels.map(([source]) => `<a class="item" style="display:block"><i class="fa" style="font-family:FontAwesome" aria-hidden="true"></i>${source}</a>`).join("")}
      </div>
    </nav>
  `
    const nav = document.querySelector<HTMLElement>(".member-nav")!
    const inner = nav.querySelector<HTMLElement>(".inner")!
    const initialDisplay = window.getComputedStyle(inner).display
    if (nested) {
      const outer = document.createElement("span")
      outer.style.display = "inline"
      inner.replaceWith(outer)
      outer.append(inner)
    }
    const links = [...inner.querySelectorAll("a")]

    walkAndLabelElement(nav, "member-menu", DEFAULT_CONFIG)
    await translateWalkedElement(nav, "member-menu", DEFAULT_CONFIG)
    flushBatchedOperations()

    expect(inner.querySelectorAll(`.${CONTENT_WRAPPER_CLASS}`)).toHaveLength(5)
    links.forEach((link, index) => {
      expect(link.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toHaveTextContent(labels[index]![1]!)
      expect(link).toHaveTextContent(labels[index]![0]!)
      expect(link.querySelector("i.fa")).toBeInTheDocument()
    })
    expect(window.getComputedStyle(inner).display).toBe(initialDisplay)
  },
)

it("keeps inline-block prose together instead of translating emphasis separately", async () => {
  document.body.innerHTML = `<p id="sentence">Read <span style="display:inline-block">this <em style="display:inline">important</em> phrase</span> carefully.</p>`
  const sentence = document.getElementById("sentence")!
  walkAndLabelElement(sentence, "prose", DEFAULT_CONFIG)
  await translateWalkedElement(sentence, "prose", DEFAULT_CONFIG)
  flushBatchedOperations()

  expect(sentence.querySelectorAll(`.${CONTENT_WRAPPER_CLASS}`)).toHaveLength(1)
  expect(sentence.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toHaveTextContent(
    "译文：Read this important phrase carefully.",
  )
  expect(sentence.querySelector("em")).not.toContainElement(
    sentence.querySelector(`.${CONTENT_WRAPPER_CLASS}`),
  )
})

it("translates a container's own text as well as its block menu items", async () => {
  document.body.innerHTML = `<nav id="menu"><div id="inner" style="display:inline-block">Account actions${labels.map(([source]) => `<a style="display:block">${source}</a>`).join("")}Help with your account</div></nav>`
  const menu = document.getElementById("menu")!
  const inner = document.getElementById("inner")!
  walkAndLabelElement(menu, "own-text", DEFAULT_CONFIG)
  await translateWalkedElement(menu, "own-text", DEFAULT_CONFIG)
  flushBatchedOperations()

  const translations = [...inner.querySelectorAll(`.${CONTENT_WRAPPER_CLASS}`)]
  expect(translations).toHaveLength(7)
  expect(translations.map((wrapper) => wrapper.textContent?.trim())).toEqual(
    expect.arrayContaining([
      "译文：Account actions",
      "译文：Help with your account",
      ...labels.map(([, translation]) => translation),
    ]),
  )
  inner.querySelectorAll("a").forEach((link, index) => {
    expect(link.querySelector(`.${CONTENT_WRAPPER_CLASS}`)).toHaveTextContent(labels[index]![1]!)
  })
  expect(window.getComputedStyle(inner).display).toBe("inline-block")
})
