import type { ReactNode } from "react"
import { Icon } from "@iconify/react"
import { BrandMark } from "@/fork/components/brand-mark"
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
      data-fork-overlay-preview
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
    <div className="relative h-[calc(100%-2rem)] overflow-hidden px-8 py-5 pr-16">
      <ArticleLines />
      <div className="absolute top-12 right-0 flex items-center">
        <div className="mr-1.5 flex flex-col gap-1.5">
          <PreviewIcon icon="tabler:language" />
          <PreviewIcon icon="tabler:settings" muted />
        </div>
        <div className="flex h-11 w-12 items-center rounded-l-full border border-r-0 border-border bg-card pl-1.5 shadow-lg">
          <BrandMark showName={false} iconClassName="size-8 rounded-full" />
        </div>
      </div>
    </div>
  )
}

function SelectionToolbarScene() {
  return (
    <div className="relative h-[calc(100%-2rem)] px-8 py-5">
      <ArticleLines selected />
      <div className="absolute top-9 left-[26%] flex items-center gap-0.5 rounded-xl border border-border/60 bg-popover p-1 shadow-floating">
        <PreviewToolbarButton icon="tabler:language" active />
        <PreviewToolbarButton icon="tabler:volume" />
        <PreviewToolbarButton icon="tabler:sparkles" />
        <span className="mx-0.5 h-5 w-px bg-border" />
        <PreviewToolbarButton icon="tabler:x" compact />
      </div>
      <div className="absolute top-[4.7rem] left-[43%] size-2 rotate-45 border-r border-b border-border/50 bg-popover" />
    </div>
  )
}

function ContextMenuScene() {
  return (
    <div className="relative h-[calc(100%-2rem)] px-8 py-5 pr-52">
      <ArticleLines selected />
      <div className="absolute top-3 right-5 w-44 overflow-hidden rounded-lg border border-border/80 bg-popover p-1 shadow-floating">
        <ContextMenuItem icon="tabler:language">
          {i18n.t("contextMenu.translateSelection")}
        </ContextMenuItem>
        <ContextMenuItem icon="tabler:volume">
          {i18n.t("contextMenu.readAloudSelection")}
        </ContextMenuItem>
        <div className="my-1 h-px bg-border/70" />
        <ContextMenuItem icon="tabler:world">{i18n.t("contextMenu.translate")}</ContextMenuItem>
      </div>
    </div>
  )
}

function PreviewIcon({ icon, muted = false }: { icon: string; muted?: boolean }) {
  return (
    <span
      className={cn(
        "flex size-7 items-center justify-center rounded-full border bg-card shadow-sm",
        muted && "opacity-65",
      )}
    >
      <Icon icon={icon} className="size-3.5" />
    </span>
  )
}

function PreviewToolbarButton({
  icon,
  active = false,
  compact = false,
}: {
  icon: string
  active?: boolean
  compact?: boolean
}) {
  return (
    <span
      className={cn(
        "flex items-center justify-center rounded-lg",
        compact ? "size-6" : "size-8",
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground",
      )}
    >
      <Icon icon={icon} className={compact ? "size-3.5" : "size-4"} />
    </span>
  )
}

function ContextMenuItem({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <div className="flex h-7 items-center gap-2 rounded-md px-2 text-[11px] text-foreground first:bg-accent">
      <Icon icon={icon} className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="truncate">{children}</span>
    </div>
  )
}
