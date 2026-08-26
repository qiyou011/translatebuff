// 换皮：上游 options/pages/video-subtitles/ai-quota。
//
// 上游的 AI 字幕（为无字幕视频生成字幕）依赖它自建的转录后端（orpc videoTranscript），
// 并挂在 Pro/Ultra 分钟配额门禁下。任译喵没有对应服务——是否立项见 MUL-63——
// 所以这块配额 UI 不该出现，更不该去查上游配额。
export function AiQuotaSection() {
  return null
}
