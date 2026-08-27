import { z } from "zod"
import { storage } from "#imports"
import { storageAdapter } from "@/utils/atoms/storage-adapter"

// 任译喵会员会话：登录身份（凭据 + 手机号 + 用户信息）。
// 独立存储键，绝不进上游 configSchema、绝不复用 better-auth session。sk_key 不存这里，其 SSOT 在 providersConfig。
export const FORK_SESSION_STORAGE_KEY = "forkSession"
export const FORK_SESSION_SCHEMA_VERSION = 1

// 未登录时 load 的返回值。
export const DEFAULT_FORK_SESSION_NULL = null

export const forkSessionSchema = z.object({
  schemaVersion: z.number().default(FORK_SESSION_SCHEMA_VERSION),
  loginCredential: z.string(),
  phone: z.string(),
  // 海外线唯一身份标识（Google 登录无手机号）。加性可选字段 + default，旧会话 safeParse 仍通过，
  // 故不升 FORK_SESSION_SCHEMA_VERSION（loadForkSession 也从不读该字段分流）。
  email: z.string().default(""),
  // user 形状以真接口/参考站为准（Open Question），本迭代宽松存放 login_status 返回体。
  user: z.record(z.string(), z.unknown()).default({}),
})

export type ForkSession = z.infer<typeof forkSessionSchema>

// 读会话；缺失或校验失败返回 null（视为未登录）。
export async function loadForkSession(): Promise<ForkSession | null> {
  const stored = await storage.getItem<ForkSession>(`local:${FORK_SESSION_STORAGE_KEY}`)
  if (!stored) {
    return DEFAULT_FORK_SESSION_NULL
  }
  const parsed = forkSessionSchema.safeParse(stored)
  return parsed.success ? parsed.data : DEFAULT_FORK_SESSION_NULL
}

// 写会话（登录成功）。补齐 schemaVersion，经 storageAdapter 校验后落盘。
// 入参取 z.input 而非 ForkSession：带 default 的加性字段（email）在输入侧应可省略，
// 这样新增此类字段不会连坐所有既有调用方。
export async function saveForkSession(
  input: Omit<z.input<typeof forkSessionSchema>, "schemaVersion">,
): Promise<void> {
  const session = forkSessionSchema.parse({ ...input, schemaVersion: FORK_SESSION_SCHEMA_VERSION })
  await storageAdapter.set(FORK_SESSION_STORAGE_KEY, session, forkSessionSchema)
}

// 清会话（登出 / 凭据失效）。
export async function clearForkSession(): Promise<void> {
  await storage.removeItem(`local:${FORK_SESSION_STORAGE_KEY}`)
}
