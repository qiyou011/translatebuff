## Context

当前 `wxt.config.ts` 以 `getForkDisplayName(edition)` 填入不随语言变化的 `manifest.name`，并用 `__MSG_extDescription__` 指向生成的 `_locales/<locale>/messages.json`。`src/fork/i18n/chrome-messages.ts` 在构建期按发行版替换描述中的品牌，但两版共用九份 YAML 文案。现有 `fork-global-edition` 增量规格明确限定名称为品牌短名，新目标名称与其冲突，须由本变更的增量规格更新。技术标识 `FORK_BRANDING.name` 还用于 APP_NAME、存储、自定义元素和 ZIP 命名，不能改动。

## Goals / Non-Goals

**目标**：国内包 `manifest.name` 为「任译喵 - AI 翻译与双语阅读」，海外包为「TranslateBuff – AI Translator & Reader」；国内简体中文和海外英文的本地化 `extDescription` 分别采用已确认的总结原文。海外包中文资源仍保留 `TranslateBuff` 品牌；两版任何非目标语种描述和现有运行时品牌展示保持原规则。

**非目标**：不修改 `FORK_BRANDING.name`、`APP_NAME`、Firefox ID、版本、渠道号及后端；不改变商店后台的长描述/素材，不提交到商店；不合并独立 360 CRX 自动签名改造，不为其他语言撰写翻译稿。

## Decisions

1. **清单名称独立于技术名**：在 fork 品牌模块为市场可见名称新增按 edition 取值的专用函数，`wxt.config.ts` 的 `manifest.name` 改用它；现有 `getForkDisplayName()` 继续为运行时短品牌服务，`version_name` 与 ZIP 文件名也不变。国内与海外扩展安装后的名称随 manifest 更新，此影响已经获得确认。不选直接覆盖 `FORK_BRANDING.name`，因为它是持久化数据与 DOM 的稳定标识。
2. **仅在构建资源的单一接缝覆写两条总结**：`brandChromeMessages` 继续执行现有品牌替换，再由调用方传入生成资源的确切 locale，只在 `cn+zh_CN` 和 `global+en` 覆写 `extDescription.message`。只处理该字段，保留其他消息及 `description` 等元数据；未匹配的语言继续走旧品牌规则。生成资源路径沿用 `wxt.config.ts` 当前 `_locales/<locale>/messages.json` 匹配条件，不按 UI 运行时语言推断。共用 YAML 保留原文，避免改掉另一版及形成两份目标文案来源。
3. **实包检验是文案验收边界**：对 cn/global 的 Chrome、Edge、Firefox 正式包检查 `manifest.name`、默认与目标语言 `extDescription` 原文、其余语言的发行版品牌。目标标题中的 `&` 是普通字符，不写 HTML 实体。对 cn/global × en/zh_CN/zh_TW 的非目标组合明确断言没有另一版总结，避免本地化串线。

## 数据模型 / 接口契约

只调整构建期 `manifest.name` 及资源消息 `extDescription.message`。函数 `brandChromeMessages(contents, edition, locale)` 接收生成文件内容、发行版及 `en`/`zh_CN` 等资源目录名；返回保持 JSON 结构的序列化内容。未引入新后端接口、存储字段或依赖。商店后台长描述依然独立维护。

## Risks & Mitigations

- **品牌串线**：海外版简/繁中文描述必须仍为 `TranslateBuff`；两版互相不允许进入目标短描述。通过现有品牌测试和双版多语言构建验收。
- **发行身份误改**：manifest 名称变化不可影响技术标识、版本名、扩展 ID 和产物文件名；对照发行前后构建产物与已有身份测试。
- **描述长度**：海外英文 130 字符，靠近 Chrome 132 字符上限；单测断言两条短描述满足清单限制，不在实现中临时润色或截断。
- **回滚**：若商店拒绝新标题/描述，恢复可见名称与目标文案覆盖，重新构建并提交新包；不需要迁移本地数据。

## Open Questions

无；中文品牌不可翻译及安装后名称变化均已由用户确认。
