import { createSignal } from "solid-js"
import logo from "./assets/logo.svg"
import { invoke } from "@tauri-apps/api/tauri"
import "./App.css"

function App() {
  const [username, setUsername] = createSignal("")
  const [password, setPassword] = createSignal("")
  const [error, setError] = createSignal(null)

  let login = () => invoke("login", { username: username(), password: password() }).catch(setError)
  let startSpotifyConnect = () => invoke("start_spotify_connect").catch(setError)
  let play = () => invoke("play").catch(setError)
  let pause = () => invoke("pause").catch(setError)

  return (
    <div class="container">
      <input type="text" value={username()} onChange={e => setUsername(e.target.value)} />
      <input type="text" value={password()} onChange={e => setPassword(e.target.value)} />
      <button onClick={login}>Login</button>
      <button onClick={startSpotifyConnect}>Start</button>
      <button onClick={play}>Play</button>
      <button onClick={pause}>Pause</button>
      <span>{error() || ""}</span>
    </div>
  )
}

export default App
