<div align="center"><a name="readme-top"></a>

[![Translatebuff][image-banner]][website]

An open-source AI-powered language learning extension for browsers.<br/>
Supports immersive translation, article analysis, multiple AI models, and more.<br/>
Master languages effortlessly and deeply with AI, right in your browser.

[![English][english-shield]](./README.md) [![简体中文][chinese-shield]](./readmes/README.zh-CN.md) [![繁體中文][traditional-chinese-shield]](./readmes/README.zh-TW.md) [![日本語][japanese-shield]](./readmes/README.ja.md) [![한국어][korean-shield]](./readmes/README.ko.md) [![Español][spanish-shield]](./readmes/README.es.md) [![Русский][russian-shield]](./readmes/README.ru.md) [![Türkçe][turkish-shield]](./readmes/README.tr.md) [![Tiếng Việt][vietnamese-shield]](./readmes/README.vi.md)

[Official Website][website] · [Tutorial][docs-tutorial] · [Blog][blog]

</div>

<details>
<summary><kbd>Table of contents</kbd></summary>

#### TOC

- [📺 Demo](#-demo)
- [👋🏻 Getting Started](#-getting-started)
  - [Download](#download)
  - [Community](#community)
- [✨ Features](#-features)
  - [🪄 Custom AI Actions](#-custom-ai-actions)
  - [🔄 Bilingual / Translation Only](#-bilingual--translation-only)
  - [✨ Selection Translation](#-selection-translation)
  - [🧠 Context-Aware Translation](#-context-aware-translation)
  - [🎬 Subtitle Translation](#-subtitle-translation)
  - [🔊 Text-to-Speech (TTS)](#-text-to-speech-tts)
  - [📦 Batch Requests](#-batch-requests)
  - [🤖 Built-in AI Translation](#-built-in-ai-translation)
- [🤝 Contribute](#-contribute)
  - [Contribute Code](#contribute-code)

<br/>

</details>

## 📺 Demo

<div align="center">
  <img src="assets/node-translation-demo.gif" width="38%" alt="Translatebuff Popup Interface" />
  <img src="assets/page-translation-demo.gif" width="60%" alt="Translatebuff Translation Interface" />
</div>

## 👋🏻 Getting Started

Translatebuff's vision is to provide an easy-to-use, intelligent, and personalized language learning experience for language learners of all levels. This has become possible in the AI era, but there are few products on the market that meet this demand. Therefore, we decided to take matters into our own hands and ultimately make the world no longer reliant on human language instructors.

Whether you are a user or a developer, Translatebuff will be an important part of your journey toward this vision. Please be aware that Translatebuff is currently under active development, and feedback is welcome.

### Download

> Browser store listings are on the way. For now, get Translatebuff from the official website: **[translatebuff.cn][website]**

| Browser | Download                    |
| ------- | --------------------------- |
| Chrome  | [Official Website][website] |
| Edge    | [Official Website][website] |
| Firefox | [Official Website][website] |

### Community

| [![WeChat badge][wechat-shield-badge]][wechat-link] | If you are in mainland China, you can add the WeChat account to join the WeChat group. |
| :-------------------------------------------------- | :------------------------------------------------------------------------------------- |

## ✨ Features

Transform your everyday web reading into an immersive language learning journey with Translatebuff's powerful features.

### 🪄 [Custom AI Actions][docs-tutorial]

Turn selected text into reusable AI tools that match the way you read and learn. Define your own prompts and structured output fields, choose a provider, model, and icon, then run the action directly from the selection toolbar for dictionary lookups, rewriting, summaries, explanations, or any workflow you design.

Start with the built-in **Dictionary** and **Improve Writing** templates, or build an action from scratch.

<div align="right">

[![Back to top][back-to-top]](#readme-top)

</div>

### 🔄 [Bilingual / Translation Only][docs-tutorial]

Switch seamlessly between two translation display modes. **Bilingual mode** shows the original text alongside its translation, perfect for learning and comparison. **Translation-only mode** replaces the original text entirely for a cleaner reading experience.

The extension automatically re-translates all visible content when you switch modes while translation is active, ensuring a smooth transition without needing to refresh the page.

<div align="right">

[![Back to top][back-to-top]](#readme-top)

</div>

### ✨ [Selection Translation][docs-tutorial]

Select any text on a webpage to reveal a smart toolbar with powerful options. **Translate** streams the translation in real-time. **Explain** provides detailed explanations tailored to your language level. **Speak** reads the text aloud using text-to-speech.

The toolbar intelligently positions itself to stay within the viewport, supports drag interactions, and works across all websites. Perfect for quick lookups while reading.

<div align="right">

[![Back to top][back-to-top]](#readme-top)

</div>

### 🧠 [Context-Aware Translation][docs-tutorial]

Enable AI to understand the full context of what you're reading. When activated, Translatebuff extracts the page title and a concise Markdown version of the page content, providing this context to the AI for more accurate, contextually-appropriate translations.

This means technical terms get translated correctly within their domain, literary expressions maintain their nuance, and ambiguous phrases are interpreted based on the surrounding content rather than in isolation.

<div align="right">

[![Back to top][back-to-top]](#readme-top)

</div>

### 🎬 [Subtitle Translation][docs-tutorial]

Translate YouTube subtitles directly in the video player. Watch foreign language content with translations displayed alongside the original subtitles, making video content accessible for language learning.

<div align="right">

[![Back to top][back-to-top]](#readme-top)

</div>

### 🔊 [Text-to-Speech (TTS)][docs-tutorial]

Listen to any selected text with high-quality AI voices. Powered by **Edge TTS** — completely free, with 150+ voices across 80+ languages including Chinese, English, Japanese, Korean, and many more. Adjust rate, pitch, and volume to your preference.

Automatic language detection (basic or LLM-powered) with per-language voice mapping ensures the right voice for every language. Smart sentence-aware chunking handles long text by splitting at natural boundaries and prefetching the next chunk for seamless playback. Perfect for pronunciation practice and auditory learning.

<div align="right">

[![Back to top][back-to-top]](#readme-top)

</div>

### 📦 [Batch Requests][docs-tutorial]

Save up to 70% on API costs with intelligent request batching. Translatebuff groups multiple translation requests into single API calls, reducing overhead and token usage while maintaining translation quality.

The system includes smart retry logic with exponential backoff and automatic fallback to individual requests if batch processing fails. All handled transparently in the background.

<div align="right">

[![Back to top][back-to-top]](#readme-top)

</div>

### 🤖 [Built-in AI Translation][docs-tutorial]

Sign in and start translating right away—no need to bring your own API key. Translatebuff's built-in AI translation service issues your key automatically and offers multiple AI models, so you can pick the right model for each feature.

Prefer something lightweight? Standard translation via Google Translate and Microsoft Translate is available too.

<div align="right">

[![Back to top][back-to-top]](#readme-top)

</div>

## 🤝 Contribute

Contributions of all types are more than welcome.

1. Promote Translatebuff to your friends and family.
2. Report issues and feedback.
3. Contribute code.

### Contribute Code

Check out the [Contribution Guide][docs-tutorial] for more details.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for contributor licensing terms.

<div align="right">

[![Back to top][back-to-top]](#readme-top)

</div>

<!-- LINK GROUP -->

[back-to-top]: https://img.shields.io/badge/-BACK_TO_TOP-151515?style=flat-square
[chinese-shield]: https://img.shields.io/badge/%E7%AE%80%E4%BD%93%E4%B8%AD%E6%96%87-gray?style=flat-square
[english-shield]: https://img.shields.io/badge/English-gray?style=flat-square
[image-banner]: /assets/renyimiao-icon.svg
[japanese-shield]: https://img.shields.io/badge/%E6%97%A5%E6%9C%AC%E8%AA%9E-gray?style=flat-square
[korean-shield]: https://img.shields.io/badge/%ED%95%9C%EA%B5%AD%EC%96%B4-gray?style=flat-square
[russian-shield]: https://img.shields.io/badge/%D0%A0%D1%83%D1%81%D1%81%D0%BA%D0%B8%D0%B9-gray?style=flat-square
[spanish-shield]: https://img.shields.io/badge/Espa%C3%B1ol-gray?style=flat-square
[traditional-chinese-shield]: https://img.shields.io/badge/%E7%B9%81%E9%AB%94%E4%B8%AD%E6%96%87-gray?style=flat-square
[turkish-shield]: https://img.shields.io/badge/T%C3%BCrk%C3%A7e-gray?style=flat-square
[vietnamese-shield]: https://img.shields.io/badge/Ti%E1%BA%BFng%20Vi%E1%BB%87t-gray?style=flat-square
[wechat-link]: https://translatebuff.cn
[wechat-shield-badge]: https://img.shields.io/badge/chat-WeChat-07C160?style=for-the-badge&logo=wechat&logoColor=white&labelColor=black
[website]: https://translatebuff.cn

<!-- Feature docs link -->

[docs-tutorial]: https://translatebuff.cn/docs
[blog]: https://translatebuff.cn/blog
