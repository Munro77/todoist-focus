import { $ } from "./dom";

let timer = 0;

/** Show a short message at the bottom of the screen, optionally with an Undo button. */
export function toast(message: string, undo?: () => void): void {
  const box = $("toast");
  const btn = $<HTMLButtonElement>("toast-undo");
  $("toast-msg").textContent = message;
  box.hidden = false;
  btn.hidden = !undo;
  btn.onclick = undo
    ? () => {
        box.hidden = true;
        undo();
      }
    : null;
  clearTimeout(timer);
  timer = window.setTimeout(() => (box.hidden = true), 6000);
}
