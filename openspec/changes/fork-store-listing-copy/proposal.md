## Why

国内和海外扩展的商店标题、短描述仍是旧文案；仅修改商店后台不能更新随扩展包发布的清单身份。需要按两条发行版更新可见名称和对应语言简介，同时保持现有品牌与技术身份边界。

## What Changes

- 国内包的安装名称改为「任译喵 - AI 翻译与双语阅读」，简体中文短描述改为「使用 20+ AI 模型翻译网页、文本、消息和视频字幕。支持双语阅读、翻译对比和上下文理解。」。
- 海外包的安装名称改为「TranslateBuff – AI Translator & Reader」，英文短描述改为「Translate webpages, text, messages, and subtitles with 20+ AI models. Read bilingually, compare translations, and stay in context.」。标题里的 `&` 是普通字符，不使用 HTML 实体。
- 其他语言的描述维持既有内容与本地化规则：海外版中文描述中的品牌始终是 `TranslateBuff`，国内版其他语言中的品牌始终是「任译喵」。两条线的技术标识、Firefox 扩展 ID、版本、渠道和后端配置不变。
- 不包含商店后台长描述、截图、上架操作及独立的 360 CRX 自动签名改造。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `fork-identity`：两条发行版的 manifest 可见名称由原品牌短名改为已确认的市场标题；品牌技术标识和扩展 ID 保持不变。
- `fork-upstream-cloud-isolation`：补充浏览器管理页描述的发行版与语言组合要求，防止海外中文版文案将品牌译为「任译喵」。

## Impact

- 影响 `wxt.config.ts` 的清单名称及 `src/fork/i18n/chrome-messages.ts` 的构建期描述处理；验证范围包括国内/海外 Chrome、Edge、Firefox 的生成资源和现有品牌隔离测试。
- 名称与简介变更须重新打包、经各商店审核发布；安装后的扩展名称将同步变化。运行时技术标识、既有配置及数据不迁移。
