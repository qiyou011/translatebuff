## MODIFIED Requirements

### Requirement: 产品品牌按发行版而非界面语言显示

系统 SHALL 在国内版显示“任译喵”、海外版显示“TranslateBuff”，覆盖产品头部、API 提供商标题、模型分组和扩展管理页本地化描述；界面说明及登录、加载、更新反馈 SHALL 使用当前界面语言。市场可见的完整标题按 `fork-identity` 规格设定，不得用于代替运行时短品牌或技术标识。只有国内简体中文与海外英文的扩展管理页短描述采用本次确认的目标文案；其他语言的描述保持既有含义和发行版品牌。

#### Scenario: 海外版切换中文界面

- **当** 海外版用户将界面语言切换为简体或繁体中文
- **则** 界面说明 MUST 使用所选语言，产品品牌及浏览器管理页本地化描述中的品牌 MUST 为 `TranslateBuff`，不得出现“任译喵”
- **并且** 国内版切换英文界面时产品品牌 MUST 仍为“任译喵”

#### Scenario: 国内简体中文目标短描述

- **当** 构建国内版并读取 `_locales/zh_CN/messages.json` 的 `extDescription.message`
- **则** MUST 为「使用 20+ AI 模型翻译网页、文本、消息和视频字幕。支持双语阅读、翻译对比和上下文理解。」
- **并且** 国内版英文及其他语言资源 MUST NOT 复用该目标短描述

#### Scenario: 海外英文目标短描述

- **当** 构建海外版并读取 `_locales/en/messages.json` 的 `extDescription.message`
- **则** MUST 为「Translate webpages, text, messages, and subtitles with 20+ AI models. Read bilingually, compare translations, and stay in context.」
- **并且** 海外版中文及其他语言资源 MUST NOT 复用该目标短描述

#### Scenario: 九种语言资源覆盖自有模型界面

- **当** 用户在任一现有九种界面语言下打开自有 API 配置或查看登录、加载、模型更新反馈
- **则** 对应文案 MUST 使用该语言，不残留硬编码中文标签或状态提示；浏览器管理页未被本次定点覆写的描述 MUST 使用当前发行版品牌
