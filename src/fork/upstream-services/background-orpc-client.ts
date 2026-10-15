import type { ExtensionORPCClient } from "@/utils/orpc/client-context"
import { createORPCClient } from "@orpc/client"
import { disabledRpcLink } from "./disabled-rpc-link"

export const backgroundOrpcClient: ExtensionORPCClient = createORPCClient(disabledRpcLink)
