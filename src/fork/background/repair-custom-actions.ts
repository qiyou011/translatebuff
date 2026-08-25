import { getLocalConfig, setLocalConfig } from "@/utils/config/storage"
import { logger } from "@/utils/logger"

/**
 * 补齐残缺的自定义动作字段。
 *
 * i18n 未初始化时落盘的自定义动作会缺 name / id 等必填字段，配置 schema 随后 safeParse 失败，
 * 整份配置被回退成默认值——用户的 provider 配置与会员态一起丢。
 *
 * 上游把这段修复塞进了 v085-to-v086 迁移脚本，fork 曾照做。但迁移脚本按上游约定是**冻结快照**，
 * 且 schemaVersion 已 ≥86 的存量用户再也不会经过那一步，修复对他们完全失效。改成后台幂等修复，
 * 形态与同目录的 correct-legacy-translation-mode 一致：读到 null（新装竞态）跳过，
 * 只有确实残缺才写回。
 *
 * @returns 是否实际写回了修复后的配置
 */
export async function repairCustomActions(): Promise<boolean> {
  try {
    const config = await getLocalConfig()
    const actions = config?.selectionToolbar?.customActions
    if (!config || !Array.isArray(actions) || actions.length === 0) {
      return false
    }

    const repaired = actions.map(repairAction)
    if (JSON.stringify(repaired) === JSON.stringify(actions)) {
      return false
    }

    await setLocalConfig({
      ...config,
      selectionToolbar: { ...config.selectionToolbar, customActions: repaired },
    })
    logger.info(`[Fork] 存量配置修复：补齐 ${actions.length} 个自定义动作的必填字段`)
    return true
  } catch (error) {
    // 修复失败不应拖垮 setupFork 的其余接线。
    logger.error("[Fork] 自定义动作修复失败", error)
    return false
  }
}

function nonEmptyString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback
}

function repairOutputField(field: any, actionIndex: number, fieldIndex: number) {
  const source = field && typeof field === "object" ? field : {}
  return {
    ...source,
    id: nonEmptyString(source.id, `recovered-field-${actionIndex + 1}-${fieldIndex + 1}`),
    name: nonEmptyString(source.name, `Recovered field ${fieldIndex + 1}`),
    type: source.type === "number" ? "number" : "string",
    description: typeof source.description === "string" ? source.description : "",
    speaking: typeof source.speaking === "boolean" ? source.speaking : false,
  }
}

function repairAction(action: any, actionIndex: number) {
  const source = action && typeof action === "object" ? action : {}
  const rawSchema = Array.isArray(source.outputSchema) ? source.outputSchema : []
  const outputSchema =
    rawSchema.length > 0
      ? rawSchema.map((field: any, i: number) => repairOutputField(field, actionIndex, i))
      : [repairOutputField({}, actionIndex, 0)]

  return {
    ...source,
    id: nonEmptyString(source.id, `recovered-action-${actionIndex + 1}`),
    name: nonEmptyString(source.name, `Recovered action ${actionIndex + 1}`),
    enabled: typeof source.enabled === "boolean" ? source.enabled : true,
    icon: nonEmptyString(source.icon, "tabler:sparkles"),
    providerId: nonEmptyString(source.providerId, "read-frog-free-ai"),
    systemPrompt: typeof source.systemPrompt === "string" ? source.systemPrompt : "",
    prompt: typeof source.prompt === "string" ? source.prompt : "",
    outputSchema,
  }
}
