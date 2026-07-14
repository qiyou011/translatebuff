// fork 品牌与域名常量，替换上游 read-frog 标识；域名为占位，后续更换。
// 注：运行时 API 地址走 env 系统（env.WXT_API_URL / .env.production），不在此重复。
export const FORK_BRANDING = {
  name: "Translatebuff",
  websiteUrl: "https://www.translatebuff.com",
} as const
