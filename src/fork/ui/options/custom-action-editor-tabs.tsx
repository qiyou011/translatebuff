import type { ReactNode } from "react"

// 保留上游配置编辑器，仅不挂载未批准的云笔记页及其状态/查询组件。
export function ActionEditorTabs({ config }: { config: ReactNode; notebase: ReactNode }) {
  return config
}
