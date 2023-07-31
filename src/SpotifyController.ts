import { getAccessToken } from "./TokenManager"

export type PlaybackState = {
  title: string,
  artistsAlbum: string,
  image: string,
  playing: boolean
}

const getHeaders = async () => {
  return { Authorization: "Bearer " + await getAccessToken() }
}

export const getPlaybackState: () => Promise<PlaybackState> = async () => {
  const res = await fetch("https://api.spotify.com/v1/me/player", { headers: await getHeaders() }).then(res => res.json())

  // Merge all artist names
  const artists = res.item.artists.reduce(
    (total: string | null, current: any) => total ? `${total}, ${current.name}` : current.name,
    null
  )

  return {
    title: res.item.name,
    artistsAlbum: `${artists} • ${res.item.album.name}`,
    image: res.item?.album?.images[0]?.url,
    playing: res.is_playing
  }
}

export const pause: () => Promise<void> = async () =>
  fetch("https://api.spotify.com/v1/me/player/pause", { method: "PUT", headers: await getHeaders() }).then(_ => { })

export const play: () => Promise<void> = async () =>
  fetch("https://api.spotify.com/v1/me/player/play", { method: "PUT", headers: await getHeaders() }).then(_ => { })


export const next: () => Promise<void> = async () =>
  fetch("https://api.spotify.com/v1/me/player/next", { method: "POST", headers: await getHeaders() }).then(_ => { })

export const previous: () => Promise<void> = async () =>
  fetch("https://api.spotify.com/v1/me/player/previous", { method: "POST", headers: await getHeaders() }).then(_ => { })