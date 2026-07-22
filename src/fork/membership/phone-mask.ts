// 手机号脱敏展示（对齐官网风格）：保留国际区号但去连字符（+86- → +86）+ **** + 号码后 4 位，
// 不暴露首位。例：+86-13800138000 → +86****8000。号码主体位数 ≤4 时全遮（****），不暴露任何位。
// 平台 login_status 返回的 mobile 形如 "+86-<11 位>"，也兼容无前缀的纯号码。
export function maskPhone(phone: string): string {
  if (!phone) {
    return ""
  }
  const [, prefix = "", number = phone] = phone.match(/^(\+\d+-)?(.*)$/) ?? []
  const countryCode = prefix.replace(/-$/, "")
  if (number.length <= 4) {
    return `${countryCode}****`
  }
  return `${countryCode}****${number.slice(-4)}`
}
