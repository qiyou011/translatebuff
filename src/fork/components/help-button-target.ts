import { getWebsiteUrl } from "@/fork/website-url"

// 上游 HelpButton 点开的是 read-frog 的 GitHub issues 列表，那是上游自己的支持渠道，
// 任译喵用户点进去只会困惑。抽成独立模块而不是整份换皮 help-button.tsx：
// 该组件除这一行外全是拖拽定位逻辑，复制一份等于给自己多一处要对账的上游副本。
export function openSupportSite() {
  window.open(getWebsiteUrl(), "_blank", "noopener,noreferrer")
}
