import type { backgroundAuthClient as UpstreamBackgroundAuthClient } from "@/utils/auth/background-auth-client"
import { UpstreamCloudDisabledError } from "./disabled-error"

export const backgroundAuthClient = {
  async getSession(): Promise<Awaited<ReturnType<typeof UpstreamBackgroundAuthClient.getSession>>> {
    return { data: null, error: null }
  },
  async signOut(): Promise<never> {
    throw new UpstreamCloudDisabledError()
  },
}
