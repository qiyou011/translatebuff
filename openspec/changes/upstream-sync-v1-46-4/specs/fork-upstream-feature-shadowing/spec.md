## ADDED Requirements

### Requirement: 上游后端依赖功能一律隐藏

上游依赖 read-frog 自有后端、自有计费或合作方服务的功能，在 fork 产物里 MUST 完全不可达。这包括 Built-in AI 分层配额、Jalapeno Cloud 与 Atlas Cloud 接入、账号套餐标识、AI 字幕分钟配额。fork MUST NOT 把这些功能接入任译喵会员体系，除非另行立项。

隐藏 SHALL 优先掐**状态源**而非逐个组件重定向：上游 UI 普遍读同一个状态钩子决定渲染与否，影子该钩子一处即可覆盖其全部消费方。仅当入口是独立路由或独立菜单项、状态源管不到时，才追加组件级重定向。

#### Scenario: Built-in AI 配额入口不渲染

- **GIVEN** `[数据层]` 影子模块使 `use-hosted-ai-status` 恒定返回未启用
- **WHEN** `[UI层]` 打开 popup 的 provider 选择器、选项页功能提供商列表与字幕面板
- **THEN** 均不出现 Built-in AI 分层、配额进度或 Ultra 徽标

#### Scenario: 合作方云服务不出现在 provider 清单

- **WHEN** `[UI层]` 打开选项页「API 提供商」与任一 provider 选择器
- **THEN** 不出现 Jalapeno Cloud、Atlas Cloud 两项，也不出现指向 `jalapeno-cloud.ai` 或 `readfrog.s.gy` 的「Get API key」按钮

#### Scenario: AI 字幕的两个入口都不渲染

- **WHEN** `[UI层]` 打开选项页视频字幕设置，以及视频页字幕面板的主菜单
- **THEN** 既不出现 `ai-quota` 分钟配额 UI，也不出现「请求 AI 字幕」菜单项；MUST NOT 出现任何触发 `ensureAiSubtitlesEntitled()` 的路径

### Requirement: 合作方内容脚本不进 manifest

上游为合作方站点新增的内容脚本 MUST 从仓库删除，MUST NOT 仅以空组件换皮保留——只要文件留在 `src/entrypoints/` 下，其 `matches` 就会被写进 manifest，产生对外可见的站点注入权限。

#### Scenario: 产物 manifest 无合作方站点权限

- **WHEN** 执行 `pnpm run build` 后检查 `.output/chrome-mv3/manifest.json`
- **THEN** `content_scripts` 与 `host_permissions` 中不含任何指向 `jalapeno-cloud.ai` 的条目

#### Scenario: 构建断言防回归

- **GIVEN** `[数据层]` 后续某次同步重新带入了合作方内容脚本
- **WHEN** 执行 `node scripts/assert-fork-build.mjs`
- **THEN** 断言失败并指明命中的站点，构建门阻断合入

### Requirement: provider 白名单式枚举测试防漏网

由于上游会持续新增合作方 provider，fork 展示层 MUST 采用**白名单式**分类：以上游 `PROVIDER_ITEMS` 的全部 key 为输入，任何未被 fork 显式分类的 provider id MUST 使测试失败。

MUST NOT 用「在构建产物里搜索关键串」作为门禁——`jalapenocloud`、`atlascloud`、`readfrog.s.gy`、`videoTranscript` 的真源位于 `src/utils/constants/providers.ts`、`src/types/config/provider/**` 与多个配置迁移脚本，这些全是 A 类 take-theirs 文件；该门禁只有改 A 类文件才能变绿，与「A 类一律 take-theirs」不变量直接冲突。

#### Scenario: 上游新增未分类 provider 时测试变红

- **GIVEN** `[数据层]` 上游在 `PROVIDER_ITEMS` 里新增了一个 fork 未曾分类的 provider id
- **WHEN** 运行 fork 展示层的枚举测试
- **THEN** 测试失败并列出未分类的 id，要求显式决定「呈现」或「过滤」

#### Scenario: 已知合作方 provider 被过滤

- **WHEN** 以完整 `PROVIDER_ITEMS` 为输入调用 fork 展示层
- **THEN** 输出中不含 `jalapenocloud` 与 `atlascloud`

### Requirement: 影子模块的类型级签名约束

枚举测试只覆盖 provider 维度；plan-badge、hosted-AI 状态钩子、AI 字幕入口不在 `PROVIDER_ITEMS` 里，仍依赖人工枚举与冒烟。为补上这块，每个影子模块 MUST 用 `satisfies typeof import("<被换皮的上游模块>")` 约束自身导出，使上游改动签名时在编译期即失败，而非等到运行时才发现影子已对不上。

#### Scenario: 上游改钩子签名时编译期失败

- **GIVEN** `[数据层]` 上游修改了 `use-hosted-ai-status` 的返回类型
- **WHEN** 执行 `pnpm run type-check`
- **THEN** fork 影子模块因 `satisfies` 约束不满足而报错
