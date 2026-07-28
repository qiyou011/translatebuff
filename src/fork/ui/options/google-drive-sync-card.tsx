// fork：隐藏上游「Google Drive 云端同步」卡片。Google Drive 同步是上游 read-frog 功能，
// 任译喵自建后端 + 会员体系、配置同步走自有路径，不提供 Google Drive 同步；留着会误导用户。
// 经 wxt.config resolve 重定向顶替上游 config/google-drive-sync/index.tsx（目录桶导入），渲染空。
export function GoogleDriveSyncCard() {
  return null
}
