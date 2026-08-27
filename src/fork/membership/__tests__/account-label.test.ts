import { afterEach, describe, expect, it, vi } from "vitest"
import { accountLabel } from "../account-label"

// 对齐本仓测试惯例（见 utils/hosted-ai/__tests__/status.test.ts）：i18n 在测试环境未初始化，
// t() 直接回显 key，断言据此判「是否走了回退分支」。
vi.mock("@/utils/i18n", () => ({ i18n: { t: (key: string) => key } }))

afterEach(() => {
  vi.unstubAllEnvs()
})

const session = (over: Partial<{ phone: string; email: string }> = {}) => ({
  schemaVersion: 1 as const,
  loginCredential: "cred",
  phone: "",
  email: "",
  user: {},
  ...over,
})

describe("accountLabel（账户展示字段的 edition 分叉单点）", () => {
  it("cn：展示脱敏手机号", () => {
    expect(accountLabel(session({ phone: "+86-13800138000" }))).toEqual({
      text: "+86****8000",
      tabularNums: true,
    })
  })

  it("global：展示脱敏邮箱，且不带 tabular-nums（那是为数字对齐加的）", () => {
    vi.stubEnv("WXT_FORK_EDITION", "global")
    expect(accountLabel(session({ email: "alice@gmail.com" }))).toEqual({
      text: "a***@gmail.com",
      tabularNums: false,
    })
  })

  it("global 邮箱为空 → 回退文案，绝不渲染成空白（email 是海外线唯一标识）", () => {
    vi.stubEnv("WXT_FORK_EDITION", "global")
    expect(accountLabel(session()).text).toBe("forkMembership.loggedIn")
  })

  it("cn 手机号为空 → 同样回退，不留空白", () => {
    expect(accountLabel(session()).text).toBe("forkMembership.loggedIn")
  })
})
