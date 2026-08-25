/**
 * fork 版 options 侧边栏「产品」组的入口清单。
 *
 * 上游给出「路线图 + 反馈」两条，都指向它自家的 Featurebase 门户。任译喵没有路线图页，
 * 反馈也走自己的站点，所以这里只留反馈、并写死 fork 站点地址。
 */
export interface ForkProductLink {
  href: string
  icon: string
  labelKey: "options.product.feedback" | "options.product.roadmap"
}

export const FORK_PRODUCT_LINKS: ForkProductLink[] = [
  {
    href: "https://www.translatebuff.cn/feedback",
    icon: "tabler:message-circle",
    labelKey: "options.product.feedback",
  },
]
