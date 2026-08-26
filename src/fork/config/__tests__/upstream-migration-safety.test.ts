import { describe, expect, it } from "vitest"
import { migrate as m87 } from "@/utils/config/migration-scripts/v086-to-v087"
import { migrate as m88 } from "@/utils/config/migration-scripts/v087-to-v088"
import { migrate as m89 } from "@/utils/config/migration-scripts/v088-to-v089"
import { migrate as m90 } from "@/utils/config/migration-scripts/v089-to-v090"
import { migrate as m91 } from "@/utils/config/migration-scripts/v090-to-v091"
import { migrate as m92 } from "@/utils/config/migration-scripts/v091-to-v092"
import { migrate as m93 } from "@/utils/config/migration-scripts/v092-to-v093"
import { migrate as m94 } from "@/utils/config/migration-scripts/v093-to-v094"
import { migrate as m95 } from "@/utils/config/migration-scripts/v094-to-v095"
import { migrate as m96 } from "@/utils/config/migration-scripts/v095-to-v096"
import { migrate as m97 } from "@/utils/config/migration-scripts/v096-to-v097"
import { migrate as m98 } from "@/utils/config/migration-scripts/v097-to-v098"
import { migrate as m99 } from "@/utils/config/migration-scripts/v098-to-v099"

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

/**
 * 跑完 86 → 99 全链。上游 v1.46.4 把 schema 从 88 推到 99，共 13 个脚本。
 * 用数组顺序 reduce，而不是手拼嵌套调用——后者括号一多就容易配错，且加脚本时要改两处。
 */
const CHAIN = [m87, m88, m89, m90, m91, m92, m93, m94, m95, m96, m97, m98, m99]

function runFullChain() {
  return CHAIN.reduce<any>((config, migrate) => migrate(config), legacyConfig())
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

// v092→v093 是上游给「微软 + 仅译文」存量配置做的迁移：把 page-translate provider
// 改指 Google。任译喵实例也住在 providersConfig 里，得确认它不误伤。
describe("上游 88→99 迁移不误伤 fork 数据", () => {
  it("跑完全链后任译喵实例与 apiKey 仍在", () => {
    const after = runFullChain()
    const renyimiao = after.providersConfig.filter((p: any) =>
      String(p.id).startsWith("renyimiao-"),
    )
    expect(renyimiao).toHaveLength(2)
    expect(renyimiao.every((p: any) => p.apiKey === "sk-x")).toBe(true)
  })

  it("跑完全链后用户自定义动作的 providerId 不被改写", () => {
    const after = runFullChain()
    const mine = after.selectionToolbar.customActions.find((a: any) => a.name === "我的动作")
    expect(mine?.providerId).toBe("renyimiao-GLM-5.2")
  })

  it("v092→v093 的微软迁移不误伤任译喵实例", () => {
    // 该迁移把「微软 + 仅译文」的 page-translate provider 改指 Google。
    // 任译喵实例同住 providersConfig，确认它既不被改写也不被移除。
    const after = runFullChain()
    const ids = after.providersConfig.map((p: any) => p.id)
    expect(ids).toContain("renyimiao-Deepseek-V4-Flash")
    expect(ids).toContain("renyimiao-GLM-5.2")
    const renyimiao = after.providersConfig.filter((p: any) =>
      String(p.id).startsWith("renyimiao-"),
    )
    expect(renyimiao.every((p: any) => p.provider === "openai-compatible")).toBe(true)
  })
})
