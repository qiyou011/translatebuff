import { defineConfig, mergeConfig } from "vitest/config"
import { forkUiRedirectPlugin } from "./src/fork/ui-redirect-plugin"
import baseConfig from "./vitest.config"
import { FORK_UI_REDIRECTS } from "./wxt.config"

// fork 专属 vitest 配置：根 vitest.config.ts 只注册 WxtVitest() 与 react()，不加载
// wxt.config.ts 的 vite() 钩子，所以换皮重定向在测试里不生效——上游原版测试会继续绿，
// 但测的是休眠代码，fork 副本的行为一行没测到。
//
// 刻意不把插件注册进根配置：全局生效会让上游自己的测试也解析到 fork 影子
// （providers-config / feature-provider-selector-list 会被换成 fork 版，
// notebase-connection-field 会被换成 fork 空组件，microsoft 会被换成 fork 适配器），
// 上游断言必然落空、pnpm run test 判红，而修它只能改或删上游测试文件——那既是越界
// 又要扩 allowlist，正好抵消 fork 边界护栏在做的事。
//
// 用法：pnpm vitest run --config vitest.fork.config.ts src/fork
export default mergeConfig(
  baseConfig,
  defineConfig({
    plugins: [forkUiRedirectPlugin(FORK_UI_REDIRECTS)],
    test: {
      // 额外收 .forktest.ts：这类哨兵断言「重定向已生效」，在根配置下必然失败，
      // 故用根配置默认 include 匹配不到的扩展名，避免污染 pnpm run test。
      include: ["src/fork/**/*.{test,forktest}.{ts,tsx}"],
      // 本配置下每个测试文件都要解析 wxt.config.ts → 23 条换皮重定向 → 整棵 UI 依赖树，
      // 模块解析本身就重。默认 5s 在并发 + 机器负载下会卡线，让 redirect-wiring 与 notebase-url
      // 两个哨兵随机超时（实测 5020ms / 6860ms，单独跑 2.02s 稳过）——CI 随机翻红、且红在与改动
      // 无关的地方。放宽到 20s：真断言失败仍即时红，只有"慢"不再被误判成"错"。
      testTimeout: 20_000,
    },
  }),
)
