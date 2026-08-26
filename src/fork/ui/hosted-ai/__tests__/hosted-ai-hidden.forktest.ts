import { describe, expect, it } from "vitest"
import { useHostedAiStatus } from "@/components/llm-providers/use-hosted-ai-status"

// 上游的 Built-in AI 是它自家的托管模型 + 分层配额（Normal/Ultra），走 read-frog 后端计费。
// 任译喵有自己的会员体系，这套既不该出现在界面上，也不该真去打上游的 orpc 接口。
//
// 掐状态源一处即可覆盖 13 个消费方（provider 下拉、内置 provider 编辑器、配额页、
// 账号菜单、AI 内容感知等）——比逐个换皮组件省得多，也不会漏。
//
// 走 .forktest：断言的是重定向后的解析，根配置下拿到的是上游原版。
describe("Built-in AI 状态源已被 fork 影子接管", () => {
  it("恒定返回未登录 + 无状态，不发起任何后端查询", () => {
    const result = useHostedAiStatus()
    expect(result.status).toBeUndefined()
    expect(result.isSignedIn).toBe(false)
    expect(result.isPending).toBe(false)
    expect(result.isError).toBe(false)
  })

  it("传 enabled 也不改变结果（不给上游留启用口子）", () => {
    expect(useHostedAiStatus({ enabled: true }).status).toBeUndefined()
  })
})
