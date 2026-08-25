import { describe, expect, it } from "vitest"
import { migrate as m87 } from "@/utils/config/migration-scripts/v086-to-v087"
import { migrate as m88 } from "@/utils/config/migration-scripts/v087-to-v088"

// 同步上游 v1.43.6 引入 schema 86→88 两个迁移，其中 v087→v088 会把内置「词典」
// 从 customActions 搬进 builtInActions。fork 的任译喵实例也住在 providersConfig、
// 用户自定义动作也住在 customActions —— 这里守住上游迁移不会误伤它们。
function legacyConfig() {
  return {
    configVersion: 86,
    providersConfig: [
      {
        id: "renyimiao-Deepseek-V4-Flash",
        provider: "openai-compatible",
        apiKey: "sk-x",
        model: { customModel: "Deepseek-V4-Flash" },
      },
      {
        id: "renyimiao-GLM-5.2",
        provider: "openai-compatible",
        apiKey: "sk-x",
        model: { customModel: "GLM-5.2" },
      },
      { id: "microsoft-translate-default", provider: "microsoft-translate" },
    ],
    selectionToolbar: {
      customActions: [
        {
          id: "dictionary",
          name: "词典",
          enabled: true,
          icon: "tabler:book",
          providerId: "read-frog-free-ai",
          systemPrompt: "",
          prompt: "p",
          outputSchema: [
            { id: "f", name: "释义", type: "string", description: "", speaking: false },
          ],
        },
        {
          id: "my-custom",
          name: "我的动作",
          enabled: true,
          icon: "tabler:sparkles",
          providerId: "renyimiao-GLM-5.2",
          systemPrompt: "",
          prompt: "q",
          outputSchema: [
            { id: "g", name: "输出", type: "string", description: "", speaking: false },
          ],
        },
      ],
      saveSuggestion: { enabled: true },
    },
    siteRules: { userRules: [] },
  }
}

describe("上游 86→88 迁移不误伤 fork 数据", () => {
  it("任译喵实例与其 apiKey 原样保留", () => {
    const after = m88(m87(legacyConfig()))
    const renyimiao = after.providersConfig.filter((p: any) =>
      String(p.id).startsWith("renyimiao-"),
    )
    expect(renyimiao).toHaveLength(2)
    expect(renyimiao.every((p: any) => p.apiKey === "sk-x")).toBe(true)
    expect(after.providersConfig).toHaveLength(3)
  })

  it("用户自定义动作的 providerId 不被改写", () => {
    const after = m88(m87(legacyConfig()))
    const mine = after.selectionToolbar.customActions.find((a: any) => a.name === "我的动作")
    expect(mine?.providerId).toBe("renyimiao-GLM-5.2")
  })

  it("内置词典被搬进 builtInActions（fork 的 repoint 需据此跟进）", () => {
    const after = m88(m87(legacyConfig()))
    expect(after.selectionToolbar.builtInActions?.dictionary).toBeDefined()
  })
})
