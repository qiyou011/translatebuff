import arrowDark from "@/assets/images/panel-v170/arrow-dark-icon.svg"
import arrow from "@/assets/images/panel-v170/arrow-icon.svg"
import brandDark from "@/assets/images/panel-v170/brand-dark-icon.svg"
import brand from "@/assets/images/panel-v170/brand-icon.svg"
import chevronDark from "@/assets/images/panel-v170/chevron-dark-icon.svg"
import chevron from "@/assets/images/panel-v170/chevron-icon.svg"
import comicDark from "@/assets/images/panel-v170/comic-image-dark-icon.svg"
import comic from "@/assets/images/panel-v170/comic-image-muted.svg"
import hubDark from "@/assets/images/panel-v170/hub-dark-icon.svg"
import hub from "@/assets/images/panel-v170/hub-icon.svg"
import infoDark from "@/assets/images/panel-v170/info-dark-icon.svg"
import info from "@/assets/images/panel-v170/info-icon.svg"
import inputDark from "@/assets/images/panel-v170/input-dark-icon.svg"
import input from "@/assets/images/panel-v170/input-icon.svg"
import close from "@/assets/images/panel-v170/popover-close.svg"
import selectionDark from "@/assets/images/panel-v170/selection-dark-icon.svg"
import selection from "@/assets/images/panel-v170/selection-icon.svg"
import paused from "@/assets/images/panel-v170/site-paused-icon.svg"
import slidersDark from "@/assets/images/panel-v170/sliders-dark-icon.svg"
import sliders from "@/assets/images/panel-v170/sliders-icon.svg"
import videoDark from "@/assets/images/panel-v170/video-dark-icon.svg"
import video from "@/assets/images/panel-v170/video-icon.svg"
import "./panel-icon.css"

const icons = {
  arrow,
  brand,
  chevron,
  close,
  comic,
  hub,
  info,
  input,
  selection,
  paused,
  sliders,
  video,
}

const darkIcons: Partial<Record<keyof typeof icons, string>> = {
  arrow: arrowDark,
  brand: brandDark,
  chevron: chevronDark,
  comic: comicDark,
  hub: hubDark,
  info: infoDark,
  input: inputDark,
  selection: selectionDark,
  sliders: slidersDark,
  video: videoDark,
}

export function PanelIcon({ name, size = 24 }: { name: keyof typeof icons; size?: number }) {
  return (
    <span className="tb-panel-icon" style={{ width: size, height: size }} aria-hidden="true">
      <img
        src={icons[name]}
        width={size}
        height={size}
        className={darkIcons[name] ? "tb-icon-light" : undefined}
        alt=""
      />
      {darkIcons[name] && (
        <img src={darkIcons[name]} width={size} height={size} className="tb-icon-dark" alt="" />
      )}
    </span>
  )
}
