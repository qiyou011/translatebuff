import { browser } from "#imports"
import { featureConfigService } from "@/fork/background/feature-config-service"
import { createFeatureBackup } from "@/fork/config/backup"
import { addBackup, isSameAsLatestBackup } from "@/utils/backup/storage"
import { EXTENSION_VERSION } from "@/utils/constants/app"
import { BACKUP_INTERVAL_MINUTES } from "@/utils/constants/backup"
import { CONFIG_SCHEMA_VERSION } from "@/utils/constants/config"
import { logger } from "@/utils/logger"

const CONFIG_BACKUP_ALARM = "config-backup"

export function setUpConfigBackup() {
  // Set up periodic alarm for config backup (only if it doesn't exist yet —
  // re-creating it on every service-worker start resets the timer, which
  // would wake the worker `delayInMinutes` later in a perpetual loop)
  void browser.alarms.get(CONFIG_BACKUP_ALARM).then((existingAlarm) => {
    if (!existingAlarm) {
      void browser.alarms.create(CONFIG_BACKUP_ALARM, {
        delayInMinutes: BACKUP_INTERVAL_MINUTES,
        periodInMinutes: BACKUP_INTERVAL_MINUTES,
      })
    }
  })

  // Listen for alarm events
  browser.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === CONFIG_BACKUP_ALARM) {
      await performAutoBackup()
    }
  })

  logger.info("Config auto-backup scheduled every", BACKUP_INTERVAL_MINUTES, "minutes")
}

async function performAutoBackup() {
  try {
    const { config, forkConfig } = createFeatureBackup(await featureConfigService.read())

    if (await isSameAsLatestBackup(config, CONFIG_SCHEMA_VERSION, forkConfig)) {
      logger.info("Skipping backup: config is identical to latest backup")
      return
    }

    // Add backup
    await addBackup(config, EXTENSION_VERSION, forkConfig)

    logger.info("Auto backup completed successfully")
  } catch (error) {
    logger.error("Failed to perform auto backup:", error)
  }
}
