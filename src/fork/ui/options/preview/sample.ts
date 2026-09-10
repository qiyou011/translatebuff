import i18next from "i18next"
import { i18n } from "@/utils/i18n"

// 只读取已打包的界面语言资源；与翻译目标语言、发行版和网络无关。
export function getPreviewSample() {
  return {
    text: i18n.t("forkPreview.sampleText"),
    language: (i18next.resolvedLanguage ?? "en").split("-")[0]!,
  }
}
