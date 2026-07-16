import { useSetAtom } from "jotai"
import { useEffect } from "react"
import { writeConfigAtom } from "@/utils/atoms/config"
import { ensureRenyimiaoSeeded } from "./renyimiao"

// fork UI 挂载时幂等 seed 任译喵的共享 hook：popup 与选项页各调一行。
// 收敛 seed 的挂载契约（读 storage 最新值、用哪个 setter、依赖数组）到单一真源，避免两处 useEffect 漂移。
export function useEnsureRenyimiaoSeeded(): void {
  const setConfig = useSetAtom(writeConfigAtom)
  useEffect(() => {
    void ensureRenyimiaoSeeded(setConfig)
  }, [setConfig])
}
