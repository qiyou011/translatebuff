import { Icon } from "@iconify/react"
import { useCallback, useRef, useState } from "react"
import { getWebsiteUrl } from "@/fork/website-url"
import { i18n } from "@/utils/i18n"
import { cn } from "@/utils/styles/utils"

type Corner = "bottom-right" | "top-right"

const STORAGE_KEY = "help-button-corner"
const OFFSET = 16
const DRAG_THRESHOLD = 5

const cornerStyles: Record<Corner, React.CSSProperties> = {
  "bottom-right": { bottom: OFFSET, right: OFFSET, top: "auto", left: "auto" },
  "top-right": { top: OFFSET, right: OFFSET, bottom: "auto", left: "auto" },
}

function getStoredCorner(): Corner {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && stored in cornerStyles) return stored as Corner
  } catch {}
  return "bottom-right"
}

function getNearestCorner(_x: number, y: number): Corner {
  const cy = window.innerHeight / 2
  return y >= cy ? "bottom-right" : "top-right"
}

export function HelpButton() {
  const [corner, setCorner] = useState<Corner>(getStoredCorner)
  const [dragging, setDragging] = useState(false)
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null)
  const hasDraggedRef = useRef(false)
  const suppressClickRef = useRef(false)

  const openSupport = useCallback(() => {
    window.open(getWebsiteUrl(), "_blank", "noopener,noreferrer")
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startY = e.clientY
    hasDraggedRef.current = false

    function onMouseMove(ev: MouseEvent) {
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY

      if (!hasDraggedRef.current && Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD) return

      hasDraggedRef.current = true
      setDragging(true)
      setDragPos({ x: ev.clientX - 20, y: ev.clientY - 20 })
    }

    function onMouseUp(ev: MouseEvent) {
      document.removeEventListener("mousemove", onMouseMove)
      document.removeEventListener("mouseup", onMouseUp)

      if (hasDraggedRef.current) {
        suppressClickRef.current = true
        const newCorner = getNearestCorner(ev.clientX, ev.clientY)
        setCorner(newCorner)
        localStorage.setItem(STORAGE_KEY, newCorner)
      }
      hasDraggedRef.current = false
      setDragging(false)
      setDragPos(null)
    }

    document.addEventListener("mousemove", onMouseMove)
    document.addEventListener("mouseup", onMouseUp)
  }, [])

  const style: React.CSSProperties =
    dragging && dragPos
      ? {
          position: "fixed",
          left: dragPos.x,
          top: dragPos.y,
          right: "auto",
          bottom: "auto",
          transition: "none",
        }
      : {
          position: "fixed",
          ...cornerStyles[corner],
          transition: "top 300ms ease, right 300ms ease, bottom 300ms ease, left 300ms ease",
        }

  return (
    <button
      type="button"
      onMouseDown={handleMouseDown}
      onClick={() => {
        if (suppressClickRef.current) {
          suppressClickRef.current = false
          return
        }
        openSupport()
      }}
      aria-label={i18n.t("popup.more.tutorial")}
      className={cn(
        "z-50 flex size-10 cursor-grab items-center justify-center rounded-full",
        "bg-muted-foreground/20 text-muted-foreground shadow-md",
        "opacity-60 transition-[color,background-color,opacity,box-shadow] duration-200 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        dragging && "cursor-grabbing opacity-100",
      )}
      style={style}
    >
      <Icon icon="tabler:message-2" className="size-5" aria-hidden="true" />
    </button>
  )
}
