import { createSignal, onMount } from "solid-js"
import { LogicalSize, PhysicalPosition, appWindow, currentMonitor } from "@tauri-apps/api/window"
import { Controls } from "./Components/Controls"
import fallbackCover from "./assets/fallback-cover.svg?url"
import "./App.sass"

import { initializeTokenManager } from "./TokenManager"
import { PlaybackState } from "./SpotifyController"
import * as SpotifyController from "./SpotifyController"


const WINDOW_HEIGHT = 90
const MAX_WINDOW_WIDTH = 350
const MIN_CONTENT_WIDTH = 140
const CONTENT_EXTRA_WIDTH = 30

function App() {
  const [playbackState, setPlaybackSate] = createSignal<PlaybackState | null>(null)
  const [uiPlaying, setUiPlaying] = createSignal<boolean | null>(null)

  const [widthCalculated, setWidthCalculated] = createSignal(false)
  let titleRef: HTMLElement | undefined
  let subtitleRef: HTMLElement | undefined

  const calculateWindowWidth = async () => {
    const oldWindowSize = await appWindow.innerSize()

    setWidthCalculated(false)

    const titleWidth = titleRef?.offsetWidth || 200
    const subtitleWidth = subtitleRef?.offsetWidth || 180
    const necessarySpace = Math.max(titleWidth, subtitleWidth, MIN_CONTENT_WIDTH) + CONTENT_EXTRA_WIDTH
    const newWindowWidth = Math.min(necessarySpace + WINDOW_HEIGHT, MAX_WINDOW_WIDTH)
    await appWindow.setSize(new LogicalSize(newWindowWidth, WINDOW_HEIGHT))

    setWidthCalculated(true)

    const monitor = await currentMonitor()
    if (!monitor) return

    const windowSize = await appWindow.innerSize()
    const absoluteWindowPosition = await appWindow.innerPosition()
    const windowPosition = {
      ...absoluteWindowPosition,
      x: absoluteWindowPosition.x - monitor.position.x,
      y: absoluteWindowPosition.y - monitor.position.y
    }

    console.log(windowPosition.x, windowPosition.y)

    const windowCenterPosition = windowPosition.x + windowSize.width / 2
    const isOnTheRightOfTheScreen = monitor.size.width / 2 < windowCenterPosition
    const offset = oldWindowSize.width - newWindowWidth

    const newWindowPosition = new PhysicalPosition(absoluteWindowPosition.x + offset, absoluteWindowPosition.y)
    isOnTheRightOfTheScreen && appWindow.setPosition(newWindowPosition)
  }

  const refresh = async () => {
    setPlaybackSate(await SpotifyController.getPlaybackState())
    setUiPlaying(null)
    calculateWindowWidth()
  }

  onMount(async () => {
    calculateWindowWidth()
    await initializeTokenManager()

    refresh()
    setInterval(() => refresh(), 3000)
  })

  const playing = () => uiPlaying() !== null ? uiPlaying()! : (playbackState()?.playing !== undefined ? playbackState()?.playing! : false)

  const toggle = () => {
    playing()
      ? SpotifyController.pause().catch(_ => setUiPlaying(null))
      : SpotifyController.play().catch(_ => setUiPlaying(null))

    setUiPlaying(!playing())
  }
  const skip = async (next: boolean) => {
    next
      ? await SpotifyController.next().catch(_ => setUiPlaying(null))
      : await SpotifyController.previous().catch(_ => setUiPlaying(null))

    await refresh()
  }

  return (
    <>
      <img data-tauri-drag-region class="cover" src={playbackState()?.image || fallbackCover} />

      <div class="content" data-tauri-drag-region>

        <div class="info" classList={{ "width-calculated": widthCalculated() }} data-tauri-drag-region>
          <span ref={titleRef} class="title">{playbackState()?.title || <i>Sound not loaded\u00A0</i>}</span>
          <span ref={subtitleRef} class="subtitle">{playbackState()?.artistsAlbum || <i>Artist not loaded\u00A0</i>}</span>
        </div>

        <div class="controls-container" data-tauri-drag-region>
          <Controls playing={playing()} toggle={toggle} previous={() => skip(false)} next={() => skip(true)} />
        </div>

      </div>
    </>
  )
}

export default App
