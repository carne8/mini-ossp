import playSvg from "../assets/play.svg"
import pauseSvg from "../assets/pause.svg"
import previousSvg from "../assets/previous.svg"
import nextSvg from "../assets/next.svg"
import sass from "./Controls.module.sass"

export const Controls = (props: {
  playing: boolean,
  toggle: () => void,
  previous: () => void,
  next: () => void
}) => (
  <div class={sass.controls}>
    <button id={sass.previous} onClick={props.previous}>{previousSvg}</button>
    <button id={sass["play-pause"]} onClick={props.toggle}>{props.playing ? pauseSvg : playSvg}</button>
    <button id={sass.next} onClick={props.next}>{nextSvg}</button>
  </div>
)