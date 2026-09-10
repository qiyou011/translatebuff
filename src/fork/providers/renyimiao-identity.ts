// 纯身份判断叶子：供 provider registry 使用，避免经配置/默认值反向依赖 registry。
export const RENYIMIAO_ID_PREFIX = "renyimiao-"

export function isRenyimiaoInstance(provider: { id: string }): boolean {
  return provider.id.startsWith(RENYIMIAO_ID_PREFIX)
}
