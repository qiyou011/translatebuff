import { atom, useAtom } from "jotai"
import { ConfigDetailSection } from "@/entrypoints/options/components/config-detail-section"
import { PageLayout } from "@/entrypoints/options/components/page-layout"
import { CSSEditor } from "@/entrypoints/options/pages/translation/translation-style/custom-css/css-editor"
import { PreviewControls } from "@/entrypoints/options/pages/translation/translation-style/custom-css/preview-controls"
import { i18n } from "@/utils/i18n"
import { getPreviewSample } from "./sample"
import { StylePreview } from "./style-preview"

/**
 * The CSS editor and its preview, drilled into from the Translation Display Style section. An
 * editor tall enough to write rules in cannot share a row with anything, so it gets a page.
 *
 * The preview leads: it is the result being worked towards, and putting it first keeps it in view
 * while the rules that produce it are written below. The sample it renders is described by the
 * controls further down, so the state for those lives here rather than beside them.
 */
// 会话内预览草稿：LocaleBoundary 切换语言会重挂载子树，Jotai store 位于其上方。
// 不进入 storage；关闭选项页即释放。undefined 表示仍跟随默认值，空字符串是手动清空。
const previewDraftAtom = atom<{ text?: string; language?: string; dir?: "ltr" | "rtl" }>({})

export function CustomCssPage() {
  const sample = getPreviewSample()
  const [draft, setDraft] = useAtom(previewDraftAtom)
  const text = draft.text ?? sample.text
  const language = draft.language ?? sample.language
  const dir = draft.dir ?? "ltr"

  return (
    <PageLayout
      title={i18n.t("options.translation.title")}
      description={i18n.t("options.translation.pageDescription")}
    >
      <ConfigDetailSection
        backTo="/page-translation"
        title={
          <span id="custom-css">{i18n.t("options.translation.translationStyle.cssEditor")}</span>
        }
      >
        <StylePreview text={text} language={language} dir={dir} />
        <CSSEditor />
        <PreviewControls
          language={language}
          onLanguageChange={(value) => setDraft((previous) => ({ ...previous, language: value }))}
          dir={dir}
          onDirChange={(value) => setDraft((previous) => ({ ...previous, dir: value }))}
          text={text}
          onTextChange={(value) => setDraft((previous) => ({ ...previous, text: value }))}
        />
      </ConfigDetailSection>
    </PageLayout>
  )
}
