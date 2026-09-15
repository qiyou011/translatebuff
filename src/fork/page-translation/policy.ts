import type { BatchQueueConfig } from "@/types/config/translate"

// Development candidates. Release calibration is tracked in the v1.4.0 change.
export const PAGE_LLM_BATCH_CANDIDATE: BatchQueueConfig = {
  maxItemsPerBatch: 16,
  maxCharactersPerBatch: 4000,
}
export const PAGE_MAX_CONCURRENT = 4
export const PAGE_MT_MAX_ITEMS = 100
export const PAGE_MT_PAYLOAD_BYTES = 32 * 1024

export function migratePair(current: BatchQueueConfig): BatchQueueConfig {
  return current.maxItemsPerBatch === 4 && current.maxCharactersPerBatch === 1000
    ? { ...PAGE_LLM_BATCH_CANDIDATE }
    : current
}
