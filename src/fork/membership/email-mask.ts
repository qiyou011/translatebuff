// 邮箱脱敏展示（海外线身份）：保留用户名首字符 + *** + 完整域名。
// 例：alice@gmail.com → a***@gmail.com。规格对齐官网 translatebuff-official-website-overseas
// 的 src/utils/format.ts maskEmail，两端展示效果必须一致。
//
// 官网那版直接用 `email.slice(email.indexOf("@"))`，对两类输入会失真：空串得 "***"、
// 无 "@" 的输入因 indexOf 返 -1 而 slice(-1) 取到末字符（alice → "a***e"，反而泄漏了一位）。
// 本仓按 phone-mask 的惯例把边界写死：空串 → 空串；取不到合法域名 → 全遮 "***"，不暴露任何位。
export function maskEmail(email: string): string {
  if (!email) {
    return ""
  }
  const at = email.indexOf("@")
  if (at <= 0) {
    return "***"
  }
  return `${email.slice(0, 1)}***${email.slice(at)}`
}
