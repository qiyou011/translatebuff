<div align="center"><a name="readme-top"></a>

[![Translatebuff][image-banner]][website]

ブラウザ向けのオープンソース AI 言語学習拡張機能です。<br/>
没入型翻訳、記事分析、複数の AI モデルなどに対応しています。<br/>
ブラウザ上で AI を使い、言語を手軽に、深く学べます。

[![English][english-shield]](../README.md) [![简体中文][chinese-shield]](./README.zh-CN.md) [![繁體中文][traditional-chinese-shield]](./README.zh-TW.md) [![日本語][japanese-shield]](./README.ja.md) [![한국어][korean-shield]](./README.ko.md) [![Español][spanish-shield]](./README.es.md) [![Русский][russian-shield]](./README.ru.md) [![Türkçe][turkish-shield]](./README.tr.md) [![Tiếng Việt][vietnamese-shield]](./README.vi.md)

[公式サイト][website] · [チュートリアル][docs-tutorial] · [ブログ][blog]

</div>

<details>
<summary><kbd>目次</kbd></summary>

#### 目次

- [📺 デモ](#-デモ)
- [👋🏻 はじめに・コミュニティ](#-はじめにコミュニティ)
  - [ダウンロード](#ダウンロード)
  - [コミュニティ](#コミュニティ)
- [✨ 機能](#-機能)
  - [🔄 バイリンガル / 翻訳のみ](#-バイリンガル--翻訳のみ)
  - [✨ 選択テキスト翻訳](#-選択テキスト翻訳)
  - [🧠 文脈対応翻訳](#-文脈対応翻訳)
  - [🎬 字幕翻訳](#-字幕翻訳)
  - [🔊 テキスト読み上げ (TTS)](#-テキスト読み上げ-tts)
  - [📦 バッチリクエスト](#-バッチリクエスト)
  - [🤖 20+ AI プロバイダー](#-20-ai-プロバイダー)
- [🤝 コントリビュート](#-コントリビュート)

<br/>

</details>

## 📺 デモ

<div align="center">
  <img src="../assets/node-translation-demo.gif" width="38%" alt="Translatebuff ポップアップ画面" />
  <img src="../assets/page-translation-demo.gif" width="60%" alt="Translatebuff 翻訳画面" />
</div>

## 👋🏻 はじめに・コミュニティ

Translatebuff のビジョンは、あらゆるレベルの言語学習者に、使いやすく、賢く、個人に合わせた学習体験を届けることです。AI の時代になり、それは現実的になりましたが、市場にはこの需要を満たす製品がまだ多くありません。そこで私たちは自分たちで作ることにしました。

ユーザーであっても開発者であっても、Translatebuff はこのビジョンに向かうための重要なツールになります。現在も活発に開発中のため、問題を見つけた場合はぜひフィードバックで知らせてください。

### ダウンロード

> ブラウザストアへの掲載は準備中です。今のところ、公式サイトから Translatebuff を入手できます: **[translatebuff.cn][website]**

| ブラウザ | ダウンロード          |
| -------- | --------------------- |
| Chrome   | [公式サイト][website] |
| Edge     | [公式サイト][website] |
| Firefox  | [公式サイト][website] |

### コミュニティ

| [![WeChat badge][wechat-shield-badge]][wechat-link] | 中国本土にいる場合は WeChat グループに参加できます。 |
| :-------------------------------------------------- | :--------------------------------------------------- |

## ✨ 機能

Translatebuff の機能で、毎日の Web 読書を没入型の言語学習体験に変えられます。

### 🪄 [カスタムAIアクション][docs-tutorial]

選択したテキストを、自分の読み方や学び方に合った再利用可能な AI ツールへ変えられます。プロンプトと構造化出力フィールドを定義し、プロバイダー、モデル、アイコンを選んで、辞書検索、書き換え、要約、解説などの独自ワークフローを選択ツールバーから直接実行できます。

組み込みの**辞書**や**文章改善**テンプレートから始めることも、ゼロから作成することもできます。構造化された結果は Notebase にマッピングして保存し、後で学習に利用できます。

### 🧠 [フラッシュカードと間隔反復][docs-tutorial]

語彙、定義、例文、翻訳、読書メモを Notebase に保存し、カスタマイズ可能なカードテンプレートからフラッシュカードを作成できます。読書中に見つけた内容を、流れを止めずに学習教材へ変えられます。

期限が来たカードをオンラインで復習し、**もう一度**、**難しい**、**良い**、**簡単**で評価します。Translatebuff の間隔反復スケジューラーが評価をもとに、忘れそうになる直前の最適なタイミングでカードを再表示します。

### 🔄 [バイリンガル / 翻訳のみ][docs-tutorial]

2 つの翻訳表示モードをスムーズに切り替えられます。**バイリンガルモード**は原文と翻訳を並べて表示し、学習や比較に適しています。**翻訳のみモード**は原文を置き換え、よりすっきり読めます。

翻訳中にモードを切り替えると、表示中の内容を自動で再翻訳するため、ページを更新せずに自然に切り替えられます。

### ✨ [選択テキスト翻訳][docs-tutorial]

Web ページ上の任意のテキストを選択すると、便利なツールバーが表示されます。**翻訳**はリアルタイムに結果をストリーミングし、**解説**はあなたのレベルに合わせて詳しく説明し、**読み上げ**は TTS で音声化します。

ツールバーは画面内に収まるよう自動配置され、ドラッグ操作にも対応し、あらゆるサイトで利用できます。

### 🧠 [文脈対応翻訳][docs-tutorial]

読んでいる内容の文脈を AI に理解させます。有効にすると、Translatebuff はページタイトルと簡潔な Markdown 版の本文を抽出し、より正確で文脈に合った翻訳のために AI へ渡します。

専門用語は分野に応じて正しく訳され、文学的表現はニュアンスを保ち、曖昧な表現も周囲の文脈に基づいて解釈されます。

### 🎬 [字幕翻訳][docs-tutorial]

YouTube 字幕を動画プレイヤー内で直接翻訳できます。外国語コンテンツを視聴しながら、原字幕と翻訳を並べて確認できます。

### 🔊 [テキスト読み上げ (TTS)][docs-tutorial]

選択したテキストを高品質な AI 音声で聞けます。**Edge TTS** により完全無料で、150+ 種類の音声と 80+ 言語に対応しています。速度、ピッチ、音量も調整できます。

自動言語検出と言語別の音声マッピングにより、各言語に適した音声を選べます。長文は自然な区切りで分割し、次の部分を先読みするため、発音練習やリスニング学習に適しています。

### 📦 [バッチリクエスト][docs-tutorial]

複数の翻訳リクエストをまとめて 1 回の API 呼び出しにすることで、API コストを最大 70% 削減できます。翻訳品質を保ちながらオーバーヘッドと token 使用量を減らします。

指数バックオフ付きの再試行と、バッチ処理失敗時の個別リクエストへの自動フォールバックも備えています。

### 🤖 [20+ AI プロバイダー][docs-tutorial]

Vercel AI SDK を通じて OpenAI、DeepSeek、Anthropic Claude、Google Gemini、xAI Grok、Groq、Mistral、Ollama など 20+ の AI プロバイダーに接続できます。各プロバイダーごとにエンドポイント、API キー、モデル設定を調整できます。

無料の基本翻訳オプションとして Google Translate、Microsoft Translate、DeepLX も利用できます。

<div align="right">

[![Back to top][back-to-top]](#readme-top)

</div>

## 🤝 コントリビュート

あらゆる種類の貢献を歓迎します。

1. Translatebuff を友人や家族に紹介する。
2. Issue やフィードバックを報告する。
3. コードを貢献する。

### コードで貢献

詳しくは [Contribution Guide][docs-tutorial] を確認してください。

コントリビューターのライセンス条件は [CONTRIBUTING.md](../CONTRIBUTING.md) を参照してください。

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
