import { IconSettings } from "@tabler/icons-react"
import { useCallback } from "react"
import { SelectionToolbarTooltip } from "@/entrypoints/selection.content/components/selection-tooltip"
import { i18n } from "@/utils/i18n"
import { sendMessage } from "@/utils/message"

// fork：选区工具栏「设置」齿轮——替代默认词典动作按钮（词典是结构化输出动作，在任译喵网关模型上不受支持）。
// 点击打开扩展选项页的「选区工具栏」设置页（options.html#/selection-toolbar）。按钮样式对齐 CustomActionTrigger。
export function SelectionToolbarSettingsButton() {
  const label = i18n.t("popup.options")
  const handleClick = useCallback(() => {
    void sendMessage("openOptionsPage", { route: "/selection-toolbar" })
  }, [])

  return (
    <SelectionToolbarTooltip
      content={label}
      render={
        <button
          type="button"
          aria-label={label}
          className="flex h-7 shrink-0 cursor-pointer items-center justify-center px-2 hover:bg-accent"
          onClick={handleClick}
        />
      }
    >
      <IconSettings className="size-4.5" />
    </SelectionToolbarTooltip>
  )
}
