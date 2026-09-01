import type { ReactNode } from "react"
import { Icon } from "@iconify/react"
import { RiTranslate } from "@remixicon/react"
import { IconVolume, IconX } from "@tabler/icons-react"
import { BrandMark } from "@/components/brand-mark"
import { i18n } from "@/utils/i18n"
import { cn } from "@/utils/styles/utils"

type OverlayFeature = "floating-button" | "selection-toolbar" | "context-menu"

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
      role="img"
      aria-label={`${title}: ${description}`}
      className="relative h-44 w-full max-w-2xl overflow-hidden rounded-xl border border-border/80 bg-background shadow-control"
    >
      <BrowserChrome />
      {feature === "floating-button" && <FloatingButtonScene />}
      {feature === "selection-toolbar" && <SelectionToolbarScene />}
      {feature === "context-menu" && <ContextMenuScene />}
    </div>
  )
}

function BrowserChrome() {
  return (
    <div className="flex h-8 items-center gap-1.5 border-b border-border/70 bg-muted/45 px-3">
      <span className="size-2 rounded-full bg-foreground/15" />
      <span className="size-2 rounded-full bg-foreground/10" />
      <span className="size-2 rounded-full bg-foreground/10" />
      <span className="ml-3 h-3.5 w-28 rounded-full bg-foreground/7" />
    </div>
  )
}

function ArticleLines({ selected = false }: { selected?: boolean }) {
  return (
    <div className="space-y-2.5">
      <div className="h-3 w-2/5 rounded-full bg-foreground/14" />
      <div className="space-y-1.5">
        <div className="flex gap-1.5">
          <span className="h-2 w-16 rounded-full bg-foreground/8" />
          <span
            className={cn(
              "h-2 w-24 rounded-full",
              selected ? "bg-foreground/75 ring-2 ring-foreground/10" : "bg-foreground/8",
            )}
          />
          <span className="h-2 w-20 rounded-full bg-foreground/8" />
        </div>
        <div className="h-2 w-11/12 rounded-full bg-foreground/8" />
        <div className="h-2 w-4/5 rounded-full bg-foreground/8" />
      </div>
      <div className="h-14 rounded-lg border border-border/50 bg-muted/35" />
    </div>
  )
}

function FloatingButtonScene() {
  return (
    <div className="relative h-[calc(100%-2rem)] overflow-hidden px-8 py-5 pr-20">
      <ArticleLines />
      <div className="absolute top-1 right-0 flex flex-col items-end gap-2">
        <PreviewFloatingAction icon="tabler:language" />
        <div className="relative">
          <span className="absolute -top-1 -left-6 flex size-6 items-center justify-center text-neutral-300 dark:text-neutral-700">
            <Icon icon="tabler:x" className="size-3" strokeWidth={3} />
          </span>
          <span className="absolute -bottom-1 -left-6 flex size-6 items-center justify-center text-neutral-300 dark:text-neutral-700">
            <Icon icon="tabler:lock-open" className="size-3" strokeWidth={3} />
          </span>
          <span className="flex size-12 items-center justify-center rounded-full border border-black bg-black shadow-lg">
            <BrandMark showName={false} iconClassName="size-10 rounded-full invert" />
          </span>
        </div>
        <PreviewFloatingAction icon="tabler:settings" />
      </div>
    </div>
  )
}

function SelectionToolbarScene() {
  return (
    <div className="relative h-[calc(100%-2rem)] px-8 py-5">
      <ArticleLines selected />
      <div className="group absolute top-9 left-[26%] flex items-center rounded-xl bg-popover p-1 shadow-floating">
        <div className="flex items-center overflow-hidden rounded-xl">
          <PreviewToolbarButton>
            <RiTranslate className="size-4.5" />
          </PreviewToolbarButton>
          <PreviewToolbarButton>
            <IconVolume className="size-4.5" strokeWidth={1.6} />
          </PreviewToolbarButton>
          <PreviewToolbarButton>
            <Icon icon="tabler:book-2" className="size-4.5" strokeWidth={0.8} />
          </PreviewToolbarButton>
        </div>
        <span className="absolute -top-1 -right-1 flex size-3.5 items-center justify-center rounded-full border border-border bg-neutral-100 dark:bg-neutral-900">
          <IconX className="size-3 text-neutral-400 dark:text-neutral-600" />
        </span>
      </div>
    </div>
  )
}

function ContextMenuScene() {
  return (
    <div className="relative h-[calc(100%-2rem)] overflow-hidden px-8 py-5 pr-52">
      <ArticleLines />

      <div className="absolute top-2 right-5 w-48 rounded-lg border border-black/10 bg-[#f7f7f7] p-1 text-[#202124] shadow-[0_8px_24px_rgba(0,0,0,0.22)] dark:border-white/10 dark:bg-[#292a2d] dark:text-[#e8eaed]">
        <NativeContextMenuItem shortcut="Ctrl+C">{i18n.t("action.copy")}</NativeContextMenuItem>
        <NativeContextMenuPlaceholder width="w-28" />
        <div className="my-1 h-px bg-black/10 dark:bg-white/10" />
        <NativeContextMenuPlaceholder width="w-32" />
        <div className="my-1 h-px bg-black/10 dark:bg-white/10" />
        <NativeContextMenuItem active>
          <span className="flex min-w-0 items-center gap-2">
            <BrandMark showName={false} iconClassName="size-3.5 rounded-[2px]" />
            <span className="truncate">{i18n.t("contextMenu.translate")}</span>
          </span>
        </NativeContextMenuItem>
        <div className="my-1 h-px bg-black/10 dark:bg-white/10" />
        <NativeContextMenuPlaceholder width="w-20" />
      </div>
    </div>
  )
}

function PreviewFloatingAction({ icon }: { icon: string }) {
  return (
    <span className="mr-2 flex size-[34px] items-center justify-center rounded-full border border-border bg-white text-neutral-600 shadow-lg dark:bg-neutral-900 dark:text-neutral-400">
      <Icon icon={icon} className="size-5" />
    </span>
  )
}

function PreviewToolbarButton({ children }: { children: ReactNode }) {
  return (
    <span className="flex h-7 shrink-0 items-center justify-center px-2 text-foreground">
      {children}
    </span>
  )
}

function NativeContextMenuItem({
  children,
  shortcut,
  active = false,
}: {
  children: ReactNode
  shortcut?: string
  active?: boolean
}) {
  return (
    <div
      className={cn(
        "flex h-5 items-center gap-2 rounded-[4px] px-2 text-[10px] leading-none",
        active && "bg-[#e8eaed] dark:bg-[#3c4043]",
      )}
    >
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {shortcut && (
        <span className="shrink-0 pl-3 text-black/55 dark:text-white/55">{shortcut}</span>
      )}
    </div>
  )
}

function NativeContextMenuPlaceholder({ width }: { width: string }) {
  return (
    <div className="flex h-5 items-center px-2">
      <span className={cn("h-1.5 rounded-full bg-black/18 dark:bg-white/18", width)} />
    </div>
  )
}
