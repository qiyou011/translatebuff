import type { authClient as UpstreamAuthClient } from "@/utils/auth/auth-client"
import { UpstreamCloudDisabledError } from "./disabled-error"

// 类型依赖保留契约校验；不初始化 better-auth，也不订阅上游会话。
export const authClient = {
  async getSession(): Promise<Awaited<ReturnType<typeof UpstreamAuthClient.getSession>>> {
    return { data: null, error: null }
  },
  useSession(): ReturnType<typeof UpstreamAuthClient.useSession> {
    return {
      data: null,
      error: null,
      isPending: false,
      isRefetching: false,
      refetch: async () => {},
    }
  },
  async signOut(): Promise<never> {
    throw new UpstreamCloudDisabledError()
  },
}
