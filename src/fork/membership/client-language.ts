// 界面语言 → 平台后端 Client-Language 头。
//
// 必须是完整 locale（en-us）而非短码（en）：后端按完整 locale 查错误消息译文，**查不到不回退英文**，
// 直接把字面量 `err not found` 当错误消息发回来，最终展示给用户。取值写错的代价是用户看到乱码文案。
//
// 表内只收官网侧 2026-08-17 在创单接口上实测确认有译文的取值（对齐 translatebuff-web
// src/lib/service/const.ts 的 CBackendLanguageMap）。其余语种一律回落英文——回落到已知可用的值，
// 好过赌一个可能不被后端识别的取值（如 es-es / ko-kr）把用户打到 `err not found`。
// 后端实测扩充本表即可，调用方无需改。

/** 回落值：已知可用的英文。 */
export const DEFAULT_CLIENT_LANGUAGE = "en-us"

// 键为插件 UI locale（resolveUiLocale 归一后的具体值，不含 "auto"）。
const UI_LOCALE_TO_CLIENT_LANGUAGE: Record<string, string> = {
  en: "en-us",
  "zh-CN": "zh-cn",
  "zh-TW": "zh-tw",
  ja: "ja-jp",
  ru: "ru-ru",
}

export function toClientLanguage(uiLocale: string): string {
  return UI_LOCALE_TO_CLIENT_LANGUAGE[uiLocale] ?? DEFAULT_CLIENT_LANGUAGE
}
