import type { ORPCRouterClient } from "@read-frog/api-contract"
import { createORPCClient } from "@orpc/client"
import { disabledRpcLink } from "./disabled-rpc-link"

export const backgroundOrpcClient: ORPCRouterClient = createORPCClient(disabledRpcLink)
