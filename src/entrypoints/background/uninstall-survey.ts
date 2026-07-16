import { browser } from "#imports"

/**
 * Clear the upstream uninstall survey instead of opening a page that does not
 * belong to the fork brand. Keeping this startup call also removes a survey URL
 * that may have been registered by an older installed build.
 */
export async function setupUninstallSurvey() {
  await browser.runtime.setUninstallURL("")
}
