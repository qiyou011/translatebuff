// 扩展界面语言 → 官网 next-intl locale 段映射（纯函数，供 popup / 选项页拼登录 URL）。
// 入参是 resolveUiLocale 解析后的具体 locale（不含 "auto"）；官网九语 en/zh-hans/zh-hant/ja/ko/es/pt/ru/tr，
// defaultLocale=en 且 localePrefix="as-needed"，故 en 无前缀（空段）。扩展有 vi，官网未上线越南语 → 回退默认。

// 键：扩展 SupportedUiLocale；值：官网 next-intl locale 段。缺席的语言（如 vi / 未知值）回退默认（空段）。
const UI_LOCALE_TO_WEBSITE_LOCALE: Record<string, string> = {
  en: "", // 默认语言，as-needed 无前缀
  es: "es",
  ja: "ja",
  ko: "ko",
  ru: "ru",
  tr: "tr",
  "zh-CN": "zh-hans",
  "zh-TW": "zh-hant",
  // vi：官网无越南语 → 不在表内，回退默认
}

// 映射到官网 locale 段；不支持的语言回退默认（空段，走 en 根路径）。
export function uiLanguageToWebsiteLocale(uiLanguage: string): string {
  return UI_LOCALE_TO_WEBSITE_LOCALE[uiLanguage] ?? ""
}

// 官网登录路径：/{locale}/login；默认语言（en，空段）为 /login。
export function websiteLoginPath(uiLanguage: string): string {
  const locale = uiLanguageToWebsiteLocale(uiLanguage)
  return locale ? `/${locale}/login` : "/login"
}
