import type { FeatureConfigPatch, FeatureConfigSnapshot } from "./types"
import { atom } from "jotai"
import { patchFeatureConfig, readFeatureConfig, subscribeFeatureConfig } from "./storage"

const featureConfigStateAtom = atom<{
  snapshot: FeatureConfigSnapshot | null
  failed: boolean
}>({ snapshot: null, failed: false })
featureConfigStateAtom.onMount = (set) =>
  subscribeFeatureConfig(
    (snapshot) => set({ snapshot, failed: false }),
    () => set((state) => ({ ...state, failed: true })),
  )

// null 表示后台尚未 ready；消费端不能用临时默认值启动翻译。
export const featureConfigAtom = atom(
  (get) => get(featureConfigStateAtom).snapshot,
  (_get, set, snapshot: FeatureConfigSnapshot | null) =>
    set(featureConfigStateAtom, { snapshot, failed: false }),
)
export const featureConfigLoadFailedAtom = atom((get) => get(featureConfigStateAtom).failed)

export const writeFeatureConfigAtom = atom(
  null,
  async (_get, set, patch: Omit<FeatureConfigPatch, "expectedRevision">) => {
    let snapshot = await readFeatureConfig()
    for (let attempt = 0; attempt < 3; attempt++) {
      const result = await patchFeatureConfig({ ...patch, expectedRevision: snapshot.revision })
      snapshot = result.snapshot
      if (result.ok) {
        set(featureConfigAtom, snapshot)
        return
      }
    }
    throw new Error("Configuration changed repeatedly; please retry")
  },
)
