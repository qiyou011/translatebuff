import type { MembershipInfo } from "./tier"
import { atom, useAtom } from "jotai"
import { useEffect } from "react"
import { z } from "zod"
import { storage } from "#imports"
import { sendForkMessage } from "@/fork/message"
import { storageAdapter } from "@/utils/atoms/storage-adapter"

// 任译喵会员信息（类型 / 到期 / 剩余额度）：独立存储键，**不进 ForkSession**——用量是动态值，
// 钉进登录快照会陈旧（架构审查 A）。由后台登录/刷新时派生写入，popup/选项页只读。
export const FORK_MEMBERSHIP_INFO_STORAGE_KEY = "forkMembershipInfo"

// 校验 storage 落盘形状；结构对齐 tier.ts 的 MembershipInfo（deriveMembershipInfo 输出）。
export const membershipInfoSchema = z.object({
  tier: z.enum(["free", "pro"]),
  expiryDate: z.string().nullable(),
  remainQuota: z.number(),
})

// 读会员信息；缺失或校验失败返回 null。
export async function loadMembershipInfo(): Promise<MembershipInfo | null> {
  const stored = await storage.getItem<MembershipInfo>(`local:${FORK_MEMBERSHIP_INFO_STORAGE_KEY}`)
  if (!stored) {
    return null
  }
  const parsed = membershipInfoSchema.safeParse(stored)
  return parsed.success ? parsed.data : null
}

// 写会员信息（后台登录/刷新派生后）。
export async function saveMembershipInfo(info: MembershipInfo): Promise<void> {
  await storageAdapter.set(FORK_MEMBERSHIP_INFO_STORAGE_KEY, info, membershipInfoSchema)
}

// 清会员信息（登出 / 凭据失效）——必须与 clearForkSession 一起调用，防登出后残留上一用户的 PRO/用量幽灵态。
export async function clearMembershipInfo(): Promise<void> {
  await storage.removeItem(`local:${FORK_MEMBERSHIP_INFO_STORAGE_KEY}`)
}

// 响应式会员信息载体：popup / 选项页共享。初值 null，由 useForkMembershipInfo 挂载水合 + 订阅 storage 变化。
export const membershipInfoAtom = atom<MembershipInfo | null>(null)

// 响应式会员信息 hook：挂载水合 + storage.watch 订阅后台写入 + 请后台刷新一次（popup 打开重拉用量，保证实时）。
export function useForkMembershipInfo(): MembershipInfo | null {
  const [info, setInfo] = useAtom(membershipInfoAtom)
  useEffect(() => {
    let active = true
    const hydrate = () => {
      void loadMembershipInfo().then((loaded) => {
        if (active) {
          setInfo(loaded)
        }
      })
    }
    hydrate()
    // 打开即请后台用会话凭据重拉 tokens 重派生（用量动态，避免陈旧）。无会话则后台跳过。
    void sendForkMessage("forkRefreshMembershipInfo")
    const unwatch = storage.watch(`local:${FORK_MEMBERSHIP_INFO_STORAGE_KEY}`, hydrate)
    return () => {
      active = false
      unwatch()
    }
  }, [setInfo])
  return info
}
