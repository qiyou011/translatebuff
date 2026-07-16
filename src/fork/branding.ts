// fork 品牌与域名常量，替换上游 read-frog 标识；域名为占位，后续更换。
// 注：运行时 API 地址走 env 系统（env.WXT_API_URL / .env.production），不在此重复。
export const FORK_BRANDING = {
  // ASCII 技术标识：APP_NAME 由它派生，被上游用作 IndexedDB 库名 / shadow-host 自定义元素名 /
  // guide postMessage 源 / HTTP 头等技术标识——必须保持 ASCII 稳定，绝不改中文（改了会崩内容脚本、丢用户数据）。
  name: "Translatebuff",
  // 中文显示名：仅用于 fork 可控的品牌露出（manifest name、popup 头），不进技术标识。
  displayName: "任译喵",
  websiteUrl: "https://www.translatebuff.com",
} as const
