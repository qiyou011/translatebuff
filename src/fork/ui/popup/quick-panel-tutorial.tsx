import { useAtomValue } from "jotai"
import discord from "@/assets/images/panel-v170/discord-icon.svg"
import inputAfterDark from "@/assets/images/panel-v170/input-after-dark.svg"
import inputAfter from "@/assets/images/panel-v170/input-after.svg"
import inputBeforeDark from "@/assets/images/panel-v170/input-before-dark.svg"
import inputBefore from "@/assets/images/panel-v170/input-before.svg"
import inputFeedbackDark from "@/assets/images/panel-v170/input-feedback-dark.svg"
import inputFeedback from "@/assets/images/panel-v170/input-feedback.svg"
import close from "@/assets/images/panel-v170/popover-close.svg"
import context from "@/assets/images/panel-v170/popover-context.svg"
import copy from "@/assets/images/panel-v170/popover-copy.svg"
import expand from "@/assets/images/panel-v170/popover-expand.svg"
import pin from "@/assets/images/panel-v170/popover-pin.svg"
import regenerate from "@/assets/images/panel-v170/popover-regenerate.svg"
import speak from "@/assets/images/panel-v170/popover-speak.svg"
import microsoft from "@/assets/images/panel-v170/provider-microsoft.svg"
import reddit from "@/assets/images/panel-v170/reddit-icon.svg"
import telegram from "@/assets/images/panel-v170/telegram-icon.svg"
import toolbarBrand from "@/assets/images/panel-v170/toolbar-brand-icon.svg"
import toolbarDictionary from "@/assets/images/panel-v170/toolbar-dictionary-icon.svg"
import toolbarSpeak from "@/assets/images/panel-v170/toolbar-speak-icon.svg"
import toolbarTranslate from "@/assets/images/panel-v170/toolbar-translate-icon.svg"
import videoChrome from "@/assets/images/panel-v170/video-browser-chrome.svg"
import video from "@/assets/images/panel-v170/video-tutorial.webp"
import whatsapp from "@/assets/images/panel-v170/whatsapp-icon.svg"
import x from "@/assets/images/panel-v170/x-icon.svg"
import youtube from "@/assets/images/panel-v170/youtube-icon.svg"
import { featureConfigAtom } from "@/fork/config/atoms"
import { currentEdition } from "@/fork/identity/edition"
import { i18n } from "@/utils/i18n"
import { InputLottieTutorial } from "./input-lottie-tutorial"
import { PanelIcon } from "./panel-icon"
import { SelectionLottieTutorial } from "./selection-lottie-tutorial"
import { SubtitleLottieTutorial } from "./subtitle-lottie-tutorial"

const platforms = {
  Discord: discord,
  Telegram: telegram,
  YouTube: youtube,
  X: x,
  WhatsApp: whatsapp,
  Reddit: reddit,
}

export function SupportedPlatformIcons() {
  return (
    <div className="tb-platform-icons">
      {Object.entries(platforms).map(([name, src], index) => (
        <span key={name} title={name} style={{ zIndex: 6 - index }}>
          <img src={src} alt={name} width={23} height={23} />
        </span>
      ))}
    </div>
  )
}

export function QuickPanelTutorial({ feature }: { feature: "selection" | "input" | "subtitles" }) {
  const count = useAtomValue(featureConfigAtom)?.forkConfig.inputTranslation.triggerCount ?? 2
  if (feature === "subtitles")
    return (
      <div className="tb-video-tutorial">
        <SubtitleLottieTutorial
          label={i18n.t("quickTranslation.videoExample")}
          fallback={
            <div className="tb-video-browser">
              <img className="tb-video-address" src={videoChrome} alt="" />
              <img
                src={video}
                width={352}
                height={184.5638732910156}
                alt={i18n.t("quickTranslation.videoExample")}
              />
            </div>
          }
        />
        <p>
          {i18n.t(
            currentEdition() === "cn"
              ? "quickTranslation.videoNoticeCN"
              : "quickTranslation.videoNoticeGlobal",
          )}
        </p>
      </div>
    )
  if (feature === "input")
    return (
      <div className="tb-input-tutorial">
        <div className="tb-tutorial-description">
          <p>{i18n.t("quickTranslation.inputTutorial", [count])}</p>
          <SupportedPlatformIcons />
        </div>
        <InputLottieTutorial
          label={i18n.t("quickTranslation.inputTutorial", [count])}
          fallback={
            <div className="tb-discord-scene">
              <div className="tb-discord-title">
                <img src={discord} width={16} height={16} alt="" />
                <span>Discord</span>
                <kbd>{i18n.t("quickTranslation.spaceCount", [count])}</kbd>
              </div>
              <p className="tb-scene-label">{i18n.t("quickTranslation.beforeTranslation")}</p>
              <div className="tb-composer">
                <img
                  className="tb-illustration-light"
                  src={inputBefore}
                  alt="¿Nos vemos mañana por la mañana?"
                />
                <img
                  className="tb-illustration-dark"
                  src={inputBeforeDark}
                  alt="¿Nos vemos mañana por la mañana?"
                />
              </div>
              <div className="tb-scene-label tb-scene-after">
                <span>{i18n.t("quickTranslation.afterTranslation")}</span>
                <span className="tb-example-target">
                  <img
                    className="tb-illustration-light"
                    src={inputFeedback}
                    alt={i18n.t("quickTranslation.translatedToEnglish")}
                  />
                  <img
                    className="tb-illustration-dark"
                    src={inputFeedbackDark}
                    alt={i18n.t("quickTranslation.translatedToEnglish")}
                  />
                </span>
              </div>
              <div className="tb-composer tb-composer-after">
                <img
                  className="tb-illustration-light"
                  src={inputAfter}
                  alt="Shall we meet tomorrow morning?"
                />
                <img
                  className="tb-illustration-dark"
                  src={inputAfterDark}
                  alt="Shall we meet tomorrow morning?"
                />
              </div>
            </div>
          }
        />
        {currentEdition() === "cn" && (
          <p className="tb-platform-notice">{i18n.t("quickTranslation.platformNotice")}</p>
        )}
      </div>
    )
  return (
    <div className="tb-selection-tutorial">
      <p className="tb-selection-description">{i18n.t("quickTranslation.selectionTutorial")}</p>
      <SelectionLottieTutorial
        label={i18n.t("quickTranslation.selectionTutorial")}
        fallback={
          <div className="tb-selection-scene">
            <p className="tb-example-source">
              The guide recommends <mark>a quiet morning walk</mark>.
            </p>
            <div className="tb-example-toolbar">
              {[toolbarBrand, toolbarTranslate, toolbarSpeak, toolbarDictionary].map((src) => (
                <img key={src} src={src} width={13} height={13} alt="" />
              ))}
            </div>
            <div className="tb-example-result">
              <div className="tb-example-result-title">
                <span>
                  <img src={toolbarBrand} width={12.96} height={12.96} alt="" />
                  Translation
                </span>
                <div>
                  <span>
                    {i18n.t("languages.cmn")}
                    <PanelIcon name="chevron" size={11.52} />
                  </span>
                  <img src={pin} width={11.52} height={11.52} alt="" />
                  <img src={close} width={11.52} height={11.52} alt="" />
                </div>
              </div>
              <div className="tb-example-result-body">
                <div className="tb-example-original">
                  <span>a quiet morning walk</span>
                  <img src={expand} width={11.52} height={11.52} alt="" />
                </div>
                <div className="tb-example-divider" />
                <p>{i18n.t("quickTranslation.selectionExample")}</p>
                <div className="tb-example-actions">
                  <img src={copy} width={11.52} height={11.52} alt="" />
                  <img src={speak} width={11.52} height={11.52} alt="" />
                </div>
              </div>
              <div className="tb-example-result-footer">
                <span>
                  <img src={microsoft} width={14.4} height={14.4} alt="" />
                  Microsoft Translator
                  <PanelIcon name="chevron" size={11.52} />
                </span>
                <div className="tb-example-actions">
                  <img src={context} width={11.52} height={11.52} alt="" />
                  <img src={regenerate} width={11.52} height={11.52} alt="" />
                </div>
              </div>
            </div>
          </div>
        }
      />
    </div>
  )
}
