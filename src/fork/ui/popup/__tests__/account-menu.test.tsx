// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { createStore, Provider, useAtomValue } from "jotai"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { browser } from "#imports"
import { forkSessionAtom } from "@/fork/membership/atoms"
import { ForkAccountMenu } from "../account-menu"

const fixture = vi.hoisted(() => ({
  origin: "https://www.translatebuff.cn",
  locale: "zh-CN",
  tier: "free" as "free" | "pro",
}))
const sendForkMessage = vi.hoisted(() => vi.fn<() => Promise<string>>())
vi.mock("@/env", () => ({
  env: {
    get WXT_WEBSITE_URL() {
      return fixture.origin
    },
  },
}))
vi.mock("@/fork/message", () => ({ sendForkMessage }))
vi.mock("@/utils/i18n/locale-map", () => ({ resolveUiLocale: () => fixture.locale }))
vi.mock("@/utils/i18n", () => ({
  i18n: {
    t: (key: string) =>
      ({ "forkMembership.redeemCode": "兑换码", "account.login": "登录" })[key] ?? key,
  },
}))
vi.mock("@/fork/membership/atoms", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/fork/membership/atoms")>()
  return { ...original, useForkSession: () => useAtomValue(original.forkSessionAtom) }
})
vi.mock("@/fork/membership/membership-info", () => ({
  useForkMembershipInfo: () => ({ tier: fixture.tier, remainQuota: 100, expiryDate: "2026-11-01" }),
}))

beforeEach(() => {
  vi.spyOn(browser.tabs, "create").mockResolvedValue({} as never)
  sendForkMessage.mockResolvedValue("9899")
  fixture.locale = "zh-CN"
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

function renderAccount(edition: "cn" | "global", state: string, locale: string) {
  vi.stubEnv("WXT_FORK_EDITION", edition)
  fixture.locale = locale
  fixture.origin =
    edition === "cn" ? "https://www.translatebuff.cn" : "https://www.translatebuff.com"
  fixture.tier = state === "pro" ? "pro" : "free"
  const store = createStore()
  if (state !== "logged-out") {
    store.set(forkSessionAtom, {
      schemaVersion: 1,
      loginCredential: "test",
      phone: "13812348000",
      email: "test@example.com",
      user: {},
    })
  }
  render(
    <Provider store={store}>
      <ForkAccountMenu />
    </Provider>,
  )
}

describe.each([
  { locale: "zh-CN", loginPath: "/zh-hans/login", redeemPath: "/zh-hans/" },
  { locale: "en", loginPath: "/login", redeemPath: "/" },
  { locale: "vi", loginPath: "/login", redeemPath: "/" },
])("$locale 界面", ({ locale, loginPath, redeemPath }) => {
  describe("国内Popup", () => {
    it.each(["logged-out", "free", "pro"])("%s 不显示兑换入口", (state) => {
      renderAccount("cn", state, locale)
      expect(screen.queryByRole("button", { name: "兑换码" })).not.toBeInTheDocument()
      expect(browser.tabs.create).not.toHaveBeenCalled()
    })

    it("未登录时保留登录入口", () => {
      renderAccount("cn", "logged-out", locale)
      expect(screen.getByRole("button", { name: "登录" })).toBeVisible()
    })
  })

  describe("海外Popup", () => {
    it.each(["logged-out", "free", "pro"])("%s 提供官网兑换入口", async (state) => {
      renderAccount("global", state, locale)
      const redeem = screen.getByRole("button", { name: "兑换码" })
      expect(redeem).toBeVisible()
      fireEvent.click(redeem)
      await vi.waitFor(() => expect(browser.tabs.create).toHaveBeenCalledTimes(1))
      const url = new URL(vi.mocked(browser.tabs.create).mock.calls[0]?.[0]?.url ?? "")
      expect(url.origin).toBe(fixture.origin)
      expect(url.searchParams.get("cid")).toBe("9899")
      expect(url.pathname).toBe(state === "logged-out" ? loginPath : redeemPath)
      expect(url.searchParams.get("redirect")).toBe(
        state === "logged-out" ? `${redeemPath}?redeem=1` : null,
      )
      expect(url.searchParams.get("redeem")).toBe(state === "logged-out" ? null : "1")
      expect(screen.queryByRole("menu")).not.toBeInTheDocument()
      // 同一弹窗后续点击必须重新读取当前官网渠道，不能缓存首次值。
      sendForkMessage.mockResolvedValueOnce("66666")
      fireEvent.click(redeem)
      await vi.waitFor(() => expect(browser.tabs.create).toHaveBeenCalledTimes(2))
      const nextUrl = new URL(vi.mocked(browser.tabs.create).mock.calls[1]?.[0]?.url ?? "")
      expect(nextUrl.searchParams.get("cid")).toBe("66666")
    })
  })
})
