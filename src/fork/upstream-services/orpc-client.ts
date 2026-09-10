import type { ORPCRouterClient } from "@read-frog/api-contract"
import { createORPCClient } from "@orpc/client"
import { createTanstackQueryUtils } from "@orpc/tanstack-query"
import { disabledRpcLink } from "./disabled-rpc-link"

export const orpcClient: ORPCRouterClient = createORPCClient(disabledRpcLink)
export const orpc = createTanstackQueryUtils(orpcClient)
