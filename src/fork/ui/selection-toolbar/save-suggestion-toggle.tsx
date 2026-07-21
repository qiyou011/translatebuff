// fork：移除选项页「保存建议」开关（控制上游 save-to-notebase 建议功能，任译喵已隐藏该功能 UI，开关留着会误导）。
// 经 wxt.config resolve 重定向顶替上游 selection-toolbar-save-suggestion-toggle.tsx，渲染空。
export function SelectionToolbarSaveSuggestionToggle() {
  return null
}
