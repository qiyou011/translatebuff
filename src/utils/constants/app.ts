import { browser } from "#imports"
import { FORK_BRANDING } from "@/fork/branding"

export const APP_NAME = FORK_BRANDING.name
const manifest = browser.runtime.getManifest()
export const EXTENSION_VERSION = manifest.version
