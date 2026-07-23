// fork shim：卸载问卷逻辑迁至 src/fork/background/uninstall-survey.ts（C 类，零 allowlist）。
// 本文件仅 re-export，保持上游 background/index.ts 的 import 契约不变（对齐 popup / selection.content 套路）。
export { setupUninstallSurvey } from "@/fork/background/uninstall-survey"
