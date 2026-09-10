import type { ClientLink } from "@orpc/client"
import { UpstreamCloudDisabledError } from "./disabled-error"

// 禁用 transport 不初始化 fetch link；新增 router 方法也共用此出口。
export const disabledRpcLink: ClientLink<Record<string, unknown>> = {
  async call(): Promise<never> {
    throw new UpstreamCloudDisabledError()
  },
}
