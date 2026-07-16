## Why

产品定位是"只用任译喵"：provider 选择器与选项页应全局只呈现任译喵（+ 普通翻译作翻译兜底），不暴露 OpenAI/DeepSeek/Atlas/免费AI，也不允许添加自建 provider。前一变更用"后台改配置移除默认 provider"来隐藏——已证明**不可靠**（新装时与上游 `initializeConfig` 写默认配置竞态，全新 profile 上默认赢），且 config 层**改不了 UI**（「添加提供商」按钮、免费AI system provider 都是 UI）。

正解是"换皮 + UI 锁定"：核心逻辑/引擎复用上游，provider 选择相关 UI 全部 fork 自画并锁定为任译喵；用 wxt.config 里的 Vite resolve 插件把上游 composed UI **零编辑重定向**到 fork 版。

## What Changes

- 确立并落地「换皮」约定：复用上游逻辑函数 + base-ui 原语；fork 重写组合功能 UI；不编辑、不直接引用上游 composed UI 组件。
- fork provider 选择器：分组只保留「任译喵组 + 普通翻译组」（丢大语言模型组 = 藏 OpenAI/DeepSeek/Atlas/自建，丢内置模型组 = 藏免费AI）。
- fork popup 的 provider 块（summary + Drawer + 功能行 + 自定义动作行）。
- fork 选项页 API 提供商页（列表形态）：左栏只任译喵、右侧配置（key + 模型），**去「添加提供商」、去「内置提供商」区**。
- 全局重定向：wxt.config 加 Vite resolve 插件，把上游 `provider-selector.tsx`、`providers-config.tsx` 按绝对路径重定向到 fork 版——四处选择器 + 选项页全局生效，**零编辑上游源文件**。
- seed 改到 UI 挂载时做（读最新 config、幂等、避开新装竞态）；`computeForkConfigSync` 简化为 seed-only（不再删默认，UI 已藏）；词典等指向被藏 provider（免费AI）的功能 repoint 到任译喵。

## Capabilities

### New Capabilities

- `fork-provider-ui`: fork 换皮并锁定为任译喵的 provider 选择 UI——自绘选择器（只任译喵+普通翻译）、popup provider 块、选项页 provider 页（只任译喵、不可添加），经 wxt.config resolve 插件全局零编辑重定向。

### Modified Capabilities

（无——纯 fork + wxt.config（allowlist 内）；不改动现有能力规格。）

## Impact

- 扩展新增（C 类）：`src/fork/components/provider-selector*.tsx`、`src/fork/ui/popup/providers-field.tsx`、`src/fork/ui/options/providers-config.tsx`（fork 选项 provider 页）、seed helper。
- 改自有 fork 文件：`src/fork/ui/popup/App.tsx`、`src/fork/providers/renyimiao.ts`（seed-only + 导出谓词）、`src/fork/background/index.ts`（去 racy 后台改配置）。
- `wxt.config.ts`（B 类 allowlist）：加 Vite resolve 插件重定向两个上游 composed UI 文件。**零编辑上游源文件**（`provider-selector.tsx`/`providers-config.tsx`/`feature-provider-selector-list.tsx`/上游 popup `providers-field.tsx` 均不改）。
- 数据流：seed + repoint 在 UI 挂载时单向写回 config（幂等、post-init 无竞态）。
- 权衡：fork 组件脱钩、不自动跟上游更新（换皮固有账）；resolve 插件对上游文件重构敏感（上游若改这两个文件的导出/结构，fork 版需手动跟——属换皮脱钩成本）。
