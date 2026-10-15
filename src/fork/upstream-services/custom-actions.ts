import type { Config } from "@/types/config/config"
import type { SelectionToolbarCustomAction } from "@/types/config/selection-toolbar"
import type { BuiltInActionId } from "@/utils/constants/custom-action"
import { isApprovedBuiltInAction, isApprovedCustomAction } from "@/fork/upstream-admission"
import { isBuiltInActionId } from "@/utils/constants/custom-action"
import {
  findSelectionToolbarAction as findUpstreamAction,
  getBuiltInAction as getUpstreamBuiltInAction,
  getBuiltInActions as getUpstreamBuiltInActions,
} from "@/utils/custom-actions"
import { UpstreamCloudDisabledError } from "./disabled-error"

export * from "@/utils/custom-actions"

type SelectionToolbarConfig = Config["selectionToolbar"]

export function getBuiltInAction(
  config: SelectionToolbarConfig,
  id: BuiltInActionId,
): SelectionToolbarCustomAction {
  const action = getUpstreamBuiltInAction(config, id)
  return isApprovedBuiltInAction(id) ? action : { ...action, enabled: false }
}

export function getBuiltInActions(config: SelectionToolbarConfig): SelectionToolbarCustomAction[] {
  return getUpstreamBuiltInActions(config).filter(({ id }) => isApprovedBuiltInAction(id))
}

export function getSelectionToolbarActions(
  config: SelectionToolbarConfig,
): SelectionToolbarCustomAction[] {
  return [...getBuiltInActions(config), ...config.customActions]
}

export function findSelectionToolbarAction(
  config: SelectionToolbarConfig,
  id: string,
): SelectionToolbarCustomAction | undefined {
  if (isBuiltInActionId(id) && !isApprovedCustomAction(id)) return undefined
  return findUpstreamAction(config, id)
}

export function resolveNoteSuggestionAction(
  _config: SelectionToolbarConfig,
): SelectionToolbarCustomAction {
  throw new UpstreamCloudDisabledError()
}
