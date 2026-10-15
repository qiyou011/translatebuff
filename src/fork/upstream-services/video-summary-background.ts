import { onMessage } from "@/utils/message"
import { UpstreamCloudDisabledError } from "./disabled-error"

export function setupVideoSummaryHandlers(): void {
  onMessage("getCachedVideoSummary", async () => null)
  onMessage("saveVideoSummary", async () => {
    throw new UpstreamCloudDisabledError()
  })
}
