// 换皮：上游 src/components/badges/plan-badge.tsx。
//
// 上游这个徽标有两个职责：标注账号所在套餐（账号菜单），以及标注某功能需要哪个套餐
// 并挂升级引导（Built-in AI 的 provider 行）。两者都是 read-frog 自家的计费体系。
// 任译喵有自己的会员标识（fork popup 账号菜单里的 PRO 徽标），不该再显示上游套餐，
// 更不该留上游的升级入口。
//
// 保留 PLANS / Plan 的具名导出：上游其它模块按类型引用它们，删掉会连带断链；
// 只把渲染变成空。
export { PLANS, type Plan } from "@/components/badges/plan-badge"

export function PlanBadge(_props: Record<string, unknown>) {
  return null
}
