import type { LangCodeISO6393 } from "@read-frog/definitions"
import type { FeatureSnapshot } from "@/fork/config/feature-config"
import type { WebPagePromptContext } from "@/types/content"
import { translateTextCore } from "@/utils/host/translate/translate-text"

export function executeInputTranslation({
  text,
  source,
  snapshot,
  target = snapshot.target,
  readContext,
}: {
  text: string
  source: LangCodeISO6393
  snapshot: FeatureSnapshot
  target?: LangCodeISO6393
  readContext?: () => WebPagePromptContext | undefined
}): Promise<string> {
  if (source === target) return Promise.resolve("")
  const webPageContext = snapshot.contextEnabled ? readContext?.() : undefined
  return translateTextCore({
    text,
    langConfig: { sourceCode: source, targetCode: target, level: snapshot.level },
    providerConfig: snapshot.provider,
    hostedFeature: "inputTranslation",
    extraHashTags: [`inputTranslation:${source}->${target}`],
    enableAIContentAware: snapshot.contextEnabled,
    glossaryEnabled: snapshot.glossaryEnabled,
    webPageContext,
    preserveLineBreaks: true,
  })
}
