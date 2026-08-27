import { beforeEach, describe, expect, it, vi } from "vitest"
import { browser } from "#imports"
import { setupUninstallSurvey } from "../uninstall-survey"

// fork：卸载跳任译喵官网问卷（陪读蛙原问卷是上游品牌，已换成 fork 官网 /uninstall-survey）。
describe("setupUninstallSurvey", () => {
  beforeEach(() => {
    browser.runtime.setUninstallURL = vi.fn<(...args: any[]) => any>().mockResolvedValue(undefined)
  })

  it("设卸载 URL 为官网 /uninstall-survey（非空、跟随 fork 官网域）", async () => {
    await setupUninstallSurvey()
    expect(browser.runtime.setUninstallURL).toHaveBeenCalledTimes(1)
    const url = (browser.runtime.setUninstallURL as any).mock.calls[0][0]
    expect(url).not.toBe("")
    expect(url).toContain("/uninstall-survey")
  })

  it("两条线都带 cid 渠道戳，且 cid 在 fragment 之前", async () => {
    await setupUninstallSurvey()
    const url = (browser.runtime.setUninstallURL as any).mock.calls[0][0]
    expect(url).toContain("cid=7100")
  })
})
