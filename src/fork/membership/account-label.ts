import type { ForkSession } from "./session"
import { currentEdition } from "@/fork/identity/edition"
import { i18n } from "@/utils/i18n"
import { maskEmail } from "./email-mask"
import { maskPhone } from "./phone-mask"

export interface AccountLabel {
  text: string
  /** 手机号要等宽数字对齐，邮箱不需要。 */
  tabularNums: boolean
}

// 账户展示字段的 edition 分叉**单点**：popup 与选项页共用，新增展示面只调本函数，不再各写一份判断。
// global 线 Google 登录的用户没有手机号，邮箱是唯一标识；cn 线反之（后端不返回 email）。
// 两线取空时都回退到「已登录」而非渲染空白——空白在 global 线等于丢掉唯一身份标识。
export function accountLabel(session: ForkSession): AccountLabel {
  const isGlobal = currentEdition() === "global"
  const text = isGlobal ? maskEmail(session.email) : maskPhone(session.phone)
  return {
    text: text || i18n.t("forkMembership.loggedIn"),
    tabularNums: !isGlobal,
  }
}
