# fork-hide-google-drive-sync

## Why

选项页「配置」页的「Google Drive 云端同步」是上游 read-frog 的功能。任译喵自建后端 + 会员体系、配置同步走自有路径，不提供 Google Drive 同步。这张卡片留在界面上会误导用户去点一个不支持的功能。需要把它隐藏。

隐藏一张上游卡片本是 fork 已有的成熟套路（重定向到 fork 空组件），但本卡片是**目录桶导入**（`import { GoogleDriveSyncCard } from "./google-drive-sync"`，解析到 `google-drive-sync/index.tsx`），而现有重定向插件的 basename 预筛对桶导入是盲区——直接照搬会**静默失效**（卡片照常渲染、所有护栏全绿、只有人工打开选项页才暴露）。故本次一并修复重定向机制并为其补上回归护栏。

## What Changes

- **隐藏 Google Drive 同步卡**：选项页「配置」页不再展示该卡片——经构建期重定向把上游 `GoogleDriveSyncCard` 顶替为 fork 空组件（渲染空），不编辑上游配置页；同页其它板块（Beta 体验 / 手动配置同步 / 配置备份 / 关于 / 重置）不受影响。
- **修复重定向机制支持目录桶导入**：现有 fork UI 重定向插件的预筛对 `<dir>/index.tsx` 桶导入不命中、会让重定向静默失效；本次修正预筛判定，使桶导入也能被正确拦截，一处修复令未来所有目录桶重定向都生效。
- **重定向插件迁入 fork 领地并可测**：把重定向插件工厂从构建配置抽入 fork 自有模块（重定向清单作入参传入），消除潜在循环依赖，并使其重定向判定可被单元测试覆盖。

## Capabilities

### New Capabilities

- `fork-hide-google-drive-sync`: 隐藏选项页配置页的 Google Drive 云端同步卡片（经重定向到 fork 空组件），并保证 fork UI 重定向机制正确处理目录桶导入、不静默失效。

### Modified Capabilities

<!-- 无：重定向插件此前未成文规格，本变更以新能力一并描述其桶导入正确性要求。 -->

## Impact

- **代码**：净新增 fork 空组件与重定向插件模块（`src/fork/**`）+ 重定向插件单测；`wxt.config.ts`（allowlist 内）改为 import fork 插件接线、新增一条重定向条目、清理随插件迁走的死 import。不编辑上游源文件、不改 config schema / 后端。
- **不影响**：上游 `config/index.tsx` 与配置页其它板块不动；隐藏后 `google-drive-sync/` 子树与 `src/utils/google-drive/*` 变死代码（按 fork 纪律保留、不删）；无后台自动同步，隐藏卡片即从视图与可达性移除该功能。
- **测试参考**（一模块一行）：
  - 重定向插件：目录桶导入被重定向到 fork `to` / 单叶子重定向不回归 / 非匹配返回 null / 无 importer 或自引返回 null / 预筛集与归一化正确。
