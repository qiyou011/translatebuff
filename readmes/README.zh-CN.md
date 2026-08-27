<div align="center"><a name="readme-top"></a>

[![任译喵][image-banner]][website]

一款开源的 AI 驱动的浏览器语言学习扩展。<br/>
支持沉浸式翻译、文章分析、多种 AI 模型等功能。<br/>
在浏览器中利用 AI 轻松深入地掌握语言。

[![English][english-shield]](../README.md) [![简体中文][chinese-shield]](./README.zh-CN.md) [![繁體中文][traditional-chinese-shield]](./README.zh-TW.md) [![日本語][japanese-shield]](./README.ja.md) [![한국어][korean-shield]](./README.ko.md) [![Español][spanish-shield]](./README.es.md) [![Русский][russian-shield]](./README.ru.md) [![Türkçe][turkish-shield]](./README.tr.md) [![Tiếng Việt][vietnamese-shield]](./README.vi.md)

[官方网站][website] · [教程][docs-tutorial] · [博客][blog]

</div>

<details>
<summary><kbd>目录</kbd></summary>

#### 目录

- [📺 演示](#-演示)
- [👋🏻 快速开始 \& 加入我们的社区](#-快速开始--加入我们的社区)
  - [下载](#下载)
  - [社区](#社区)
- [✨ 功能](#-功能)
  - [🔄 双语 / 仅译文](#-双语--仅译文)
  - [✨ 划词翻译](#-划词翻译)
  - [🧠 上下文感知翻译](#-上下文感知翻译)
  - [🎬 字幕翻译](#-字幕翻译)
  - [🔊 文字转语音 (TTS)](#-文字转语音-tts)
  - [📦 批量请求](#-批量请求)
  - [🤖 内置 AI 翻译](#-内置-ai-翻译)
- [🤝 贡献](#-贡献)
  - [贡献代码](#贡献代码)
  - [构建与打包](#构建与打包)

<br/>

</details>

## 📺 演示

<div align="center">
  <img src="../assets/node-translation-demo.gif" width="38%" alt="任译喵 弹窗界面" />
  <img src="../assets/page-translation-demo.gif" width="60%" alt="任译喵 翻译界面" />
</div>

## 👋🏻 快速开始 & 加入我们的社区

任译喵 的愿景是为各个级别的语言学习者提供易于使用、智能化和个性化的语言学习体验。这在 AI 时代已成为可能，但市场上很少有产品满足这一需求。因此，我们决定自己动手，最终让世界不再依赖人类语言教师。

无论您是用户还是开发者，任译喵 都将是您实现这一愿景的方式。请注意，任译喵 目前正在积极开发中，欢迎对遇到的任何问题提供反馈。

### 下载

> 浏览器商店正在上架中。目前请从官方网站获取 任译喵：**[translatebuff.cn][website]**

| 浏览器  | 下载                |
| ------- | ------------------- |
| Chrome  | [官方网站][website] |
| Edge    | [官方网站][website] |
| Firefox | [官方网站][website] |

### 社区

| [![WeChat badge][wechat-shield-badge]][wechat-link] | 如果您在中国大陆，可以添加微信账号加入微信群。 |
| :-------------------------------------------------- | :--------------------------------------------- |

## ✨ 功能

借助 任译喵 的强大功能，将您的日常网页阅读转变为沉浸式语言学习之旅。

### 🪄 [自定义 AI 指令][docs-tutorial]

把选中的文字变成符合你阅读和学习习惯的可复用 AI 工具。你可以自定义提示词和结构化输出字段，选择提供商、模型与图标，然后直接从划词工具栏运行，用于查词、改写、总结、解释或任何自定义工作流。

可以从内置的**词典**和**改进写作**模板开始，也可以从零创建。

<div align="right">

[![Back to top][back-to-top]](#readme-top)

</div>

<!-- ![][image-feat-bilingual] -->

### 🔄 [双语 / 仅译文][docs-tutorial]

在两种翻译显示模式之间无缝切换。**双语模式**将原文与译文并排显示，非常适合学习和对比。**仅译文模式**完全替换原文，提供更简洁的阅读体验。

当翻译处于激活状态时切换模式，扩展会自动重新翻译所有可见内容，确保平滑过渡，无需刷新页面。

<div align="right">

[![Back to top][back-to-top]](#readme-top)

</div>

<!-- ![][image-feat-selection] -->

### ✨ [划词翻译][docs-tutorial]

在网页上选择任何文本即可显示智能工具栏。**翻译**实时流式输出翻译结果。**解释**根据您的语言水平提供详细解释。**朗读**使用文字转语音功能朗读文本。

工具栏会智能定位以保持在视口内，支持拖拽交互，并可在所有网站上使用。非常适合阅读时快速查词。

<div align="right">

[![Back to top][back-to-top]](#readme-top)

</div>

<!-- ![][image-feat-context] -->

### 🧠 [上下文感知翻译][docs-tutorial]

让 AI 理解您正在阅读内容的完整上下文。启用后，任译喵 会提取页面标题和简洁的 Markdown 页面内容，将此上下文提供给 AI，以获得更准确、更符合语境的翻译。

这意味着技术术语会在其领域内被正确翻译，文学表达会保持其韵味，歧义短语会根据周围内容而非孤立地进行解释。

<div align="right">

[![Back to top][back-to-top]](#readme-top)

</div>

<!-- ![][image-feat-subtitle] -->

### 🎬 [字幕翻译][docs-tutorial]

直接在视频播放器中翻译 YouTube 字幕。观看外语内容时，翻译会与原始字幕一起显示，让视频内容成为语言学习的好帮手。

<div align="right">

[![Back to top][back-to-top]](#readme-top)

</div>

<!-- ![][image-feat-tts] -->

### 🔊 [文字转语音 (TTS)][docs-tutorial]

使用高质量 AI 语音朗读任何选中的文本。由 **Edge TTS** 驱动——完全免费，提供 150+ 种语音，覆盖 80+ 种语言，包括中文、英文、日文、韩文等。可自由调节语速、音调和音量。

自动语言检测（基础模式或 LLM 驱动）与按语言映射语音，确保每种语言使用最合适的语音。智能的句子感知分块功能处理长文本时会在自然边界处分割，并预取下一个片段以实现无缝播放。非常适合发音练习和听力学习。

<div align="right">

[![Back to top][back-to-top]](#readme-top)

</div>

<!-- ![][image-feat-batch] -->

### 📦 [批量请求][docs-tutorial]

通过智能请求批处理节省高达 70% 的 API 成本。任译喵 将多个翻译请求合并为单次 API 调用，在保持翻译质量的同时减少开销和令牌使用。

系统包含智能重试逻辑，支持指数退避，并在批处理失败时自动回退到单独请求。所有操作都在后台透明处理。

<div align="right">

[![Back to top][back-to-top]](#readme-top)

</div>

<!-- ![][image-feat-providers] -->

### 🤖 [内置 AI 翻译][docs-tutorial]

登录即可开始翻译，无需自带 API Key。任译喵 内置的 AI 翻译服务会自动下发密钥，并提供多个 AI 模型，你可以为每个功能选择不同的模型。

想要更轻量的选择？也可以使用 Google 翻译和微软翻译的普通翻译。

<div align="right">

[![Back to top][back-to-top]](#readme-top)

</div>

## 🤝 贡献

我们欢迎各种类型的贡献。

1. 向您的朋友和家人推广 任译喵。
2. 报告问题和反馈。
3. 贡献代码。

### 贡献代码

查看[贡献指南](https://translatebuff.cn/zh/docs/code-contribution/contribution-guide)了解更多详情。

贡献者许可条款请参阅 [CONTRIBUTING.md](../CONTRIBUTING.md)。

### 构建与打包

本仓库出两条发行版，后端与商店条目彼此独立：`cn`（translatebuff.cn）与 `global`（translatebuff.com）。一律用 `scripts/pack.mjs` 打包——直接跑 `wxt zip` 会绕过两条线的域名护栏。

```bash
node scripts/pack.mjs test --edition global                        # test build
node scripts/pack.mjs store --edition global --channel global-zip  # store build, one channel
node scripts/pack.mjs store --edition global --all                 # store build, every channel
```

去掉 `--edition global` 即打国内版。产物在 `.output/`，加载已解压的 `.output/chrome-mv3-global/` 即可试用。测试包读取本地的 `.env.global`（已被 gitignore）——各发行版需要哪些变量见 [.env.example](../.env.example)，发行版模型见 [FORK_GUIDE.md](../FORK_GUIDE.md)。

<div align="right">

[![Back to top][back-to-top]](#readme-top)

</div>

<!-- LINK GROUP -->

[back-to-top]: https://img.shields.io/badge/-回到顶部-151515?style=flat-square
[chinese-shield]: https://img.shields.io/badge/%E7%AE%80%E4%BD%93%E4%B8%AD%E6%96%87-gray?style=flat-square
[english-shield]: https://img.shields.io/badge/English-gray?style=flat-square
[image-banner]: ../assets/renyimiao-icon.svg
[japanese-shield]: https://img.shields.io/badge/%E6%97%A5%E6%9C%AC%E8%AA%9E-gray?style=flat-square
[korean-shield]: https://img.shields.io/badge/%ED%95%9C%EA%B5%AD%EC%96%B4-gray?style=flat-square
[russian-shield]: https://img.shields.io/badge/%D0%A0%D1%83%D1%81%D1%81%D0%BA%D0%B8%D0%B9-gray?style=flat-square
[spanish-shield]: https://img.shields.io/badge/Espa%C3%B1ol-gray?style=flat-square
[traditional-chinese-shield]: https://img.shields.io/badge/%E7%B9%81%E9%AB%94%E4%B8%AD%E6%96%87-gray?style=flat-square
[turkish-shield]: https://img.shields.io/badge/T%C3%BCrk%C3%A7e-gray?style=flat-square
[vietnamese-shield]: https://img.shields.io/badge/Ti%E1%BA%BFng%20Vi%E1%BB%87t-gray?style=flat-square
[wechat-link]: https://translatebuff.cn
[wechat-shield-badge]: https://img.shields.io/badge/聊天-微信-07C160?style=for-the-badge&logo=wechat&logoColor=white&labelColor=black
[website]: https://translatebuff.cn

<!-- Feature docs link -->

[docs-tutorial]: https://translatebuff.cn/zh/docs
[blog]: https://translatebuff.cn/zh/blog
