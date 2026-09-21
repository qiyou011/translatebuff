import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { browser } from "#imports"
import { setupUninstallSurvey } from "../uninstall-survey"

// fork：卸载跳任译喵官网问卷（陪读蛙原问卷是上游品牌，已换成 fork 官网 /uninstall-survey）。
describe("setupUninstallSurvey", () => {
  beforeEach(() => {
    vi.stubEnv("WXT_FORK_EDITION", "global")
    vi.stubEnv("WXT_FORK_CHANNEL", "global-zip")
    browser.runtime.setUninstallURL = vi.fn<(...args: any[]) => any>().mockResolvedValue(undefined)
  })

  afterEach(() => vi.unstubAllEnvs())

  it("国内使用指定表单的完整链接", async () => {
    vi.stubEnv("WXT_FORK_EDITION", "cn")
    vi.stubEnv("WXT_FORK_CHANNEL", "zip")
    await setupUninstallSurvey()
    expect(browser.runtime.setUninstallURL).toHaveBeenCalledExactlyOnceWith(
      "https://alidocs.dingtalk.com/notable/share/form/v01XNkOM5KwJ1zR8OY7_dv19yqvsgs3oebp3pcjys_1qX0QQ0?source=link",
    )
  })

  it("设卸载 URL 为官网 /uninstall-survey（非空、跟随 fork 官网域）", async () => {
    await setupUninstallSurvey()
    expect(browser.runtime.setUninstallURL).toHaveBeenCalledTimes(1)
    const url = (browser.runtime.setUninstallURL as any).mock.calls[0][0]
    expect(url).not.toBe("")
    expect(url).toContain("/uninstall-survey")
  })

  it("海外保留 cid 渠道戳", async () => {
    await setupUninstallSurvey()
    const url = (browser.runtime.setUninstallURL as any).mock.calls[0][0]
    expect(url).toContain("cid=7150")
  })
})
