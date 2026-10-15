import type { ExtensionORPCClient } from "@/utils/orpc/client-context"
import { createORPCClient } from "@orpc/client"
import { createTanstackQueryUtils } from "@orpc/tanstack-query"
import { disabledRpcLink } from "./disabled-rpc-link"

export const orpcClient: ExtensionORPCClient = createORPCClient(disabledRpcLink)
export const orpc = createTanstackQueryUtils(orpcClient)
