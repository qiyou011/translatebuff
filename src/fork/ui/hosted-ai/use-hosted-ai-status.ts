import type { HostedAiStatusResult } from "@/components/llm-providers/use-hosted-ai-status"

// 换皮：上游 src/components/llm-providers/use-hosted-ai-status.ts。
//
// 上游的 Built-in AI 是它自家的托管模型 + 分层配额（Normal/Ultra），状态来自
// read-frog 后端的 orpc `hostedAi.status`。任译喵有自己的会员体系，这套既不该出现在
// 界面上，也不该真去打上游接口。
//
// 掐状态源一处即可覆盖全部 13 个消费方（provider 下拉、内置 provider 编辑器、
// 配额页、账号菜单、AI 内容感知等）——比逐个换皮组件省，也不会漏掉新增的消费方。
//
// 恒定返回「未登录 + 无状态 + 不在加载中」：各 UI 拿不到 status 就不渲染配额与分层，
// isPending 保持 false 避免它们卡在骨架屏。不再是 React hook（无需 hooks 环境），
// 但签名与上游一致，调用方无感。
export function useHostedAiStatus(_options: { enabled?: boolean } = {}): HostedAiStatusResult {
  return {
    status: undefined,
    isSignedIn: false,
    isPending: false,
    isError: false,
  }
}
