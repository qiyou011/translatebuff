import { ensureInitializedConfig } from "@/entrypoints/background/config"
import { createFeatureConfigStore } from "./initialize-feature-config"
import { repairCustomActions } from "./repair-custom-actions"

export const featureConfigService = createFeatureConfigStore(async () => {
  await repairCustomActions()
  await ensureInitializedConfig()
})
