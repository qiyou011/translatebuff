import { expect, it, vi } from "vitest"

const calls = vi.hoisted(() => [] as string[])
vi.mock("@/fork/identity/install-channel-runtime", () => ({
  setupInstallChannel: () => calls.push("channel"),
}))
vi.mock("@/fork/background/membership", () => ({ setupMembership: () => calls.push("membership") }))
vi.mock("@/fork/background/startup-tracking", () => ({
  setupStartUpTracking: () => calls.push("report"),
}))
vi.mock("@/fork/background/translate-activity", () => ({
  setupTranslateActivity: vi.fn<() => void>(),
}))
vi.mock("@/fork/background/repair-custom-actions", () => ({
  repairCustomActions: vi.fn<() => void>(),
}))
vi.mock("@/fork/message", () => ({ onForkMessage: vi.fn<() => void>() }))

it("后台先注册渠道读取消息，再接会员同步和启动上报", async () => {
  const { setupFork } = await import("../index")
  setupFork()
  expect(calls).toEqual(["channel", "membership", "report"])
})
