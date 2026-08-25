import { describe, expect, it } from "vitest"
import { normalizeTranslationOutput } from "@/utils/host/translate/translation-output-normalization"

/**
 * 漂移哨兵——不是在测 fork 的代码，是在盯上游的一条假设。
 *
 * fork 的微软适配器（src/fork/providers/microsoft-translate.ts）在返回前自己解一次 HTML
 * 实体，前提是上游共享的 normalizeTranslationOutput **不**对 microsoft 解码。上游最新版
 * 已经把 microsoft-translate 加进了解码集合，那份改动迟早随同步 merge 进来——届时两处
 * 各解一次，字面量实体会静默塌陷（`&amp;` → `&`），不冲突、不报错、没人发现。
 *
 * 本测试失败 = 上游已经开始对 microsoft 解码，此时必须删掉 fork 适配器里的 decodeHTMLStrict。
 */
describe("上游解码集合漂移哨兵", () => {
  it("上游归一化仍不对 microsoft-translate 解码（若失败，见本文件顶部注释）", () => {
    const encoded = "Tom &amp; Jerry"

    expect(normalizeTranslationOutput({ provider: "microsoft-translate" }, encoded)).toBe(encoded)
  })

  it("上游归一化仍对 google-translate 解码（确认哨兵本身有效，不是恒真断言）", () => {
    expect(normalizeTranslationOutput({ provider: "google-translate" }, "Tom &amp; Jerry")).toBe(
      "Tom & Jerry",
    )
  })
})
