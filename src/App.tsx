import { createSignal } from "solid-js"
import logo from "./assets/logo.svg"
import { invoke } from "@tauri-apps/api/tauri"
import "./App.css"

function App() {
  const [username, setUsername] = createSignal("")
  const [password, setPassword] = createSignal("")
  const [error, setError] = createSignal(null)

  function login() {
    invoke("login", { username: username(), password: password() })
      .then(() => console.log("Ok !"))
      .catch(setError)
  }
  function showLogin() { invoke("show_login") }
  function start() {
    invoke("start_spotify_connect", { contextUri: "spotify:album:0C8bAFI1POhzztBVShuzll" })
      .catch(setError)
  }
  function toggleSong() { invoke("toggle_song") }

  return (
    <div class="container">
      <input type="text" value={username()} onChange={e => setUsername(e.target.value)} />
      <input type="text" value={password()} onChange={e => setPassword(e.target.value)} />
      <button onClick={login}>Login</button>
      <button onClick={start}>Start</button>
      <button onClick={toggleSong}>Toggle</button>
      <span>{error() || ""}</span>
    </div>
  )
}

export default App
