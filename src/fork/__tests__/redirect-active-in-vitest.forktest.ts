import { describe, expect, it } from "vitest"
import * as microsoftModule from "@/utils/host/translate/api/microsoft"

// 哨兵：断言换皮重定向在这份 vitest 配置下**真的生效**。
//
// 根 vitest.config.ts 不加载 wxt.config.ts 的 vite() 钩子，重定向在那里不生效——
// 上游原版测试会继续绿，但测的是休眠代码。这个测试用「只有上游版才有的导出」当判别器：
// 重定向生效时解析到 fork 副本，refreshMicrosoftToken 不存在。
//
// 文件名用 .forktest.ts 而非 .test.ts：根配置的默认 include 匹配不到它，所以 `pnpm run test`
// 不会收走这个必然失败的哨兵。它只在 fork 配置下跑；在根配置下会失败，
// 那正是它要证明的事（见 openspec/changes/fork-ui-revert-upstream-visuals design 决策 10）。
describe("fork 换皮重定向在 vitest 中生效", () => {
  it("解析到 fork 副本而非上游原版", () => {
    expect(microsoftModule).toHaveProperty("microsoftTranslate")
    // refreshMicrosoftToken 是上游旧鉴权链路的导出，fork 副本已随免鉴权端点改造删除
    expect(microsoftModule).not.toHaveProperty("refreshMicrosoftToken")
  })
})
