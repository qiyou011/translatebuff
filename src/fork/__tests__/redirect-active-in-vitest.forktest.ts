import { describe, expect, it } from "vitest"

// 哨兵：断言换皮重定向在这份 vitest 配置下**真的接上了 vite**。
//
// 根 vitest.config.ts 不加载 wxt.config.ts 的 vite() 钩子，重定向在那里不生效——
// 上游原版测试会继续绿，但测的是休眠代码。文件名用 .forktest.ts 而非 .test.ts：
// 根配置的默认 include 匹配不到它，所以 `pnpm run test` 不会收走这个在根配置下
// 必然失败的哨兵。它只在 fork 配置下跑；在根配置下会失败，那正是它要证明的事
// （见 openspec/changes/fork-ui-revert-upstream-visuals design 决策 10）。
//
// 判别器用「模块同一性」，不用「上游独有的某个导出」：
// 重定向生效时，上游 specifier 与 fork 副本解析到同一个模块 id，因而拿到同一个
// 命名空间对象；不生效时是两个不同模块。这条判别不依赖上游保持任何形状——
// 上一版哨兵正是栽在这里：它拿 refreshMicrosoftToken 缺席当判别器，而微软重定向
// 在 v1.46.4 同步中已被删除、上游又在 #2045 自己删了该导出，于是断言两头都成立，
// 哨兵静默恒绿（把同样两条断言放进根配置跑也会通过，等于什么都没测）。
//
// 逐条重定向的改写正确性由 src/fork/__tests__/redirect-table.test.ts 全量覆盖（表驱动）；
// 这里只负责证明「插件确实挂进了当前 vite 管线」，故取少数几条纯 .ts 模块即可。

describe("fork 换皮重定向在 vitest 中生效", () => {
  it("上游 specifier 与 fork 副本解析到同一个模块", async () => {
    const pairs = await Promise.all([
      Promise.all([import("@/utils/featurebase"), import("@/fork/ui/options/featurebase")]),
      Promise.all([
        import("@/utils/providers/provider-display"),
        import("@/fork/providers/provider-display"),
      ]),
      Promise.all([
        import("@/utils/notebase/pending-save"),
        import("@/fork/utils/notebase-pending-save"),
      ]),
      Promise.all([
        import("@/components/llm-providers/use-hosted-ai-status"),
        import("@/fork/ui/hosted-ai/use-hosted-ai-status"),
      ]),
      Promise.all([
        import("@/entrypoints/translation-hub/atoms"),
        import("@/fork/ui/translation-hub/atoms"),
      ]),
    ])

    for (const [upstream, fork] of pairs) {
      expect(upstream).toBe(fork)
    }
  })
})
