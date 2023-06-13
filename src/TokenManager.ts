import { BaseDirectory, exists, readTextFile, writeTextFile } from "@tauri-apps/api/fs"
import * as OAuth from "./OAuth"

type Schema = {
  refreshToken: string | null
  accessToken: string | null
  expireDate: number | null
}

let cachedConfig: Schema | null = null

const writeConfig = async () => {
  if (!cachedConfig) return

  const content = `${cachedConfig.refreshToken}\n${cachedConfig.accessToken}\n${cachedConfig.expireDate}`
  await writeTextFile("app.conf", content, { dir: BaseDirectory.AppConfig })
}

const loadConfig = async () => {
  const fileExists = await exists("app.conf", { dir: BaseDirectory.AppConfig })
  if (!fileExists) {
    await writeTextFile("app.conf", "", { dir: BaseDirectory.AppConfig })
  }

  const content = await readTextFile("app.conf", { dir: BaseDirectory.AppConfig })
  const lines = content.split("\n")

  const refreshToken = lines[0]
  const accessToken = lines[1]
  const expireDate = lines[2]

  const config: Schema = {
    refreshToken: refreshToken === "undefined" || refreshToken === "null" || refreshToken === "NaN" ? null : refreshToken,
    accessToken: accessToken === "undefined" || accessToken === "null" || accessToken === "NaN" ? null : accessToken,
    expireDate: expireDate === "undefined" || expireDate === "null" || expireDate === "NaN" ? null : parseInt(expireDate),
  }

  cachedConfig = config
  return config
}



const saveToken = async (token: OAuth.TokenInfo) => {
  cachedConfig = {
    refreshToken: token.refresh_token,
    accessToken: token.access_token,
    expireDate: Date.now() + token.expires_in * 1000
  }
  await writeConfig()
}

const saveRefreshedToken = async (token: OAuth.RefreshTokenInfo) => {
  cachedConfig = {
    refreshToken: cachedConfig?.refreshToken || null,
    accessToken: token.access_token,
    expireDate: Date.now() + token.expires_in * 1000
  }
  await writeConfig()
}


const generateToken = async () => {
  const authCode = await OAuth.requestLogin()
  const newToken = await OAuth.requestAccessToken(authCode)

  saveToken(newToken)
  return newToken.access_token
}

const refreshToken = async (_refreshToken?: string) => {
  const refreshToken = _refreshToken || cachedConfig?.refreshToken
  if (!refreshToken) {
    console.log("Failed to retrieve refreshToken.")
    console.log("Generating a new one.")
    return await generateToken()
  }

  const newToken = await OAuth.refreshAccessToken(refreshToken)

  saveRefreshedToken(newToken)
  return newToken.access_token
}

export const initializeTokenManager = async () => await loadConfig()

export const getAccessToken = async () => {
  const token = cachedConfig?.accessToken

  // If there isn't any token, generate a new one
  if (!token) return await generateToken()

  // If token expired, refresh the token
  const expireDate = cachedConfig?.expireDate
  if (expireDate !== undefined && expireDate !== null && Date.now() - expireDate >= 0) return await refreshToken()
  if (expireDate === undefined || expireDate === null || isNaN(expireDate)) return await refreshToken()

  return token
}
