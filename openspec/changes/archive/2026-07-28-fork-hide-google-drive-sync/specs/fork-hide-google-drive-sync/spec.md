# fork-hide-google-drive-sync

隐藏选项页「配置」页的 Google Drive 云端同步卡片——该功能是上游 read-frog 提供、任译喵不支持，留着误导用户。隐藏经构建期重定向把上游 `GoogleDriveSyncCard` 顶替为 fork 空组件实现，不编辑上游源文件。因该卡片是**目录桶导入**（`from "./google-drive-sync"` 解析到 `google-drive-sync/index.tsx`），本能力同时要求 fork UI 重定向机制正确处理目录桶导入，否则重定向会静默失效（卡片照常渲染、护栏全绿、只人工可察）。

## ADDED Requirements

### Requirement: 配置页不展示 Google Drive 同步卡

选项页「配置」页 MUST NOT 展示 Google Drive 云端同步卡片；其入口（授权 / 同步按钮 / 未决对话框）随之不可达。隐藏 MUST 经构建期重定向把上游 `GoogleDriveSyncCard` 顶替为渲染空的 fork 组件实现，MUST NOT 编辑上游 `config/index.tsx` 或改动 config schema。

#### Scenario: 打开配置页看不到 Google Drive 同步卡

- **GIVEN** `[UI层]` 用户打开选项页「配置」页
- **WHEN** 页面渲染完成
- **THEN** MUST NOT 出现「Google Drive 云端同步」卡片
- **AND** 同页其它板块（Beta 体验 / 手动配置同步 / 配置备份 / 关于 / 重置）MUST 照常展示、不受影响

### Requirement: fork UI 重定向正确处理目录桶导入

fork UI 重定向机制对「目录桶导入」（import specifier 为目录、解析到 `<dir>/index.tsx`）MUST 能正确拦截并重定向到 fork 目标；MUST NOT 因 basename 预筛只认末段而对桶导入静默失效。对既有单叶子文件重定向 MUST 保持逐字等价、不回归。

#### Scenario: 目录桶导入被重定向到 fork 目标

- **GIVEN** `[构建层]` 一条重定向 `from = <dir>/index.tsx`，上游某文件 `import X from "./<dir>"`（specifier 末段为 `<dir>`，解析后 id 为 `<dir>/index`）
- **WHEN** 插件解析该 import
- **THEN** 预筛 MUST 放行（登记了父目录名 `<dir>`）、匹配 MUST 命中、MUST 返回 fork `to`

#### Scenario: 既有单叶子重定向不回归

- **GIVEN** `[构建层]` 一条重定向 `from = <path>/foo.tsx`，上游 `import X from "./foo"`
- **WHEN** 插件解析该 import
- **THEN** MUST 仍返回其 fork `to`（预筛判定对非 index 文件与修复前逐字等价）

### Requirement: 重定向不误伤、无重定向时安全早退

重定向插件 MUST 仅在「有 importer、且解析后绝对路径精确匹配某条 `from`、且 importer 不是该条 `to`（自引豁免）」时返回 fork `to`；其余情形 MUST 返回 null 交由默认解析。预筛放宽（对 index 桶登记父目录名）MUST NOT 造成错误重定向——非匹配路径 MUST 因精确匹配关失败而返回 null。

#### Scenario: 与桶父目录同名的无关模块不被误重定向

- **GIVEN** `[构建层]` 存在与桶父目录同名、但绝对路径不同的无关模块（如 `utils/atoms/<dir>`）
- **WHEN** 该无关 import 经插件解析
- **THEN** 预筛可能放行，但精确匹配关 MUST 失败、MUST 返回 null（不被重定向）

#### Scenario: 无 importer 或自引时不重定向

- **GIVEN** `[构建层]` importer 缺失，或 importer 正是该重定向的 `to`（fork 目标 import 其替换的上游原版）
- **WHEN** 插件解析
- **THEN** MUST 返回 null（不重定向，避免自引循环）

### Requirement: 隐藏不留后台副作用与活引用

隐藏后，被顶替的 `google-drive-sync/**` 子树及其专属依赖 MUST 无幸存的 live importer（可被 tree-shake 移除）；MUST NOT 存在绕过该 UI 卡片的后台自动同步在隐藏后仍执行。

#### Scenario: 隐藏后无后台自动同步残留

- **GIVEN** `[构建层]` Google Drive 同步卡已被重定向为 fork 空组件
- **WHEN** 扩展运行
- **THEN** MUST NOT 有后台 entrypoint 触发 Google Drive 同步（该功能仅经已隐藏的 UI 卡片可达）
