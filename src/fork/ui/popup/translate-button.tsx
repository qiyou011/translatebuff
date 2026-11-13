import { useAtom, useAtomValue } from "jotai"
import { useEffect, useRef, useState } from "react"
import { browser } from "#imports"
import { Button } from "@/components/ui/base-ui/button"
import { isPageTranslatedAtom } from "@/entrypoints/popup/atoms/auto-translate"
import { isIgnoreTabAtom } from "@/entrypoints/popup/atoms/ignore"
import {
  isCurrentSiteInBlacklistAtom,
  isCurrentSiteInWhitelistAtom,
} from "@/entrypoints/popup/atoms/site-control"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import { formatHotkeyParts } from "@/utils/os"
import { isShortcutEmpty } from "@/utils/shortcut"
import { requestPageTranslation } from "./page-translation-request"

export default function TranslateButton({ className }: { className?: string }) {
  const [translated, setTranslated] = useAtom(isPageTranslatedAtom)
  const ignored = useAtomValue(isIgnoreTabAtom)
  const { mode } = useAtomValue(configFieldsAtomMap.siteControl)
  const inWhitelist = useAtomValue(isCurrentSiteInWhitelistAtom)
  const inBlacklist = useAtomValue(isCurrentSiteInBlacklistAtom)
  const config = useAtomValue(configFieldsAtomMap.pageTranslation)
  const request = useRef<AbortController | null>(null)
  const [pending, setPending] = useState(false)
  const [failed, setFailed] = useState(false)
  const blocked = ignored || (mode === "whitelist" ? !inWhitelist : inBlacklist)
  useEffect(() => () => request.current?.abort(), [])
  useEffect(() => {
    if (blocked) request.current?.abort()
  }, [blocked])

  const toggle = async () => {
    if (request.current || blocked) return
    const controller = new AbortController()
    request.current = controller
    setPending(true)
    setFailed(false)
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true })
      if (tab?.id === undefined) throw new Error("No active tab")
      controller.signal.throwIfAborted()
      const actual = await requestPageTranslation(tab.id, !translated, controller.signal)
      setTranslated(actual)
    } catch {
      if (!controller.signal.aborted) setFailed(true)
    } finally {
      request.current = null
      setPending(false)
    }
  }
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <Button
        className={className}
        disabled={blocked || pending}
        aria-busy={pending}
        onClick={() => void toggle()}
      >
        {pending
          ? i18n.t("quickTranslation.loading")
          : translated
            ? i18n.t("popup.showOriginal")
            : i18n.t("quickTranslation.translatePage")}
        {!translated && !pending && !isShortcutEmpty(config.page.shortcut) && (
          <kbd className="ml-2 text-xs">{formatHotkeyParts(config.page.shortcut).join(" + ")}</kbd>
        )}
      </Button>
      {failed && (
        <span role="alert" className="text-xs text-destructive">
          {i18n.t("inputTranslationBar.failed")}
        </span>
      )}
    </div>
  )
}
