const video = document.querySelector("video")
const player = document.querySelector("#movie_player")
const videoId = new URL(location.href).searchParams.get("v")
const track = {
  baseUrl: `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&kind=asr`,
  languageCode: "en",
  kind: "asr",
  vssId: "a.en",
  name: { simpleText: "English (auto-generated, controlled fixture)" },
}

window.__youtubeFixture = {
  fixture: true,
  playerCalls: [],
  playerEvents: [],
  mediaEvents: [],
  pointerEvents: [],
  bridgeMessages: [],
  samples: [],
}
const recordCall = (method) =>
  window.__youtubeFixture.playerCalls.push({ method, at: performance.now() })
player.getPlayerResponse = () => {
  recordCall("getPlayerResponse")
  return {
    videoDetails: { videoId, title: document.title, isLiveContent: false },
    captions: {
      playerCaptionsTracklistRenderer: {
        captionTracks: [track],
        audioTracks: [{ captionTrackIndices: [0], defaultCaptionTrackIndex: 0 }],
        defaultAudioTrackIndex: 0,
      },
    },
  }
}
player.getOption = (module, name) => {
  recordCall(`getOption:${module}:${name}`)
  return module === "captions" && name === "track" ? track : null
}
player.getPlayerState = () => (video.paused ? 2 : 1)
player.getWebPlayerContextConfig = () => ({ innertubeContextClientVersion: "controlled-fixture" })
player.getAudioTrack = () => ({
  captionTracks: [{ url: track.baseUrl, vssId: track.vssId, kind: track.kind }],
})
player.toggleSubtitles = () => {
  recordCall("toggleSubtitles")
  document.querySelector(".ytp-subtitles-button").setAttribute("aria-pressed", "true")
}
window.ytcfg = { get: () => null }
for (const type of ["click", "pointerdown", "keydown"]) {
  player.addEventListener(type, (event) => {
    window.__youtubeFixture.playerEvents.push({
      type,
      trusted: event.isTrusted,
      key: event.key,
      at: performance.now(),
      target: event.target.id || event.target.tagName,
    })
  })
}
for (const type of [
  "loadedmetadata",
  "canplay",
  "playing",
  "pause",
  "timeupdate",
  "seeking",
  "seeked",
  "error",
]) {
  video.addEventListener(type, () => {
    window.__youtubeFixture.mediaEvents.push({
      type,
      time: video.currentTime,
      at: performance.now(),
      error: video.error?.message,
    })
  })
}
window.addEventListener("message", (event) => {
  if (event.source !== window || !String(event.data?.type).startsWith("READ_FROG_")) return
  window.__youtubeFixture.bridgeMessages.push({
    type: event.data.type,
    success: event.data.success,
    videoId: event.data.data?.videoId,
    tracks: event.data.data?.captionTracks?.map((entry) => ({
      kind: entry.kind,
      languageCode: entry.languageCode,
      vssId: entry.vssId,
    })),
    at: performance.now(),
  })
})
document.querySelector("#fixture-play").addEventListener("click", () => void video.play())
document.querySelector("#fixture-pause").addEventListener("click", () => video.pause())
window.__youtubeFixture.beginSamples = () => {
  window.__youtubeFixture.samples = []
  window.__youtubeFixture.sampleTimer = setInterval(() => {
    const shadow = document.querySelector("#read-frog-subtitles-ui-host")?.shadowRoot
    const original = shadow?.querySelector(".subtitles-main")
    const translation = shadow?.querySelector(".subtitles-translation")
    const visible = (element) =>
      !!element &&
      element.getBoundingClientRect().height > 0 &&
      getComputedStyle(element).visibility === "visible"
    window.__youtubeFixture.samples.push({
      time: video.currentTime,
      at: performance.now(),
      paused: video.paused,
      original: visible(original) ? original.textContent : "",
      translation: visible(translation) ? translation.textContent : "",
    })
  }, 80)
}
window.__youtubeFixture.endSamples = () => clearInterval(window.__youtubeFixture.sampleTimer)
window.__youtubeFixture.observeHandle = () => {
  const handle = document
    .querySelector("#read-frog-subtitles-ui-host")
    .shadowRoot.querySelector(".cursor-grab")
  for (const type of [
    "pointerdown",
    "pointermove",
    "pointerup",
    "gotpointercapture",
    "lostpointercapture",
  ]) {
    handle.addEventListener(type, (event) => {
      window.__youtubeFixture.pointerEvents.push({
        type,
        trusted: event.isTrusted,
        pointerId: event.pointerId,
        captured: handle.hasPointerCapture(event.pointerId),
        clientY: event.clientY,
        at: performance.now(),
      })
      if (type === "pointerdown") window.__youtubeFixture.lastPointerId = event.pointerId
    })
  }
}
window.__youtubeFixture.ready = true
