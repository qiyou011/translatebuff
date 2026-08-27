## MODIFIED Requirements

### Requirement: fork 扩展身份

系统 SHALL 在 `wxt.config.ts` 的 manifest 工厂中设置 fork 品牌 `name` 与 `version_name`，并设置 fork 专属的 Firefox `gecko.id`，避免依赖 `_locales` 完成命名。`name` 与 `gecko.id` MUST 由当前 edition 决定：国内线取中文品牌名与已上架 AMO 的既有扩展 ID，海外线取英文品牌名与另起的海外扩展 ID。国内线 `gecko.id` MUST NOT 被改动（AMO 扩展 ID 上架后不可更改，改动等同发布新扩展）。技术标识（`APP_NAME`、shadow-host 自定义元素名、IndexedDB 库名）MUST NOT 随 edition 变化。

#### Scenario: manifest 使用 fork 身份

- **WHEN** 构建任意目标
- **THEN** manifest `name` 为 fork 品牌名、`version_name` 含品牌名与 4 段版本；firefox 目标的 `browser_specific_settings.gecko.id` 为 fork 专属值（区别于上游）

#### Scenario: 国内线取中文名与既有扩展 ID

- **GIVEN** edition 为 `cn`
- **WHEN** 构建 firefox 目标
- **THEN** manifest `name` MUST 为中文品牌名「任译喵」
- **AND** `gecko.id` MUST 为 `translatebuff@translatebuff.com`，与已上架 AMO 的取值逐字一致

#### Scenario: 海外线取英文名与海外扩展 ID

- **GIVEN** edition 为 `global`
- **WHEN** 构建 firefox 目标
- **THEN** manifest `name` MUST 为英文品牌名 `TranslateBuff`
- **AND** `gecko.id` MUST 为 `overseas@translatebuff.com`

#### Scenario: 两线扩展 ID 互不相同

- **GIVEN** 分别以两个 edition 构建 firefox 产物
- **WHEN** 比对两份 manifest 的 `gecko.id`
- **THEN** 二者 MUST 不相等，以免 AMO 上架撞车

#### Scenario: 技术标识不随 edition 漂移

- **GIVEN** 任一 edition
- **WHEN** 读取产物中的 `APP_NAME` 及其派生的自定义元素名
- **THEN** MUST 为稳定 ASCII 值 `TranslateBuff` 及其 kebab 形式 `translate-buff`
- **AND** kebab 结果 MUST 含连字符（自定义元素名硬要求，无连字符会导致内容脚本 attachShadow 崩溃）
