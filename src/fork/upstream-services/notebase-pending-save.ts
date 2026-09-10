import type { createNotebasePendingSaveProcessor as UpstreamCreate } from "@/entrypoints/background/notebase-pending-save"

export function createNotebasePendingSaveProcessor(_deps: Parameters<typeof UpstreamCreate>[0]) {
  return async function processPendingNotebaseSave(_reason: string): Promise<void> {}
}

export function setupNotebasePendingSaveProcessor(_waitUntilReady: () => Promise<void>): void {
  // 不启动、不订阅 Cookie、不读取或删除旧任务。
}
