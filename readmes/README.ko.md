<div align="center"><a name="readme-top"></a>

[![Translatebuff][image-banner]][website]

브라우저용 오픈소스 AI 언어 학습 확장 프로그램입니다.<br/>
몰입형 번역, 문서 분석, 여러 AI 모델 등을 지원합니다.<br/>
브라우저에서 AI와 함께 더 쉽고 깊게 언어를 학습하세요.

[![English][english-shield]](../README.md) [![简体中文][chinese-shield]](./README.zh-CN.md) [![繁體中文][traditional-chinese-shield]](./README.zh-TW.md) [![日本語][japanese-shield]](./README.ja.md) [![한국어][korean-shield]](./README.ko.md) [![Español][spanish-shield]](./README.es.md) [![Русский][russian-shield]](./README.ru.md) [![Türkçe][turkish-shield]](./README.tr.md) [![Tiếng Việt][vietnamese-shield]](./README.vi.md)

[공식 웹사이트][website] · [튜토리얼][docs-tutorial] · [블로그][blog]

</div>

<details>
<summary><kbd>목차</kbd></summary>

#### 목차

- [📺 데모](#-데모)
- [👋🏻 시작하기 및 커뮤니티 참여](#-시작하기-및-커뮤니티-참여)
  - [다운로드](#다운로드)
  - [커뮤니티](#커뮤니티)
- [✨ 기능](#-기능)
  - [🪄 사용자 정의 AI 액션](#-사용자-정의-ai-액션)
  - [🔄 이중 언어 / 번역만 보기](#-이중-언어--번역만-보기)
  - [✨ 선택 번역](#-선택-번역)
  - [🧠 문맥 인식 번역](#-문맥-인식-번역)
  - [🎬 자막 번역](#-자막-번역)
  - [🔊 텍스트 음성 변환 (TTS)](#-텍스트-음성-변환-tts)
  - [📦 배치 요청](#-배치-요청)
  - [🤖 내장 AI 번역](#-내장-ai-번역)
- [🤝 기여](#-기여)
  - [코드 기여](#코드-기여)

<br/>

</details>

## 📺 데모

<div align="center">
  <img src="../assets/node-translation-demo.gif" width="38%" alt="Translatebuff 팝업 인터페이스" />
  <img src="../assets/page-translation-demo.gif" width="60%" alt="Translatebuff 번역 인터페이스" />
</div>

## 👋🏻 시작하기 및 커뮤니티 참여

Translatebuff의 목표는 모든 수준의 언어 학습자에게 쉽고 지능적이며 개인화된 학습 경험을 제공하는 것입니다. AI 시대에는 이것이 가능해졌지만, 아직 시장에는 이 요구를 제대로 만족시키는 제품이 많지 않습니다. 그래서 우리는 직접 만들기로 했습니다.

사용자이든 개발자이든 Translatebuff는 이 비전을 향한 여정에서 중요한 도구가 될 것입니다. Translatebuff는 현재 활발히 개발 중이며, 피드백은 언제든 환영합니다.

### 다운로드

> 브라우저 스토어 등록이 진행 중입니다. 지금은 공식 웹사이트에서 Translatebuff를 받으세요: **[translatebuff.cn][website]**

| 브라우저 | 다운로드                 |
| -------- | ------------------------ |
| Chrome   | [공식 웹사이트][website] |
| Edge     | [공식 웹사이트][website] |
| Firefox  | [공식 웹사이트][website] |

### 커뮤니티

| [![WeChat badge][wechat-shield-badge]][wechat-link] | 중국 본토에 있다면 WeChat 그룹에도 참여할 수 있습니다. |
| :-------------------------------------------------- | :----------------------------------------------------- |

## ✨ 기능

Translatebuff의 강력한 기능으로 일상적인 웹 읽기를 몰입형 언어 학습 경험으로 바꿀 수 있습니다.

### 🪄 [사용자 정의 AI 액션][docs-tutorial]

선택한 텍스트를 자신의 읽기와 학습 방식에 맞는 재사용 가능한 AI 도구로 만들 수 있습니다. 프롬프트와 구조화된 출력 필드를 정의하고 제공자, 모델, 아이콘을 선택한 뒤 사전 검색, 다시 쓰기, 요약, 설명 등 원하는 작업을 선택 도구 모음에서 바로 실행하세요.

기본 제공되는 **사전** 및 **글쓰기 개선** 템플릿으로 시작하거나 처음부터 직접 만들 수 있습니다.

### 🔄 [이중 언어 / 번역만 보기][docs-tutorial]

두 가지 번역 표시 모드를 부드럽게 전환할 수 있습니다. **이중 언어 모드**는 원문과 번역을 함께 보여 주어 학습과 비교에 적합합니다. **번역만 보기 모드**는 원문을 번역문으로 대체해 더 깔끔한 읽기 경험을 제공합니다.

번역이 활성화된 상태에서 모드를 바꾸면 표시 중인 모든 내용을 자동으로 다시 번역하므로 페이지를 새로 고칠 필요가 없습니다.

### ✨ [선택 번역][docs-tutorial]

웹페이지의 텍스트를 선택하면 스마트 도구 모음이 나타납니다. **번역**은 실시간으로 결과를 스트리밍하고, **설명**은 사용자의 언어 수준에 맞춰 자세한 해설을 제공하며, **읽기**는 TTS로 텍스트를 들려줍니다.

도구 모음은 화면 안에 머물도록 자동 배치되고 드래그를 지원하며, 모든 웹사이트에서 사용할 수 있습니다.

### 🧠 [문맥 인식 번역][docs-tutorial]

AI가 읽고 있는 내용의 전체 문맥을 이해하도록 합니다. 활성화하면 Translatebuff가 페이지 제목과 간결한 Markdown 형태의 페이지 내용을 추출하여 AI에 전달하고, 더 정확하고 문맥에 맞는 번역을 제공합니다.

전문 용어는 해당 분야에 맞게 번역되고, 문학적 표현은 뉘앙스를 유지하며, 모호한 표현은 주변 문맥에 따라 해석됩니다.

### 🎬 [자막 번역][docs-tutorial]

YouTube 자막을 동영상 플레이어 안에서 직접 번역합니다. 외국어 콘텐츠를 볼 때 원문 자막과 번역을 함께 표시하여 영상을 학습 자료로 만들 수 있습니다.

### 🔊 [텍스트 음성 변환 (TTS)][docs-tutorial]

선택한 텍스트를 고품질 AI 음성으로 들을 수 있습니다. **Edge TTS** 기반으로 완전히 무료이며, 중국어, 영어, 일본어, 한국어 등 80+ 언어와 150+ 음성을 지원합니다. 속도, 피치, 볼륨도 조정할 수 있습니다.

자동 언어 감지와 언어별 음성 매핑으로 각 언어에 적합한 음성을 사용할 수 있습니다. 긴 텍스트는 자연스러운 문장 경계에서 나누고 다음 조각을 미리 불러와 부드럽게 재생합니다.

### 📦 [배치 요청][docs-tutorial]

지능형 요청 배치로 API 비용을 최대 70% 절감할 수 있습니다. Translatebuff는 여러 번역 요청을 하나의 API 호출로 묶어 번역 품질을 유지하면서 오버헤드와 token 사용량을 줄입니다.

시스템은 지수 백오프 재시도와 배치 실패 시 개별 요청으로 자동 전환하는 기능을 포함합니다.

### 🤖 [내장 AI 번역][docs-tutorial]

로그인하면 바로 번역을 시작할 수 있어 자체 API 키가 필요 없습니다. Translatebuff의 내장 AI 번역 서비스가 키를 자동으로 발급하고 여러 AI 모델을 제공하므로 기능별로 알맞은 모델을 선택할 수 있습니다.

가볍게 사용하고 싶으신가요? Google Translate와 Microsoft Translate를 통한 표준 번역도 이용할 수 있습니다.

<div align="right">

[![Back to top][back-to-top]](#readme-top)

</div>

## 🤝 기여

모든 종류의 기여를 환영합니다.

1. Translatebuff를 친구와 가족에게 소개하세요.
2. 이슈와 피드백을 보내 주세요.
3. 코드를 기여하세요.

### 코드 기여

자세한 내용은 [Contribution Guide][docs-tutorial]를 확인하세요.

기여자 라이선스 조건은 [CONTRIBUTING.md](../CONTRIBUTING.md)를 참조하세요.

<div align="right">

[![Back to top][back-to-top]](#readme-top)

</div>

<!-- LINK GROUP -->

[back-to-top]: https://img.shields.io/badge/-BACK_TO_TOP-151515?style=flat-square
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
[wechat-shield-badge]: https://img.shields.io/badge/chat-WeChat-07C160?style=for-the-badge&logo=wechat&logoColor=white&labelColor=black
[website]: https://translatebuff.cn

<!-- Feature docs link -->

[docs-tutorial]: https://translatebuff.cn/docs
[blog]: https://translatebuff.cn/blog
