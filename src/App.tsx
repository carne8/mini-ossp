import { createSignal, onMount } from "solid-js"
import { InvokeArgs, invoke } from "@tauri-apps/api/tauri"
import { appWindow } from "@tauri-apps/api/window"
import { Controls } from "./Components/Controls"
import logo from "./assets/logo.svg"
import "./App.sass"

function App() {
  const [error, setError] = createSignal(null)
  const [playerPlaying, setPlayerPlaying] = createSignal(false)
  const [uiPlaying, setUiPlaying] = createSignal<boolean | null>(null)
  const playerStarted = () => invokeCommand("check_player_state")

  let invokeCommand = (commandName: string, invokeArgs?: InvokeArgs) =>
    invoke(commandName, invokeArgs).catch(setError)

  onMount(async () => {
    appWindow.listen("player_event", ({ event, payload }) => {
      console.log(payload)
      switch (payload) {
        case "playing": setPlayerPlaying(true); setUiPlaying(null); break
        case "paused": setPlayerPlaying(false); setUiPlaying(null); break
      }
    })

    !await playerStarted()
      ? await invokeCommand("start_spotify_connect")
      : console.info("Didn't start player because it is already started.")
  })

  let playing = () => uiPlaying() !== null ? uiPlaying()! : playerPlaying()

  let toggle = () => {
    invokeCommand("player_command", { command: playing() ? "pause" : "play" })
    setUiPlaying(!playing())
  }
  let previous = () => invokeCommand("player_command", { command: "prev" })
  let next = () => invokeCommand("player_command", { command: "next" })

  return (
    <>
      <span>{error() || ""}</span>
      <Controls playing={playing()} toggle={toggle} previous={previous} next={next} />
    </>
  )
}

export default App
