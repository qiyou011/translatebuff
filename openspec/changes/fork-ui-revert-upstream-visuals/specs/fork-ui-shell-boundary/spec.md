## ADDED Requirements

### Requirement: 上游 UI 文件零原地改

fork MUST NOT 为了视觉定制而原地编辑任何上游 UI 源文件（`src/components/**`、`src/entrypoints/*/components/**`、`src/assets/styles/**`、各页面 `*.css`）。所有 fork 视觉与交互定制 SHALL 以换皮壳形式存在于 `src/fork/ui/**` 或 `src/fork/components/**`，并经 `wxt.config.ts` 的 `FORK_UI_REDIRECTS` 重定向生效。

#### Scenario: 存量越界清零

- **WHEN** 以 fork 分叉点为基准执行 `FORK_SCAN_ALL=1 node scripts/check-fork-boundary.mjs`
- **THEN** 输出的 violations 中不含任何 `.ts`/`.tsx`/`.css` 源文件条目，仅余对上游图片素材与 `package.json`/`.env.example` 的替换

#### Scenario: 新增原地改 UI 被拦截

- **GIVEN** 某次改动修改了 `src/components/ui/base-ui/button.tsx` 的 className
- **WHEN** CI 运行边界检查
- **THEN** 该文件被判为 violation，检查失败，PR 不得合入

### Requirement: 功能性 fork 改动落在 fork 领地

品牌接线（站点 URL、logo、品牌名）、隐藏上游入口（社区链接、上游商店评价）与 fork 自有逻辑，MUST NOT 以原地编辑上游文件的方式实现，SHALL 落在 `src/fork/**` 并经换皮重定向接入。回退上游视觉的过程 MUST NOT 丢失这些既有 fork 行为。

#### Scenario: 品牌站点链接经 fork 模块解析

- **GIVEN** 上游组件中存在指向 `readfrog.app` 或 `env.WXT_WEBSITE_URL` 的链接
- **WHEN** 构建产物运行
- **THEN** 该链接由 `src/fork/website-url.ts` 的 `getWebsiteUrl` 解析为任译喵站点，且上游源文件未被编辑

#### Scenario: 上游社区入口保持隐藏

- **WHEN** 打开 popup 的「更多」菜单与浮动按钮
- **THEN** 不出现 Discord 入口、GitHub issues 入口与上游商店评价入口

### Requirement: 换皮重定向的路径与内容双断言

`FORK_UI_REDIRECTS` 中每条重定向的 `from` 绝对路径 MUST 在构建期被断言存在；上游移动或重命名该文件时，构建 SHALL 失败并指明失效条目，MUST NOT 静默把上游原版 UI 打进产物。

仅断言路径存在**不足以**保证换皮正确：上游改了被换皮文件的内容时，构建照样通过而 fork 副本已经与上游行为偏离。因此每条重定向 MUST 另记一个内容指纹，`buildStart` MUST 比对当前内容与记录值，失配即硬失败。

指纹 SHALL 存放在 fork 自有的 `src/fork/identity/redirect-baseline.json`（以 `from` 路径为键），MUST NOT 写进 `wxt.config.ts`——该文件是 allowlist 里冲突最频繁的一个，加入每次同步都变动的字段会放大其冲突面。指纹算法 SHALL 为「文件内容 LF 归一化后取 sha256」，MUST NOT 依赖 git blob 或工作树内容——本仓 `.gitattributes` 为 `* text=auto eol=lf`，跨平台检出会产生假失配。

指纹失配时，MUST 先完成上游改动的对账（判断是否需要搬进 fork 副本）再更新指纹，MUST NOT 直接刷新指纹了事。

#### Scenario: 重定向源缺失使构建失败

- **GIVEN** 上游删除或移动了某条重定向的 `from` 文件
- **WHEN** 执行 `pnpm run build`
- **THEN** `buildStart` 抛出错误并列出失效的 `from` 路径

#### Scenario: 上游改了被换皮文件的内容时构建失败

- **GIVEN** `[数据层]` 某条重定向的 `from` 路径仍存在，但内容已被上游修改
- **WHEN** 执行 `pnpm run build`
- **THEN** `buildStart` 因指纹失配而抛错，提示该文件需要对账

### Requirement: fork 测试环境与产物环境的模块解析一致

fork 侧测试 MUST 在一份注册了 `forkUiRedirectPlugin(FORK_UI_REDIRECTS)` 的独立 vitest 配置下运行（`vitest.fork.config.ts`，`mergeConfig` 根配置后追加该插件）。否则测试跑的是被换皮替换掉的上游休眠代码，而产物跑的是 fork 副本——两者行为可以完全不同却全绿。

该插件 MUST NOT 注册进根 `vitest.config.ts`：全局生效会让上游自己的测试也解析到 fork 影子，而 fork 影子刻意返回「功能未启用」或渲染空组件，上游断言必然落空；修复它只能改或删上游测试文件，那既是越界又要扩 allowlist。

#### Scenario: 换皮模块在 fork 测试中生效

- **GIVEN** `[数据层]` 某上游模块已被 `FORK_UI_REDIRECTS` 重定向到 fork 副本
- **WHEN** 以 `pnpm vitest run --config vitest.fork.config.ts src/fork` 运行、测试文件 import 该上游模块路径
- **THEN** 解析到 fork 副本，测试断言的是实际会进产物的实现

#### Scenario: 上游测试不受换皮影响

- **WHEN** 执行 `pnpm run test`（根配置）
- **THEN** 上游测试解析到上游原版模块，不因 fork 影子而失败
