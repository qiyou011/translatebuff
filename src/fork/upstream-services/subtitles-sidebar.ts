import type { SubtitlesProvidersAdapter } from "@/entrypoints/subtitles.content/universal-adapter"

// 学习侧栏尚未批准：不创建 host、不挂载 Provider/query，也不订阅菜单状态。
export function mountSubtitlesSidebar(_adapter: SubtitlesProvidersAdapter): void {}

export function SubtitlesSidebarItem() {
  return null
}

export function SubtitlesSidebar() {
  return null
}
