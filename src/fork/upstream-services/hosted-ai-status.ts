import { storage } from "#imports"
import { onMessage } from "@/utils/message"

export async function clearHostedAiStatusCache(): Promise<void> {
  await storage.removeItem("session:hostedAiStatus")
}

export function setupHostedAiStatusHandler(): void {
  // 保留消息契约，不读取旧可用缓存；最终拒绝由 RPC 出口保障。
  onMessage("getHostedAiStatus", async () => null)
}
