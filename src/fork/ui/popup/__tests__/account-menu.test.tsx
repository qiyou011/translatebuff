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

describe.each(["cn", "global"])("%s Popup 兑换入口", (edition) => {
  it.each(["logged-out", "free", "pro"])(
    "%s 账号右侧始终显示兑换入口并打开对应官网",
    async (state) => {
      vi.stubEnv("WXT_FORK_EDITION", edition)
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
      const redeem = screen.getByRole("button", { name: "兑换码" })
      expect(redeem).toBeVisible()
      fireEvent.click(redeem)
      await vi.waitFor(() => expect(browser.tabs.create).toHaveBeenCalledTimes(1))
      const url = new URL(vi.mocked(browser.tabs.create).mock.calls[0]?.[0]?.url ?? "")
      expect(url.origin).toBe(fixture.origin)
      expect(url.searchParams.get("cid")).toBe("9899")
      expect(url.pathname).toBe(state === "logged-out" ? "/zh-hans/login" : "/zh-hans/")
      expect(url.searchParams.get("redirect")).toBe(
        state === "logged-out" ? "/zh-hans/?redeem=1" : null,
      )
      expect(url.searchParams.get("redeem")).toBe(state === "logged-out" ? null : "1")
      expect(screen.queryByRole("menu")).not.toBeInTheDocument()
    },
  )
})
