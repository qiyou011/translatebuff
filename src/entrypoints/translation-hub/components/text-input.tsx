import { useAtom, useAtomValue, useSetAtom } from "jotai"
import { Button } from "@/components/ui/base-ui/button"
import { Textarea } from "@/components/ui/base-ui/textarea"
import { i18n } from "@/utils/i18n"
import {
  inputTextAtom,
  sourceLangCodeAtom,
  targetLangCodeAtom,
  translateRequestAtom,
} from "../atoms"

export function TextInput() {
  const [value, setValue] = useAtom(inputTextAtom)
  const sourceLangCode = useAtomValue(sourceLangCodeAtom)
  const targetLangCode = useAtomValue(targetLangCodeAtom)
  const setTranslateRequest = useSetAtom(translateRequestAtom)

  const handleTranslate = () => {
    if (!value.trim()) return
    setTranslateRequest({
      inputText: value,
      sourceLanguage: sourceLangCode,
      targetLanguage: targetLangCode,
      timestamp: Date.now(),
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleTranslate()
    }
  }

  return (
    <div className="flex h-full min-h-[28rem] flex-col">
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={i18n.t("translationHub.inputPlaceholder")}
        className="max-h-[calc(100vh-18rem)] min-h-32 resize-none overflow-y-auto border-0 bg-transparent px-3 py-2 text-base! leading-7 shadow-none focus-visible:ring-0"
        style={{ userSelect: "text" }}
      />

      <div className="mt-4 px-3">
        <Button
          onClick={handleTranslate}
          disabled={!value.trim()}
          size="lg"
          className="relative h-14 w-full rounded-xl text-base font-semibold shadow-control"
        >
          {i18n.t("translationHub.translate")}
          <span className="absolute right-4 text-xs font-medium opacity-70">⌘↵</span>
        </Button>
      </div>
    </div>
  )
}
