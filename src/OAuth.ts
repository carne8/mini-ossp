import { listen } from "@tauri-apps/api/event"
import { open } from "@tauri-apps/api/shell"

const clientId = import.meta.env.VITE_CLIENT_ID
const clientSecret = import.meta.env.VITE_CLIENT_SECRET
const redirectUri = import.meta.env.VITE_REDIRECT_URI

export const requestLogin: () => Promise<string> = () => (
  new Promise(async (resolve, reject) => {
    const params = {
      client_id: clientId,
      response_type: "code",
      redirect_uri: redirectUri,
      scope: "user-read-currently-playing user-modify-playback-state user-read-playback-state"
    }

    const unlisten = await listen("scheme-request-received", event => {
      const responseUrl = new URL(event.payload as string)
      const code = responseUrl.searchParams.get("code")

      code ? resolve(code) : reject("Response doesn't contain any token")
      unlisten()
    })
    await open("https://accounts.spotify.com/authorize?" + new URLSearchParams(params).toString())
  })
)


export type TokenInfo = {
  access_token: string
  token_type: string
  scope: string
  expires_in: number
  refresh_token: string
}

export type RefreshTokenInfo = {
  access_token: string
  token_type: string
  scope: string
  expires_in: number
}

const auth: string = "Basic " + btoa(`${clientId}:${clientSecret}`)
const headers = {
  Authorization: auth,
  "Content-Type": "application/x-www-form-urlencoded"
}

export const requestAccessToken: (code: string) => Promise<TokenInfo> = async (code: string) => {
  const endpoint = "https://accounts.spotify.com/api/token"
  const body = {
    code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code"
  }

  const url = `${endpoint}?${new URLSearchParams(body).toString()}`

  return await fetch(url, {
    method: "POST",
    headers
  })
    .then(res => res.json())
    .then(res => res as TokenInfo)
}

export const refreshAccessToken: (refreshToken: string) => Promise<RefreshTokenInfo> = async (refreshToken: string) => {
  const endpoint = "https://accounts.spotify.com/api/token"
  const body = {
    grant_type: "refresh_token",
    refresh_token: refreshToken
  }

  const url = `${endpoint}?${new URLSearchParams(body).toString()}`

  return await fetch(url, {
    method: "POST",
    headers
  })
    .then(res => res.json())
    .then(res => res as TokenInfo)
}