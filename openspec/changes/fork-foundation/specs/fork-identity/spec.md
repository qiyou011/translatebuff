## ADDED Requirements

### Requirement: 独立 4 段 manifest 版本（B1）

系统 SHALL 由上游 3 段 `package.json` 版本派生 fork 的 4 段 manifest `version`（形如 `pkg.version.forkBuild`），其中 fork build 号来自 fork 专属文件，取新上游版本时归零；`package.json` 的 `version` 保持 take-theirs。

#### Scenario: 派生 4 段版本号

- **WHEN** 上游版本为 `1.40.2`、fork build 号为 `3`
- **THEN** `computeForkVersion("1.40.2", 3)` 返回 `"1.40.2.3"`

#### Scenario: 拒绝非法上游版本

- **WHEN** 传入非 3 段的版本串（如 `"1.40"`）
- **THEN** `computeForkVersion` 抛出错误

#### Scenario: 构建产物携带 fork 版本

- **WHEN** 执行 `pnpm run build` 后读取 `.output/chrome-mv3/manifest.json`
- **THEN** `version` 为 4 段数字，`name` 为 fork 品牌名

### Requirement: fork 扩展身份

系统 SHALL 在 `wxt.config.ts` 的 manifest 工厂中以字面量设置 fork 品牌 `name` 与 `version_name`，并设置 fork 专属的 Firefox `gecko.id`，避免依赖 `_locales` 完成命名。

#### Scenario: manifest 使用 fork 身份

- **WHEN** 构建任意目标
- **THEN** manifest `name` 为 fork 品牌名、`version_name` 含品牌名与 4 段版本；firefox 目标的 `browser_specific_settings.gecko.id` 为 fork 专属值（区别于上游）

### Requirement: 去品牌化

系统 SHALL 把 `APP_NAME` 与卸载调研 URL 指向 fork 品牌来源，使运行时标识不再呈现 read-frog 品牌。

#### Scenario: APP_NAME 来自 fork 品牌

- **WHEN** 读取 `src/utils/constants/app.ts` 的 `APP_NAME`
- **THEN** 其值来自 fork 品牌常量（如 `Translatebuff`），而非硬编码 `"Read Frog"`

#### Scenario: 卸载调研指向 fork

- **WHEN** 触发卸载调研 URL 设置
- **THEN** URL 指向 fork 站点，而非 readfrog 域名
