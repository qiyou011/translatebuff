/**
 * Migration script from v085 to v086
 * - Repairs custom actions whose localized strings were persisted before i18n initialized.
 * - Keeps the rest of the user's config intact.
 *
 * IMPORTANT: All values are hardcoded inline. Migration scripts are frozen
 * snapshots - never import constants or helpers that may change.
 */

function nonEmptyString(value: any, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback
}

function repairOutputField(field: any, actionIndex: number, fieldIndex: number): any {
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

function repairAction(action: any, actionIndex: number): any {
  const source = action && typeof action === "object" ? action : {}
  const rawOutputSchema = Array.isArray(source.outputSchema) ? source.outputSchema : []
  const outputSchema =
    rawOutputSchema.length > 0
      ? rawOutputSchema.map((field: any, fieldIndex: number) =>
          repairOutputField(field, actionIndex, fieldIndex),
        )
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

export function migrate(oldConfig: any): any {
  if (!oldConfig || typeof oldConfig !== "object") {
    return oldConfig
  }

  const selectionToolbar = oldConfig.selectionToolbar
  if (!selectionToolbar || typeof selectionToolbar !== "object") {
    return oldConfig
  }

  const customActions = selectionToolbar.customActions
  if (!Array.isArray(customActions)) {
    return oldConfig
  }

  return {
    ...oldConfig,
    selectionToolbar: {
      ...selectionToolbar,
      customActions: customActions.map(repairAction),
    },
  }
}
