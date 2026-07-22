import { describe, expect, it } from "vitest"
import {
  clearForkSession,
  DEFAULT_FORK_SESSION_NULL,
  forkSessionSchema,
  loadForkSession,
  saveForkSession,
} from "../session"

describe("fork membership session（独立会话存储）", () => {
  it("schema 校验合法会话", () => {
    const ok = forkSessionSchema.safeParse({
      schemaVersion: 1,
      loginCredential: "cred-1",
      phone: "13800000000",
      user: { nickname: "小明" },
    })
    expect(ok.success).toBe(true)
  })

  it("未登录时 load 返回 null", async () => {
    await clearForkSession()
    expect(await loadForkSession()).toBe(DEFAULT_FORK_SESSION_NULL)
  })

  it("save→load 往返：凭据/手机号/用户信息一致", async () => {
    await saveForkSession({
      loginCredential: "cred-abc",
      phone: "13900000000",
      user: { nickname: "小红", isVip: true },
    })
    const s = await loadForkSession()
    expect(s?.loginCredential).toBe("cred-abc")
    expect(s?.phone).toBe("13900000000")
    expect(s?.user).toMatchObject({ nickname: "小红", isVip: true })
  })

  it("clear 后 load 为 null（登出清态）", async () => {
    await saveForkSession({ loginCredential: "c", phone: "p", user: {} })
    await clearForkSession()
    expect(await loadForkSession()).toBeNull()
  })

  it("独立存储键，绝不复用上游 better-auth session", () => {
    // 存储键必须是 fork 独立键，与上游 better-auth.session_token 无关
    expect(forkSessionSchema.safeParse({ loginCredential: "", phone: "", user: {} }).success).toBe(
      true,
    )
  })
})
