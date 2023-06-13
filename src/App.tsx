import { createSignal, onMount } from "solid-js"
import { InvokeArgs, invoke } from "@tauri-apps/api/tauri"
import { LogicalSize, appWindow } from "@tauri-apps/api/window"
import { Controls } from "./Components/Controls"
import fallbackCover from "./assets/fallback-cover.svg?url"
import "./App.sass"

import { getToken, initializeTokenManager } from "./TokenManager"

type TrackInfo = {
  title: string,
  artistsAlbum: string,
  image: string
}

const WINDOW_HEIGHT = 90
const MAX_WINDOW_WIDTH = 350
const MIN_CONTENT_WIDTH = 140
const CONTENT_EXTRA_WIDTH = 30

function App() {
  const [playerPlaying, setPlayerPlaying] = createSignal(false)
  const [uiPlaying, setUiPlaying] = createSignal<boolean | null>(null)
  const [trackInfo, setTrackInfo] = createSignal<TrackInfo | null>(null)

  const [widthCalculated, setWidthCalculated] = createSignal(false)
  let titleRef: HTMLElement | undefined
  let subtitleRef: HTMLElement | undefined

  const invokeCommand = (commandName: string, invokeArgs?: InvokeArgs) =>
    invoke(commandName, invokeArgs)
      .catch(error => { console.warn(error); setUiPlaying(null) })

  const setTrack = (data: string) => {
    const [title, artists, album, image] = data.split("|separator|")
    setTrackInfo({ title, artistsAlbum: `${artists} • ${album}`, image })
  }

  const calculateWindowWidth = () => {
    setWidthCalculated(false)

    const titleWidth = titleRef?.offsetWidth || 200
    const subtitleWidth = subtitleRef?.offsetWidth || 180
    const necessarySpace = Math.max(titleWidth, subtitleWidth, MIN_CONTENT_WIDTH) + CONTENT_EXTRA_WIDTH
    const newWindowWidth = Math.min(necessarySpace + WINDOW_HEIGHT, MAX_WINDOW_WIDTH)
    appWindow.setSize(new LogicalSize(newWindowWidth, WINDOW_HEIGHT))

    setWidthCalculated(true)
  }

  onMount(async () => {
    calculateWindowWidth()

    // appWindow.listen("player_event", ({ payload }: { payload: String }) => {
    //   const splitPayload = payload.split(":")
    //   switch (splitPayload[0]) {
    //     case "paused": setPlayerPlaying(false); setUiPlaying(null); break
    //     case "playing":
    //       setPlayerPlaying(true)
    //       setUiPlaying(null)
    //       setTrack(payload.substring("playing:".length))
    //       calculateWindowWidth()
    //       break
    //     case "loaded":
    //       setPlayerPlaying(false)
    //       setTrack(payload.substring("loaded:".length))
    //       calculateWindowWidth()
    //       break
    //   }
    // })

    await initializeTokenManager()
    console.log(await getToken())
  })

  const playing = () => uiPlaying() !== null ? uiPlaying()! : playerPlaying()

  const toggle = () => {
    invokeCommand("player_command", { command: playing() ? "pause" : "play" })
    setUiPlaying(!playing())
  }
  const previous = () => invokeCommand("player_command", { command: "prev" })
  const next = () => invokeCommand("player_command", { command: "next" })

  return (
    <>
      <img data-tauri-drag-region class="cover" src={trackInfo()?.image || fallbackCover} />

      <div class="content" data-tauri-drag-region>

        <div class="info" classList={{ "width-calculated": widthCalculated() }} data-tauri-drag-region>
          <span ref={titleRef} class="title">{trackInfo()?.title || <i>Sound not loaded\u00A0</i>}</span>
          <span ref={subtitleRef} class="subtitle">{trackInfo()?.artistsAlbum || <i>Artist not loaded\u00A0</i>}</span>
        </div>

        <div class="controls-container" data-tauri-drag-region>
          <Controls playing={playing()} toggle={toggle} previous={previous} next={next} />
        </div>

      </div>
    </>
  )
}

export default App
