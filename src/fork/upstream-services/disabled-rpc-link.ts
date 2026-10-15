import type { ClientLink } from "@orpc/client"
import type { ExtensionORPCClientContext } from "@/utils/orpc/client-context"
import { UpstreamCloudDisabledError } from "./disabled-error"

// 禁用 transport 不初始化 fetch link；新增 router 方法也共用此出口。
export const disabledRpcLink: ClientLink<ExtensionORPCClientContext> = {
  async call(): Promise<never> {
    throw new UpstreamCloudDisabledError()
  },
}
