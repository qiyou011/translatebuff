// fork：隐藏翻译浮窗的「猜你想存」推荐卡（save-to-notebase 建议，上游 read-frog 功能，任译喵不展示）。
// 经 wxt.config resolve 重定向顶替上游 save-suggestion-card.tsx，渲染空。仅视觉隐藏——上游数据 hook 不动。
// 上游调用点传入的 suggestion/markShownOnce prop 在此忽略（重定向为构建期行为，provider.tsx 的 TS 仍解析真身）。
export function SaveSuggestionCard() {
  return null
}
