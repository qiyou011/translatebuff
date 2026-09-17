import { Icon } from "@iconify/react"
import { IconCheck, IconVolume, IconX } from "@tabler/icons-react"
import { BrandMark } from "@/fork/components/brand-mark"
import closeIcon from "@/fork/ui/side-content/floating-button/images/close-icon.svg?url&no-inline"
import floatingLogo from "@/fork/ui/side-content/floating-button/images/floating-logo.svg?url&no-inline"
import settingsIcon from "@/fork/ui/side-content/floating-button/images/settings-icon.svg?url&no-inline"
import translateIcon from "@/fork/ui/side-content/floating-button/images/translate-icon.svg?url&no-inline"
import unlockedIcon from "@/fork/ui/side-content/floating-button/images/unlocked-icon.svg?url&no-inline"
import { i18n } from "@/utils/i18n"
import { cn } from "@/utils/styles/utils"

type OverlayFeature = "floating-button" | "selection-toolbar" | "context-menu"

const previewGradient = [
  "radial-gradient(ellipse 42% 120% at 4% 44%, rgb(255 91 91 / 34%), transparent 72%)",
  "radial-gradient(ellipse 48% 130% at 26% 100%, rgb(84 230 143 / 28%), transparent 72%)",
  "radial-gradient(ellipse 45% 130% at 52% 0%, rgb(27 199 255 / 26%), transparent 70%)",
  "radial-gradient(ellipse 44% 125% at 78% 100%, rgb(141 92 255 / 28%), transparent 72%)",
  "radial-gradient(ellipse 36% 110% at 100% 40%, rgb(255 91 218 / 30%), transparent 72%)",
].join(", ")

export function OverlayFeaturePreview({
  feature,
  title,
  description,
}: {
  feature: OverlayFeature
  title: string
  description: string
}) {
  return (
    <div
      data-fork-overlay-preview
      role="img"
      aria-label={`${title}: ${description}`}
      className="relative -my-8 h-[248px] w-full max-w-none overflow-hidden rounded-xl bg-background"
      style={{ backgroundImage: previewGradient }}
    >
      <BrowserArticle selected={feature === "selection-toolbar"} />
      {feature === "floating-button" && <FloatingButtonScene />}
      {feature === "selection-toolbar" && <SelectionToolbarScene />}
      {feature === "context-menu" && <ContextMenuScene />}
    </div>
  )
}

function BrowserArticle({ selected = false }: { selected?: boolean }) {
  return (
    <div
      data-slot="overlay-preview-browser"
      className="absolute top-9 left-1/2 h-[176px] w-[672px] -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-background"
    >
      <div className="absolute -top-px -left-px h-8 w-[672px] bg-muted/45" />
      <div className="absolute top-[30px] -left-px h-px w-[672px] bg-border/70" />
      <span className="absolute top-[11px] left-[11px] size-2 rounded-full bg-foreground/15" />
      <span className="absolute top-[11px] left-[25px] size-2 rounded-full bg-foreground/10" />
      <span className="absolute top-[11px] left-[39px] size-2 rounded-full bg-foreground/10" />
      <span className="absolute top-2 left-[65px] h-3.5 w-28 rounded-full bg-foreground/7" />

      <div className="absolute top-[51px] left-[31px] h-36 w-[560px] overflow-hidden">
        <span className="absolute top-0 left-0 h-3 w-56 rounded-full bg-foreground/14" />
        <span className="absolute top-[22px] left-0 h-2 w-16 rounded-full bg-foreground/8" />
        <span
          className={cn(
            "absolute top-[22px] left-[70px] h-2 w-24 rounded-full",
            selected ? "bg-[#dadada]/75" : "bg-foreground/8",
          )}
        />
        <span className="absolute top-[22px] left-[172px] h-2 w-20 rounded-full bg-foreground/8" />
        <span className="absolute top-9 left-0 h-2 w-[513px] rounded-full bg-foreground/8" />
        <span className="absolute top-[50px] left-0 h-2 w-[448px] rounded-full bg-foreground/8" />
        <span className="absolute top-[68px] left-0 h-14 w-[560px] rounded-lg border border-border/50 bg-muted/35" />
      </div>
    </div>
  )
}

function FloatingButtonScene() {
  return (
    <>
      <PreviewFloatingAction className="top-[76px] left-[771px]" icon={translateIcon}>
        <span className="absolute right-[-1px] bottom-[-3px] flex size-3 items-center justify-center rounded-full bg-[#00c950] text-white">
          <IconCheck className="size-2.5" strokeWidth={2.5} />
        </span>
      </PreviewFloatingAction>
      <PreviewFloatingAction className="top-[160px] left-[771px]" icon={settingsIcon} />

      <span className="absolute top-[100px] left-[728px] flex size-8 items-center justify-center">
        <img src={closeIcon} alt="" aria-hidden="true" className="size-4" />
      </span>
      <span className="absolute top-[132px] left-[728px] flex size-8 items-center justify-center">
        <img src={unlockedIcon} alt="" aria-hidden="true" className="size-4" />
      </span>

      <span
        data-slot="overlay-preview-main-button"
        className="absolute top-28 left-[765px] size-10 rounded-full"
      >
        <img
          src={floatingLogo}
          alt=""
          aria-hidden="true"
          className="absolute -top-0.5 -left-3 h-16 w-[55px] max-w-none"
        />
      </span>
    </>
  )
}

function PreviewFloatingAction({
  className,
  icon,
  children,
}: {
  className: string
  icon: string
  children?: React.ReactNode
}) {
  return (
    <span
      data-slot="overlay-preview-tool-button"
      className={cn(
        "absolute flex size-7 items-center justify-center rounded-full border border-[#d4d4d4]/80 bg-white shadow-[0_4px_3px_rgb(0_0_0/10%),0_10px_7.5px_rgb(0_0_0/10%)] dark:border-white/10 dark:bg-neutral-900",
        className,
      )}
    >
      <img src={icon} alt="" aria-hidden="true" className="size-3.5" />
      {children}
    </span>
  )
}

function SelectionToolbarScene() {
  return (
    <div
      data-slot="overlay-preview-selection-toolbar"
      className="absolute top-[104px] left-[311px] h-9 w-28 rounded-xl bg-card shadow-[0_2px_4.5px_rgb(39_39_42/6%),0_16px_20px_rgb(39_39_42/12%)]"
    >
      <PreviewToolbarAction className="left-3">
        <Icon icon="ri:translate" className="size-[18px]" />
      </PreviewToolbarAction>
      <PreviewToolbarAction className="left-[46px]">
        <IconVolume className="size-[18px]" strokeWidth={1.6} />
      </PreviewToolbarAction>
      <PreviewToolbarAction className="left-20">
        <Icon icon="tabler:book-2" className="size-[18px]" strokeWidth={1.4} />
      </PreviewToolbarAction>
      <span className="absolute -top-1 left-[102px] flex size-3.5 items-center justify-center rounded-full border border-border bg-muted">
        <IconX className="size-3 text-muted-foreground" strokeWidth={1.5} />
      </span>
    </div>
  )
}

function PreviewToolbarAction({
  className,
  children,
}: {
  className: string
  children: React.ReactNode
}) {
  return (
    <span
      data-slot="overlay-preview-toolbar-action"
      className={cn(
        "absolute top-[9px] flex size-[18px] items-center justify-center text-foreground",
        className,
      )}
    >
      {children}
    </span>
  )
}

function ContextMenuScene() {
  return (
    <div
      data-testid="overlay-preview-context-menu"
      className="absolute top-[60px] left-[596px] h-[136px] w-48 overflow-hidden rounded-lg border border-border bg-sidebar shadow-[0_2px_9px_rgb(39_39_42/6%),0_16px_40px_rgb(39_39_42/12%)]"
    >
      <MenuPlaceholder className="top-[15px] w-28" />
      <MenuPlaceholder className="top-[34px] w-28" />
      <MenuDivider className="top-[47px]" />
      <MenuPlaceholder className="top-[61px] w-32" />
      <MenuDivider className="top-[77px]" />

      <div className="absolute top-[81px] left-[3px] flex h-5 w-[184px] items-center rounded bg-accent px-2 text-[10px] text-foreground">
        <BrandMark showName={false} iconClassName="size-3.5 rounded-[2px]" />
        <span className="ml-2 leading-none">{i18n.t("contextMenu.translate")}</span>
      </div>

      <MenuDivider className="top-[105px]" />
      <MenuPlaceholder className="top-[119px] w-20" />
    </div>
  )
}

function MenuPlaceholder({ className }: { className: string }) {
  return (
    <span className={cn("absolute left-[11px] h-1.5 rounded-full bg-foreground/18", className)} />
  )
}

function MenuDivider({ className }: { className: string }) {
  return <span className={cn("absolute left-[3px] h-px w-[184px] bg-border", className)} />
}
