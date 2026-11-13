import type { AnimationItem } from "lottie-web"
import type { ReactNode } from "react"
import { useReducedMotion } from "motion/react"
import { useEffect, useRef, useState } from "react"

const images = import.meta.glob<string>("../../assets/lottie/video-frames/*.png", {
  eager: true,
  import: "default",
  query: "?url",
})

export function LottieTutorial({
  src,
  label,
  fallback,
  viewBox,
  aspectRatio,
  stillFrame,
}: {
  src: string
  label: string
  fallback: ReactNode
  viewBox: string
  aspectRatio: string
  stillFrame: number
}) {
  const container = useRef<HTMLDivElement>(null)
  const reducedMotion = useReducedMotion()
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const target = container.current
    if (!target) return undefined
    const controller = new AbortController()
    let animation: AnimationItem | undefined
    const updatePlayback = () => {
      if (reducedMotion || document.hidden) animation?.pause()
      else animation?.play()
    }
    setFailed(false)
    void Promise.all([
      import("lottie-web/build/player/lottie_light"),
      fetch(src, { signal: controller.signal }).then((response) => {
        if (!response.ok) throw new Error(`Lottie request failed: ${response.status}`)
        return response.json()
      }),
    ])
      .then(([{ default: lottie }, animationData]) => {
        if (controller.signal.aborted) return
        for (const asset of animationData.assets ?? []) {
          if (asset.p && !asset.p.startsWith("data:")) {
            const image = images[`../../assets/lottie/video-frames/${asset.p}`]
            if (!image) throw new Error("Lottie image asset is unavailable")
            asset.p = image
            asset.u = ""
            asset.e = 0
          }
        }
        animation = lottie.loadAnimation({
          container: target,
          renderer: "svg",
          animationData,
          autoplay: !reducedMotion && !document.hidden,
          loop: true,
          rendererSettings: {
            viewBoxSize: viewBox,
            preserveAspectRatio: "xMidYMid meet",
          },
        })
        animation.addEventListener("DOMLoaded", () => {
          if (reducedMotion) animation?.goToAndStop(stillFrame, true)
          else updatePlayback()
        })
        animation.addEventListener("data_failed", () => setFailed(true))
        animation.addEventListener("error", () => setFailed(true))
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true)
      })
    document.addEventListener("visibilitychange", updatePlayback)
    return () => {
      controller.abort()
      document.removeEventListener("visibilitychange", updatePlayback)
      animation?.destroy()
    }
  }, [src, viewBox, stillFrame, reducedMotion])

  return (
    <>
      <div
        ref={container}
        className="tb-lottie-tutorial"
        style={{ aspectRatio }}
        role="img"
        aria-label={label}
        hidden={failed}
      />
      {failed && fallback}
    </>
  )
}
