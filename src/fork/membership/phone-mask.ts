// 手机号脱敏展示：保留可选国际区号前缀（如 +86-）+ 号码首 1 位 + **** + 后 4 位。
// 例：+86-16602836132 → +86-1****6132。号码主体位数 ≤5 时全遮（****），不暴露任何位。
// 平台 login_status 返回的 mobile 形如 "+86-<11 位>"，也兼容无前缀的纯号码。
export function maskPhone(phone: string): string {
  if (!phone) {
    return ""
  }
  const [, prefix = "", number = phone] = phone.match(/^(\+\d+-)?(.*)$/) ?? []
  if (number.length <= 5) {
    return `${prefix}****`
  }
  return `${prefix}${number.slice(0, 1)}****${number.slice(-4)}`
}
