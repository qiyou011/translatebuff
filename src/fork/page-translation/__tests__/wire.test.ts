import { describe, expect, it } from "vitest"
import { NO_TRANSLATION_SENTINEL } from "@/utils/constants/prompt"
import { compactPageHtml, restorePageHtml, parseFlatTranslations } from "../wire"

describe("page wire protocol", () => {
  it("keeps offsets stable after raw text containing Turkish capital dotted I", () => {
    const prefix = "<textarea>" + "İ".repeat(12) + "</textarea>"
    expect(compactPageHtml(prefix + '<a data-rf-attr="0">x</a>')).toBe(prefix + "<a id=0>x</a>")
  })
  it("roundtrips self-closing tags without absorbing the slash into an id", () => {
    const source = '<img data-rf-attr="0"/>'
    expect(compactPageHtml(source)).toBe("<img id=0 />")
    expect(restorePageHtml(source, compactPageHtml(source)!)).toBe('<img data-rf-attr="0" />')
  })
  it("compacts only actual attributes and restores canonical marker semantics", () => {
    const source = '<a data-rf-attr="0">Docs</a> <b>bold</b>'
    expect(compactPageHtml(source)).toBe("<a id=0>Docs</a> <b>bold</b>")
    expect(restorePageHtml(source, '<a id="0">文档</a> <b>加粗</b>')).toBe(
      '<a data-rf-attr="0">文档</a> <b>加粗</b>',
    )
  })
  it("does not rewrite comments, raw text, attribute values or escaped markup", () => {
    const inert =
      '<!-- <a data-rf-attr="9"> -->' +
      '<script>"<a data-rf-attr=8>"</script><textarea><a data-rf-attr=7></textarea>' +
      '&lt;a data-rf-attr="6"&gt;<b title=\'data-rf-attr="5" >\'>x</b>'
    expect(compactPageHtml(inert + '<a data-rf-attr="0">link</a>')).toBe(inert + "<a id=0>link</a>")
  })
  it("declines compaction on a native id collision", () => {
    expect(compactPageHtml('<a id="real" data-rf-attr="0">x</a>')).toBeNull()
  })
  it.each(["<a>missing</a>", "<a id=0>x</a><a id=0>x</a>", "<b id=0>x</b>", "<a id=1>x</a>"])(
    "rejects invalid marker output %s",
    (output) => {
      expect(() => restorePageHtml('<a data-rf-attr="0">source</a>', output)).toThrow(Error)
    },
  )
  it("accepts sentinel without trying to restore absent markup", () => {
    expect(restorePageHtml('<a data-rf-attr="0">source</a>', NO_TRANSLATION_SENTINEL)).toBe(
      NO_TRANSLATION_SENTINEL,
    )
  })
  it("maps by key not order and keeps localized failures", () => {
    expect(parseFlatTranslations('{"t2":"three","t0":"one","t1":42}', 4)).toEqual([
      "one",
      undefined,
      "three",
      undefined,
    ])
    expect(parseFlatTranslations('{"t0":"  ","t1":"{{NO_TRANSLATION_NEEDED}}"}', 2)).toEqual([
      undefined,
      NO_TRANSLATION_SENTINEL,
    ])
  })
  it.each([
    '{"t0":"first","t0":"second"}',
    '{"t0":"ok","t9":"extra"}',
    '["array"]',
    "null",
    '```json\n{"t0":"x"}\n```',
  ])("rejects corrupt envelope %s", (raw) => {
    expect(() => parseFlatTranslations(raw, 1)).toThrow(Error)
  })
  it("does not mistake key-like translated text for an extra JSON key", () => {
    expect(
      parseFlatTranslations('{"t0":"literal \\"t9\\": and } text"}'.replaceAll('\\\\"', '\\"'), 1),
    ).toEqual(['literal "t9": and } text'])
  })
})
