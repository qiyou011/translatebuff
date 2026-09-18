import type { FloatingButtonSide } from "@/types/config/floating-button"
import { useAtom, useAtomValue } from "jotai"
import { useEffect, useRef, useState } from "react"
import { browser } from "#imports"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/base-ui/dropdown-menu"
import { anchoredToastManager } from "@/components/ui/base-ui/toast"
import { enablePageTranslationAtom, isDraggingButtonAtom } from "@/entrypoints/side.content/atoms"
import TranslateButton from "@/entrypoints/side.content/components/floating-button/translate-button"
import { shadowWrapper } from "@/entrypoints/side.content/index"
import { useIsFullscreen } from "@/hooks/use-is-fullscreen"
import { ANALYTICS_FEATURE, ANALYTICS_SURFACE } from "@/types/analytics"
import { createFeatureUsageContext } from "@/utils/analytics"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { APP_NAME } from "@/utils/constants/app"
import { i18n } from "@/utils/i18n"
import { sendMessage } from "@/utils/message"
import { cn } from "@/utils/styles/utils"
import { matchDomainPattern } from "@/utils/url"
import HiddenButton from "./hidden-button"
import closeIcon from "./images/close-icon.svg?url&no-inline"
import floatingLogo from "./images/floating-logo.svg?url&no-inline"
import lockedIcon from "./images/locked-icon.svg?url&no-inline"
import settingsIcon from "./images/settings-icon.svg?url&no-inline"
import translateIcon from "./images/translate-icon.svg?url&no-inline"
import unlockedIcon from "./images/unlocked-icon.svg?url&no-inline"

const floatingLogoUrl = new URL(floatingLogo, browser.runtime.getURL("/")).href
const closeIconUrl = new URL(closeIcon, browser.runtime.getURL("/")).href
const lockedIconUrl = new URL(lockedIcon, browser.runtime.getURL("/")).href
const unlockedIconUrl = new URL(unlockedIcon, browser.runtime.getURL("/")).href
const settingsIconUrl = new URL(settingsIcon, browser.runtime.getURL("/")).href
const translateIconUrl = new URL(translateIcon, browser.runtime.getURL("/")).href
const LONG_PRESS_DELAY_MS = 350
const DRAG_START_DISTANCE_PX = 6
const MIN_FLOATING_CONTAINER_TOP_PX = 30
const FLOATING_CONTAINER_BOTTOM_CLEARANCE_PX = 200
const FIREFOX_SIDEBAR_USER_ACTION_TOAST_ID = "firefox-sidebar-user-action"

interface DragPoint {
  x: number
  y: number
}

interface PendingDragState {
  pointerId: number
  startClientX: number
  startClientY: number
  currentClientX: number
  currentClientY: number
  pointerOffsetX: number
  pointerOffsetY: number
  mainOffsetY: number
  buttonWidth: number
  buttonHeight: number
  hasActiveDrag: boolean
  longPressTimerId: number
}

const floatingButtonControlClassName = cn(
  "pointer-events-none invisible absolute flex size-8 cursor-pointer items-center justify-center",
  "text-neutral-300 transition-[color,left,right,transform] duration-300 hover:scale-110 hover:text-neutral-500 active:scale-90 active:text-neutral-500",
  "dark:text-neutral-700 dark:hover:text-neutral-500 dark:active:text-neutral-500",
)
const floatingButtonControlOffsetClassNames = {
  right: {
    collapsed: "left-0",
    expanded: "-left-[37px]",
  },
  left: {
    collapsed: "right-0",
    expanded: "-right-[37px]",
  },
} satisfies Record<FloatingButtonSide, { collapsed: string; expanded: string }>

function FirefoxSidebarHelpToast() {
  return (
    <span>
      {i18n.t("sidePanel.firefoxUserActionHint")}{" "}
      <a
        href={i18n.t("sidePanel.firefoxUserActionHelpUrl")}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline underline-offset-2"
      >
        {i18n.t("sidePanel.firefoxUserActionHelpText")}
      </a>
    </span>
  )
}

function getFloatingButtonSide(side: string | undefined): FloatingButtonSide {
  return side === "left" ? "left" : "right"
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function getPointerDistance(startX: number, startY: number, currentX: number, currentY: number) {
  return Math.hypot(currentX - startX, currentY - startY)
}

function getDragPreviewPosition(pendingDrag: PendingDragState): DragPoint {
  return {
    x: clamp(
      pendingDrag.currentClientX - pendingDrag.pointerOffsetX,
      0,
      Math.max(0, window.innerWidth - pendingDrag.buttonWidth),
    ),
    y: clamp(
      pendingDrag.currentClientY - pendingDrag.pointerOffsetY,
      0,
      Math.max(0, window.innerHeight - pendingDrag.buttonHeight),
    ),
  }
}

function getNormalizedFloatingContainerTop(mainButtonTop: number, mainOffsetY: number) {
  const viewportHeight = Math.max(1, window.innerHeight)
  const maxTop = Math.max(
    MIN_FLOATING_CONTAINER_TOP_PX,
    viewportHeight - FLOATING_CONTAINER_BOTTOM_CLEARANCE_PX,
  )
  const containerTop = clamp(mainButtonTop - mainOffsetY, MIN_FLOATING_CONTAINER_TOP_PX, maxTop)
  return containerTop / viewportHeight
}

export default function FloatingButton() {
  const [floatingButton, setFloatingButton] = useAtom(configFieldsAtomMap.floatingButton)
  const translationState = useAtomValue(enablePageTranslationAtom)
  const [isDraggingButton, setIsDraggingButton] = useAtom(isDraggingButtonAtom)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isHitAreaExpanded, setIsHitAreaExpanded] = useState(false)
  const [dragPreviewPosition, setDragPreviewPosition] = useState<DragPoint | null>(null)
  const isFullscreen = useIsFullscreen()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mainButtonRef = useRef<HTMLButtonElement | null>(null)
  const pendingDragRef = useRef<PendingDragState | null>(null)
  const lastDragPreviewRef = useRef<DragPoint | null>(null)
  const floatingButtonSide = getFloatingButtonSide(floatingButton.side)
  const isFloatingButtonExpanded = isHitAreaExpanded || isDropdownOpen

  useEffect(() => {
    if (!isDraggingButton) return undefined

    const previousUserSelect = document.body.style.userSelect
    const previousCursor = document.body.style.cursor
    document.body.style.userSelect = "none"
    document.body.style.cursor = "grabbing"

    return () => {
      document.body.style.userSelect = previousUserSelect
      document.body.style.cursor = previousCursor
    }
  }, [isDraggingButton])

  useEffect(() => {
    return () => {
      const pendingDrag = pendingDragRef.current
      if (pendingDrag) {
        window.clearTimeout(pendingDrag.longPressTimerId)
      }
    }
  }, [])

  // Going fullscreen removes the button from the DOM, so an in-flight drag can
  // never receive its pointerup: cancel it here, or the body keeps the grabbing
  // cursor and the text-selection lock after fullscreen exits.
  useEffect(() => {
    if (!isFullscreen) return

    const pendingDrag = pendingDragRef.current
    if (pendingDrag) {
      window.clearTimeout(pendingDrag.longPressTimerId)
      pendingDragRef.current = null
    }
    lastDragPreviewRef.current = null
    setDragPreviewPosition(null)
    setIsDraggingButton(false)
    setIsHitAreaExpanded(false)
    setIsDropdownOpen(false)
  }, [isFullscreen, setIsDraggingButton])

  const handleFloatingButtonClick = () => {
    if (floatingButton.clickAction === "translate") {
      const nextEnabled = !translationState.enabled
      void sendMessage("tryToSetEnablePageTranslationOnContentScript", {
        enabled: nextEnabled,
        analyticsContext: nextEnabled
          ? createFeatureUsageContext(
              ANALYTICS_FEATURE.PAGE_TRANSLATION,
              ANALYTICS_SURFACE.FLOATING_BUTTON,
            )
          : undefined,
      })
      return
    }

    void Promise.resolve(sendMessage("toggleSidePanel", undefined)).then((result) => {
      if (result && !result.ok && result.reason === "requires-extension-user-action") {
        if (!mainButtonRef.current) return

        anchoredToastManager.add({
          id: FIREFOX_SIDEBAR_USER_ACTION_TOAST_ID,
          positionerProps: {
            anchor: mainButtonRef.current,
            side: floatingButtonSide === "right" ? "left" : "right",
            sideOffset: 8,
          },
          type: "info",
          title: <FirefoxSidebarHelpToast />,
        })
      }
    })
  }

  const startActiveDrag = () => {
    const pendingDrag = pendingDragRef.current
    if (!pendingDrag || pendingDrag.hasActiveDrag) return

    pendingDrag.hasActiveDrag = true
    const nextPreviewPosition = getDragPreviewPosition(pendingDrag)
    lastDragPreviewRef.current = nextPreviewPosition
    setDragPreviewPosition(nextPreviewPosition)
    setIsHitAreaExpanded(false)
    setIsDropdownOpen(false)
    setIsDraggingButton(true)
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return

    const mainButton = mainButtonRef.current ?? e.currentTarget
    const mainButtonRect = mainButton.getBoundingClientRect()
    const containerRect = containerRef.current?.getBoundingClientRect()
    const mainOffsetY = containerRect ? mainButtonRect.top - containerRect.top : 0

    e.preventDefault()
    if (typeof e.currentTarget.setPointerCapture === "function") {
      e.currentTarget.setPointerCapture(e.pointerId)
    }

    pendingDragRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      currentClientX: e.clientX,
      currentClientY: e.clientY,
      pointerOffsetX: e.clientX - mainButtonRect.left,
      pointerOffsetY: e.clientY - mainButtonRect.top,
      mainOffsetY,
      buttonWidth: mainButtonRect.width || 40,
      buttonHeight: mainButtonRect.height || 40,
      hasActiveDrag: false,
      longPressTimerId: window.setTimeout(startActiveDrag, LONG_PRESS_DELAY_MS),
    }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const pendingDrag = pendingDragRef.current
    if (!pendingDrag || pendingDrag.pointerId !== e.pointerId) return

    pendingDrag.currentClientX = e.clientX
    pendingDrag.currentClientY = e.clientY

    if (!pendingDrag.hasActiveDrag) {
      const pointerDistance = getPointerDistance(
        pendingDrag.startClientX,
        pendingDrag.startClientY,
        e.clientX,
        e.clientY,
      )
      if (pointerDistance > DRAG_START_DISTANCE_PX) {
        startActiveDrag()
      }
    }

    if (pendingDrag.hasActiveDrag) {
      const nextPreviewPosition = getDragPreviewPosition(pendingDrag)
      lastDragPreviewRef.current = nextPreviewPosition
      setDragPreviewPosition(nextPreviewPosition)
    }
  }

  const finishPointerInteraction = (
    e: React.PointerEvent<HTMLButtonElement>,
    shouldTriggerClick: boolean,
  ) => {
    const pendingDrag = pendingDragRef.current
    if (!pendingDrag || pendingDrag.pointerId !== e.pointerId) return

    window.clearTimeout(pendingDrag.longPressTimerId)
    pendingDragRef.current = null

    if (typeof e.currentTarget.releasePointerCapture === "function") {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }

    if (pendingDrag.hasActiveDrag) {
      const finalPreviewPosition = lastDragPreviewRef.current ?? getDragPreviewPosition(pendingDrag)
      const finalCenterX = finalPreviewPosition.x + pendingDrag.buttonWidth / 2
      const nextSide: FloatingButtonSide = finalCenterX < window.innerWidth / 2 ? "left" : "right"
      const nextPosition = getNormalizedFloatingContainerTop(
        finalPreviewPosition.y,
        pendingDrag.mainOffsetY,
      )

      lastDragPreviewRef.current = null
      setDragPreviewPosition(null)
      void setFloatingButton({ position: nextPosition, side: nextSide })
      setIsDraggingButton(false)
      return
    }

    lastDragPreviewRef.current = null
    setDragPreviewPosition(null)
    setIsDraggingButton(false)

    if (shouldTriggerClick) {
      handleFloatingButtonClick()
    }
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLButtonElement>) => {
    finishPointerInteraction(e, true)
  }

  const handlePointerCancel = (e: React.PointerEvent<HTMLButtonElement>) => {
    finishPointerInteraction(e, false)
  }

  const handleMouseEnter = () => {
    if (!isDraggingButton) {
      setIsHitAreaExpanded(true)
    }
  }

  const handleMouseLeave = () => {
    if (!isDropdownOpen && !isDraggingButton) {
      setIsHitAreaExpanded(false)
    }
  }

  if (
    isFullscreen ||
    !floatingButton.enabled ||
    floatingButton.disabledFloatingButtonPatterns.some((pattern) =>
      matchDomainPattern(window.location.href, pattern),
    )
  ) {
    return null
  }

  const containerStyle: React.CSSProperties =
    isDraggingButton && dragPreviewPosition
      ? {
          left: `${dragPreviewPosition.x}px`,
          right: "auto",
          top: `${dragPreviewPosition.y}px`,
        }
      : {
          left: floatingButtonSide === "left" ? "0px" : undefined,
          right:
            floatingButtonSide === "right" ? "var(--removed-body-scroll-bar-size, 0px)" : undefined,
          top: `${floatingButton.position * 100}vh`,
        }

  return (
    <div
      ref={containerRef}
      data-testid="floating-button-container"
      className={cn(
        "fixed z-2147483647 flex flex-col gap-2 print:hidden",
        isFloatingButtonExpanded ? "pointer-events-auto" : "pointer-events-none",
        isDraggingButton
          ? "items-center"
          : floatingButtonSide === "right"
            ? "items-end"
            : "items-start",
        !isDraggingButton &&
          isFloatingButtonExpanded &&
          (floatingButtonSide === "right" ? "pl-[37px]" : "pr-[37px]"),
      )}
      style={containerStyle}
      onMouseLeave={handleMouseLeave}
    >
      {!isDraggingButton && (
        <TranslateButton
          side={floatingButtonSide}
          expanded={isFloatingButtonExpanded}
          icon={
            <img
              src={translateIconUrl}
              alt=""
              aria-hidden="true"
              width={14}
              height={14}
              className="size-3.5"
            />
          }
        />
      )}
      <div
        className={cn(
          "relative",
          !isDraggingButton && (floatingButtonSide === "right" ? "mr-[3px]" : "ml-[3px]"),
        )}
      >
        <button
          type="button"
          aria-label={APP_NAME}
          ref={mainButtonRef}
          data-testid="floating-main-button"
          className={cn(
            "pointer-events-auto relative flex size-10 items-center justify-center rounded-full transition-[transform,opacity,box-shadow] duration-300 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            isDraggingButton ? "cursor-grabbing touch-none opacity-100" : "cursor-pointer",
            !isDraggingButton && "translate-x-0 opacity-100",
          )}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          onMouseEnter={handleMouseEnter}
          onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return
            event.preventDefault()
            handleFloatingButtonClick()
          }}
        >
          <img
            src={floatingLogoUrl}
            alt=""
            aria-hidden="true"
            width={55}
            height={64}
            className="pointer-events-none absolute -top-[2px] -left-[12px] h-16 w-[55px] max-w-none"
          />
        </button>

        {!isDraggingButton && (
          <>
            <FloatingButtonCloseMenu
              expanded={isFloatingButtonExpanded}
              side={floatingButtonSide}
              onDropdownOpenChange={setIsDropdownOpen}
            />
            <FloatingButtonLockControl
              expanded={isFloatingButtonExpanded}
              side={floatingButtonSide}
            />
          </>
        )}
      </div>
      {!isDraggingButton && (
        <HiddenButton
          side={floatingButtonSide}
          expanded={isFloatingButtonExpanded}
          icon={
            <img
              src={settingsIconUrl}
              alt=""
              aria-hidden="true"
              width={14}
              height={14}
              className="size-3.5"
            />
          }
          label={i18n.t("options.floatingButton.tooltips.settings")}
          onClick={() => {
            void sendMessage("openOptionsPage", undefined)
          }}
        />
      )}
    </div>
  )
}

interface FloatingButtonCloseMenuProps {
  expanded: boolean
  side: FloatingButtonSide
  onDropdownOpenChange: (open: boolean) => void
}

function FloatingButtonCloseMenu({
  expanded,
  side,
  onDropdownOpenChange,
}: FloatingButtonCloseMenuProps) {
  const [floatingButton, setFloatingButton] = useAtom(configFieldsAtomMap.floatingButton)
  const [open, setOpen] = useState(false)
  const controlOffsetClassName =
    !floatingButton.locked && !expanded
      ? floatingButtonControlOffsetClassNames[side].collapsed
      : floatingButtonControlOffsetClassNames[side].expanded

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    onDropdownOpenChange(nextOpen)
  }

  const handleDisableForSite = () => {
    const currentDomain = window.location.hostname
    const currentPatterns = floatingButton.disabledFloatingButtonPatterns || []

    void setFloatingButton({
      ...floatingButton,
      disabledFloatingButtonPatterns: [...currentPatterns, currentDomain],
    })
  }

  const handleDisableGlobally = () => {
    void setFloatingButton({ ...floatingButton, enabled: false })
  }

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label={i18n.t("options.floatingButton.tooltips.floatingButtonOptions")}
            className={cn(
              floatingButtonControlClassName,
              "-top-3",
              controlOffsetClassName,
              expanded && "pointer-events-auto visible",
              open && "pointer-events-auto visible",
            )}
          />
        }
      >
        <img
          src={closeIconUrl}
          alt=""
          aria-hidden="true"
          width={16}
          height={16}
          className="size-4"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        container={shadowWrapper}
        align="start"
        side={side === "right" ? "left" : "right"}
        className="z-2147483647 w-fit! whitespace-nowrap"
      >
        <DropdownMenuItem onMouseDown={(e) => e.stopPropagation()} onClick={handleDisableForSite}>
          {i18n.t("options.floatingButton.closeMenu.disableForSite")}
        </DropdownMenuItem>
        <DropdownMenuItem onMouseDown={(e) => e.stopPropagation()} onClick={handleDisableGlobally}>
          {i18n.t("options.floatingButton.closeMenu.disableGlobally")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

interface FloatingButtonLockControlProps {
  expanded: boolean
  side: FloatingButtonSide
}

function FloatingButtonLockControl({ expanded, side }: FloatingButtonLockControlProps) {
  const [floatingButton, setFloatingButton] = useAtom(configFieldsAtomMap.floatingButton)
  const locked = floatingButton.locked
  const controlOffsetClassName =
    !locked && !expanded
      ? floatingButtonControlOffsetClassNames[side].collapsed
      : floatingButtonControlOffsetClassNames[side].expanded

  const handleToggleLocked = () => {
    void setFloatingButton({ ...floatingButton, locked: !locked })
  }
  const label = locked
    ? i18n.t("options.floatingButton.tooltips.unlockPosition")
    : i18n.t("options.floatingButton.tooltips.lockPosition")

  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        floatingButtonControlClassName,
        "-bottom-3",
        controlOffsetClassName,
        expanded && "pointer-events-auto visible",
      )}
      onClick={handleToggleLocked}
    >
      <img
        src={locked ? lockedIconUrl : unlockedIconUrl}
        alt=""
        aria-hidden="true"
        width={16}
        height={16}
        className="size-4"
      />
    </button>
  )
}
