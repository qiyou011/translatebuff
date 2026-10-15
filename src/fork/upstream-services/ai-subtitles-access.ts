// 兼容公开入口，但不初始化认证、权益查询或上游登录/购买提示。
export async function ensureSignedIn(): Promise<boolean> {
  return false
}

export async function ensureAiSubtitlesEntitled(): Promise<boolean> {
  return false
}

export async function ensureAiSubtitlesAccess(): Promise<boolean> {
  return false
}
