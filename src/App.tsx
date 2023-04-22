import { createSignal, onMount } from "solid-js"
import { InvokeArgs, invoke } from "@tauri-apps/api/tauri"
import { LogicalSize, appWindow } from "@tauri-apps/api/window"
import { Controls } from "./Components/Controls"
import "./App.sass"

type TrackInfo = {
  title: string,
  artists: string,
  album: string,
  image: string
}

const titleFontSize = parseInt((document.querySelector(".title") as HTMLElement | null)?.style.fontSize || "14")

function App() {
  const [playerPlaying, setPlayerPlaying] = createSignal(false)
  const [uiPlaying, setUiPlaying] = createSignal<boolean | null>(null)
  const [trackInfo, setTrackInfo] = createSignal<TrackInfo | null>(null)
  let titleRef: HTMLElement | undefined

  const invokeCommand = (commandName: string, invokeArgs?: InvokeArgs) =>
    invoke(commandName, invokeArgs)
      .catch(error => { console.warn(error); setUiPlaying(null) })
  const playerStarted = () => invokeCommand("check_player_state")

  onMount(async () => {
    appWindow.setSize(new LogicalSize(300, 90))

    appWindow.listen("player_event", ({ payload }: { payload: String }) => {
      const splitPayload = payload.split(":")
      switch (splitPayload[0]) {
        case "paused": setPlayerPlaying(false); setUiPlaying(null); break
        case "playing":
          setPlayerPlaying(true)
          setUiPlaying(null)

          const payloadContent = payload.substring("playing".length + 1)
          const [title, artists, album, image] = payloadContent.split("|separator|")
          setTrackInfo({ title, artists, album, image })

          let newWindowWidth = (titleRef?.clientWidth || 280) + 130
          appWindow.setSize(new LogicalSize(newWindowWidth, 90))

          break
      }
    })

    !await playerStarted()
      ? await invokeCommand("start_spotify_connect")
      : console.info("Didn't start player because it is already started.")
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
      <img data-tauri-drag-region class="cover" src={trackInfo()?.image || "https://placekitten.com/200/200"} />

      <div class="content">

        <div class="info">
          <span ref={titleRef} class="title">{trackInfo()?.title || <i>Sound not loaded</i>}</span>

          <span class="subtitle">{
            trackInfo()?.artists
              ? `${trackInfo()?.artists} • ${trackInfo()?.album}`
              : <i>Artist not loaded</i>
          }</span>

        </div>

        <div class="controls-container">
          <Controls playing={playing()} toggle={toggle} previous={previous} next={next} />
        </div>
      </div>
    </>
  )
}

export default App
