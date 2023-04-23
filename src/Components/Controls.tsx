import playSvg from "../assets/icons/play.svg"
import pauseSvg from "../assets/icons/pause.svg"
import previousSvg from "../assets/icons/previous.svg"
import nextSvg from "../assets/icons/next.svg"
import "./Controls.sass"

export const Controls = (props: {
  playing: boolean,
  toggle: () => void,
  previous: () => void,
  next: () => void
}) => (
  <div data-tauri-drag-region class="controls">
    <button id="previous" onClick={props.previous}>{previousSvg}</button>
    <button id="play-pause" onClick={props.toggle} classList={{ playing: props.playing }}>{props.playing ? pauseSvg : playSvg}</button>
    <button id="next" onClick={props.next}>{nextSvg}</button>
  </div>
)