import { beforeEach, describe, expect, it, vi } from "vitest"

const getLocalConfig = vi.fn<() => Promise<any>>()
const setLocalConfig = vi.fn<(config: any) => Promise<void>>()
vi.mock("@/utils/config/storage", () => ({ getLocalConfig, setLocalConfig }))

const { repairCustomActions } = await import("@/fork/background/repair-custom-actions")

// i18n 未初始化时落盘的自定义动作会缺 name/id 等必填字段，配置 schema 随后 safeParse 失败，
// 整份配置被回退成默认值——用户的 provider 配置与会员态一起丢。
//
// 上游把这个修复塞进了 v085-to-v086 迁移脚本，fork 曾照做；但迁移脚本是冻结快照，
// 且 schemaVersion 已 ≥86 的存量用户再也不会经过那一步，修复对他们完全失效。
describe("repairCustomActions", () => {
  beforeEach(() => {
    getLocalConfig.mockReset()
    setLocalConfig.mockReset()
  })

  it("补齐残缺的自定义动作字段", async () => {
    getLocalConfig.mockResolvedValue({
      selectionToolbar: { customActions: [{ prompt: "翻译这段" }] },
    })
    expect(await repairCustomActions()).toBe(true)
    const written = setLocalConfig.mock.calls[0]?.[0]
    const action = written.selectionToolbar.customActions[0]
    expect(action.id).toBeTruthy()
    expect(action.name).toBeTruthy()
    expect(action.enabled).toBe(true)
    expect(action.outputSchema.length).toBeGreaterThan(0)
    expect(action.prompt).toBe("翻译这段")
  })

  it("字段完好时不写回（幂等，避免每次启动都改存储）", async () => {
    getLocalConfig.mockResolvedValue({
      selectionToolbar: {
        customActions: [
          {
            id: "a1",
            name: "词典",
            enabled: true,
            icon: "tabler:book",
            providerId: "renyimiao-x",
            systemPrompt: "",
            prompt: "p",
            outputSchema: [
              { id: "f1", name: "释义", type: "string", description: "", speaking: false },
            ],
          },
        ],
      },
    })
    expect(await repairCustomActions()).toBe(false)
    expect(setLocalConfig).not.toHaveBeenCalled()
  })

  it("读到 null（新装竞态）直接跳过", async () => {
    getLocalConfig.mockResolvedValue(null)
    expect(await repairCustomActions()).toBe(false)
    expect(setLocalConfig).not.toHaveBeenCalled()
  })
})
