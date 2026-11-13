// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest"
import { bilingualFormatError } from "../../bilingual-format-protocol"
import { extractBilingualFormat } from "../../dom/bilingual-format"
import { createBilingualFormatRequest } from "../bilingual-format-request"

const translate = vi.hoisted(() => vi.fn<(...args: any[]) => any>())
vi.mock("../../translate-variants", () => ({ translateTextForPage: translate }))
beforeEach(() => {
  translate.mockReset()
  document.body.innerHTML = "<p>Save <strong>account</strong> using <code>x&lt;y</code>.</p>"
})
describe("bounded format recovery", () => {
  it("removes ranges once, keeps atoms protected and labels the rendered result degraded", async () => {
    const source = extractBilingualFormat([document.querySelector("p")!])
    translate
      .mockRejectedValueOnce(bilingualFormatError("missing range"))
      .mockResolvedValueOnce("保存账户，使用ZXQATOM1QXZ。")
    const request = createBilingualFormatRequest(source, {})
    const result = await request.translate()
    expect(translate).toHaveBeenCalledTimes(2)
    expect(translate.mock.calls[1]![0]).toBe("Save account using ZXQATOM1QXZ.")
    expect(translate.mock.calls[1]![2].bilingualFormat.recovery).toBe(true)
    const target = document.createElement("span")
    request.renderTranslatedContent(target, result)
    expect(target.dataset.readFrogFormatStatus).toBe("degraded")
    expect(target.querySelector("code")?.textContent).toBe("x<y")
  })
  it("stops after a second integrity failure and never appends a missing atom", async () => {
    translate.mockResolvedValue("wrong: all tokens missing")
    const request = createBilingualFormatRequest(
      extractBilingualFormat([document.querySelector("p")!]),
      {},
    )
    await expect(request.translate()).rejects.toThrow("Bilingual format integrity")
    expect(translate).toHaveBeenCalledTimes(2)
  })
  it("does not turn cancellation into another request", async () => {
    translate.mockRejectedValue(new Error("Translation cancelled"))
    await expect(
      createBilingualFormatRequest(
        extractBilingualFormat([document.querySelector("p")!]),
        {},
      ).translate(),
    ).rejects.toThrow("cancelled")
    expect(translate).toHaveBeenCalledTimes(1)
  })
})
