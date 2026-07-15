## Why

面向中国大陆用户，翻译扩展应"开箱即用"我方托管的翻译服务，而不必自备第三方 AI provider 的 API key。当前扩展沿用上游 read-frog 品牌与 provider 体系：既无"任译喵"品牌露出，也没有我方内置模型入口。本次变更让扩展以"任译喵"品牌呈现，并内置"任译喵 API"作为可直接选用的翻译模型来源。

## What Changes

- 品牌改名：中文主名"任译喵"，Translatebuff 降为英文标识；扩展名 / 应用名 / popup 头三处一致。
- 预发布版本号：正式版发布前 manifest `version` 采用 `0.0.x`（fork 自主、不继承上游号，从 `0.0.1` 起），`version_name` 保留上游基线溯源（如 `任译喵 0.0.1（rf 1.40.2）`）。
- 内置翻译 provider "任译喵"：每个可用模型以上游 `openai-compatible` 形态 seed 一个托管实例（走 oneapi 网关），作为条目出现在 provider 选择器「大语言模型」组，用户在 网页翻译/字幕/划词/输入/词典 处直接选用；复用上游翻译引擎，一行引擎代码不改。
- 隐藏 out-of-box 默认第三方 LLM provider（OpenAI / DeepSeek / Atlas Cloud），产品只暴露任译喵 + 免费 AI + 普通翻译；被隐藏 provider 若被某功能选用则兜底到微软翻译（fork 数据层过滤，不改 A 类 schema）。
- popup 纯沿用上游（陪读蛙）完整面板；footer 版本号取 fork `0.0.x`。
- 内置模型清单硬编码 fork 常量、随发版可调（当前 `Deepseek-V4-Flash` 可用，`gpt-5.5` / `qwen3.5-plus` 待后台配置）。
- 边界护栏收口：豁免 fork 自有根文档（`FORK_GUIDE.md` / `CLAUDE.md`），使新增 fork 文档不判越界。
- 【暂不做】登录 / 注册 / 官网 / 购买接口、登录后自动注入 key、会员鉴权——待接口文档，v1 相关代码不动；key 由用户手动填写占位。

## Capabilities

### New Capabilities

- `renyimiao-provider`: 任译喵内置翻译 provider——预置 openai-compatible 托管实例、内置 3 模型选择、API key 手填、popup 品牌化配置块、一键启用为翻译源。

### Modified Capabilities

- `fork-identity`: 品牌主名增加中文"任译喵"，manifest / `APP_NAME` / popup 头三处显示一致；Translatebuff 保留为英文标识（域名、gecko.id、英文环境回退）。**并将预发布版本号由上游派生的 4 段改为 fork 自主的 `0.0.x`**。
- `fork-boundary-guard`: 边界分类新增豁免 fork 自有根文档（`FORK_GUIDE.md` / `CLAUDE.md`），使 fork 净新增的根级文档不被判越界。

## Impact

- 扩展新增/改动（C 类）：`src/fork/providers/renyimiao.ts`（模型常量 + 多实例 seed + Atlas 过滤 `syncForkProviders`）；`src/fork/background/index.ts`（`setupFork` 启动时同步）；`src/fork/ui/popup/App.tsx`（纯沿用陪读蛙面板）；`src/fork/branding.ts`（拆 displayName/name）；`src/fork/identity/*`（0.0.x 版本）。
- 上游文件：仅 `wxt.config.ts`（manifest 中文名 + 版本，已在 allowlist）；**零碰 A 类** provider zod schema / `DEFAULT_CONFIG` / `models.ts` / `providers.ts`。
- 配置数据：后台向上游 `providersConfig` 补齐可用模型的 openai-compatible 实例、移除 `openai/deepseek/atlascloud-default` 实例、把悬空功能 `providerId` 兜底到 `microsoft-translate-default`（纯数据，不改 `configSchema`）。
- 护栏脚本：`scripts/check-fork-boundary.mjs` 豁免规则新增 fork 根文档/根配置。
- 后端约束：oneapi 网关须以 openai-compatible 协议暴露，且模型别名与内置清单逐字一致（大小写敏感，否则 404/429）。
