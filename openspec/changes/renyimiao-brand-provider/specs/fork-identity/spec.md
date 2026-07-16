## MODIFIED Requirements

### Requirement: 预发布 manifest 版本 0.0.x（B1）

系统 SHALL 在正式版发布前，将 manifest `version` 设为 `0.0.<forkBuild>` 三段格式——fork 自主版本、**不再继承上游 `package.json` 版本号**；`forkBuild` 来自 `src/fork/identity/fork-build.json`，从 `1` 起单调递增（首个预发布为 `0.0.1`）。manifest `version_name` MUST 为 `<中文品牌> 0.0.<forkBuild>（rf <上游版本>）`，保留上游基线溯源。`package.json` 的 `version` 仍保持 take-theirs。正式版发布时的版本方案另行决定（本变更不定）。

#### Scenario: 预发布版本号为 0.0.x

- **GIVEN** `[数据层]` `fork-build.json` 的 `forkBuildNumber` 为 `1`
- **WHEN** 计算 fork 版本
- **THEN** manifest `version` MUST 为 `"0.0.1"`（三段、不含上游 `1.40.2`）

#### Scenario: version_name 保留上游基线

- **GIVEN** `[数据层]` 上游版本为 `1.40.2`、`forkBuildNumber` 为 `1`、中文品牌为"任译喵"
- **WHEN** 构建任意目标
- **THEN** manifest `version_name` MUST 为 `"任译喵 0.0.1（rf 1.40.2）"`

#### Scenario: 构建产物携带预发布版本

- **WHEN** 执行 `pnpm run build` 后读取 `.output/chrome-mv3/manifest.json`
- **THEN** `version` 为 `0.0.<forkBuild>` 三段数字、`name` 为中文品牌名"任译喵"

### Requirement: fork 扩展身份

系统 SHALL 在 `wxt.config.ts` 的 manifest 工厂中以字面量设置 fork 品牌显示名与 `version_name`，并设置 fork 专属的 Firefox `gecko.id`，避免依赖 `_locales` 完成命名。其中 manifest `name` MUST 取 fork 品牌**中文显示名"任译喵"**；英文标识 `Translatebuff` 保留用于不适合中文的场景（Firefox `gecko.id`、域名、英文环境回退），MUST NOT 因中文显示名而改动 `gecko.id`。

#### Scenario: manifest 使用中文显示名与 fork 身份

- **GIVEN** `[数据层]` fork 品牌常量提供中文显示名"任译喵"与英文标识"Translatebuff"
- **WHEN** 构建任意目标
- **THEN** manifest `name` 为"任译喵"、`version_name` 含中文显示名与 `0.0.x` 版本；firefox 目标的 `browser_specific_settings.gecko.id` 保持 fork 专属英文值 `translatebuff@translatebuff.com`（区别于上游、不受中文显示名影响）

### Requirement: 品牌显示名与技术标识分离

系统 SHALL 把 fork 品牌的"显示名"与"技术标识"分离：`src/fork/branding.ts` MUST 提供 `displayName`（中文"任译喵"，用户可见品牌）与 `name`（ASCII "Translatebuff"，技术标识）两个字段。`APP_NAME` MUST 取 ASCII 技术标识字段并保持稳定——因其被上游用作 IndexedDB 库名（`${upperCamelCase(APP_NAME)}DB`）、shadow-host 自定义元素名（`${kebabCase(APP_NAME)}-*`）、guide postMessage 源标识、HTTP 头等**技术标识**，改为中文会导致自定义元素名非法（内容脚本崩溃）与 DB 改名（老用户数据变孤儿）。中文显示名 MUST 仅用于 fork 可控的品牌露出点（manifest `name`、popup 头部）。卸载调研 URL 指向 fork 站点。

#### Scenario: APP_NAME 保持 ASCII 技术标识

- **WHEN** 读取 `src/utils/constants/app.ts` 的 `APP_NAME`
- **THEN** 其值为 ASCII 技术标识"Translatebuff"（非 `"Read Frog"`、非中文），使 DB 库名、自定义元素名、postMessage 源等技术标识稳定不破坏

#### Scenario: 中文显示名用于 fork 可控露出点

- **GIVEN** `[UI层]` fork 品牌常量提供 `displayName="任译喵"`
- **WHEN** 用户在浏览器扩展列表（manifest `name`）与 popup 首屏头部查看品牌
- **THEN** 两处 MUST 显示中文"任译喵"

#### Scenario: 上游技术+次要显示点保持英文（已知限制）

- **WHEN** 查看 sidepanel 标题、toast、字幕面板标题等上游文件中经 `APP_NAME` 渲染的处
- **THEN** 其显示仍为英文"Translatebuff"（不编辑上游文件、不扩 allowlist）；如需全中文化为后续独立变更

#### Scenario: 卸载调研指向 fork

- **WHEN** 触发卸载调研 URL 设置
- **THEN** URL 指向 fork 站点，而非 readfrog 域名
