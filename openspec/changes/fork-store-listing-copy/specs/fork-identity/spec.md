## MODIFIED Requirements

### Requirement: fork 扩展身份

系统 SHALL 在 manifest 工厂中按 edition 设置市场可见名称与原有 `version_name`、Firefox `gecko.id`：国内版 `name` MUST 为「任译喵 - AI 翻译与双语阅读」，海外版 `name` MUST 为「TranslateBuff – AI Translator & Reader」。`name` 不随界面语言变化；国内已上架的 `gecko.id` MUST 保持 `translatebuff@translatebuff.com`，海外版 MUST 保持 `overseas@translatebuff.com`。`FORK_BRANDING.name`、`APP_NAME`、shadow-host 自定义元素名、IndexedDB 库名及 ZIP 命名 MUST NOT 随可见标题变化。

#### Scenario: 构建国内版商店与安装标题

- **当** 以 `cn` edition 构建 Chrome、Edge 或 Firefox 正式包
- **则** 每份 manifest 的 `name` MUST 为「任译喵 - AI 翻译与双语阅读」
- **并且** Firefox `gecko.id` MUST 为 `translatebuff@translatebuff.com`

#### Scenario: 构建海外版商店与安装标题

- **当** 以 `global` edition 构建 Chrome、Edge 或 Firefox 正式包
- **则** 每份 manifest 的 `name` MUST 为「TranslateBuff – AI Translator & Reader」，不得出现 HTML 实体 `&amp;` 或中文品牌名
- **并且** Firefox `gecko.id` MUST 为 `overseas@translatebuff.com`

#### Scenario: 技术标识与扩展身份不随标题改变

- **当** 构建两条 edition 并读取 `version_name`、`APP_NAME`、自定义元素名及 Firefox 扩展 ID
- **则** `APP_NAME` MUST 仍为 `TranslateBuff`、自定义元素名 MUST 仍为 `translate-buff`，`version_name` MUST 继续沿用各自发行版短品牌与版本溯源
- **并且** 两条版的 Firefox 扩展 ID MUST 保持既有取值且互不相同，持久化配置与密钥无需迁移

#### Scenario: 外部测试明确跳过

- **当** 本地测试设置 `SKIP_FREE_API=true`
- **则** free-api.test.ts MUST 被明确记录为跳过，不被计作外部在线翻译服务验证通过
