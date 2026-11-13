import { useAtomValue } from "jotai"
import { browser } from "#imports"
import brandIcon from "@/assets/images/panel-v170/toolbar-brand-icon.svg?url&no-inline"
import translateIcon from "@/assets/images/panel-v170/toolbar-translate-icon.svg?url&no-inline"
import { Kbd, KbdGroup } from "@/components/ui/base-ui/kbd"
import { SelectionPopover } from "@/components/ui/selection-popover"
import { SelectionToolbarTooltip } from "@/components/ui/selection-popover/selection-tooltip"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import { formatHotkeyParts } from "@/utils/os"
import { isShortcutEmpty } from "@/utils/shortcut"
import { useSelectionTranslationContext } from "./context"

// fork 翻译触发按钮（镜像上游 translate-button/index.tsx）。D4 三元组绑定：
// 消费 fork 自建 context（./context），绝不 import 上游 provider——上游 context 是 module-private，
// 混用运行时抛 "must be used within Provider"。
export function TranslateButton({ brand = false }: { brand?: boolean }) {
  const { prepareToolbarOpen } = useSelectionTranslationContext()
  const selectionToolbar = useAtomValue(configFieldsAtomMap.selectionToolbar)
  const triggerLabel = i18n.t("action.translation")
  const shortcut = selectionToolbar.features.translate.shortcut
  const shortcutParts = isShortcutEmpty(shortcut) ? [] : formatHotkeyParts(shortcut)
  const tooltipContent =
    shortcutParts.length > 0 ? (
      <span className="inline-flex items-center gap-2">
        <span>{triggerLabel}</span>
        <KbdGroup>
          {shortcutParts.map((part) => (
            <Kbd key={part}>{part}</Kbd>
          ))}
        </KbdGroup>
      </span>
    ) : (
      triggerLabel
    )

  return (
    <SelectionToolbarTooltip
      content={tooltipContent}
      render={
        <SelectionPopover.Trigger
          aria-label={brand ? i18n.t("quickTranslation.brandTranslate") : triggerLabel}
          onClick={(event) => {
            event.currentTarget.blur()
            prepareToolbarOpen()
          }}
        />
      }
    >
      <img
        src={new URL(brand ? brandIcon : translateIcon, browser.runtime.getURL("/")).href}
        width={18}
        height={18}
        alt=""
        className="tb-selection-translate-icon"
      />
    </SelectionToolbarTooltip>
  )
}
