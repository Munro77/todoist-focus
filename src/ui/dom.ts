export function $<T extends HTMLElement = HTMLElement>(id: string): T {
  const e = document.getElementById(id);
  if (!e) throw new Error("Missing #" + id);
  return e as T;
}

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string | null, text?: string | null): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

// Todoist's named project colors.
export const TODOIST_COLORS: Record<string, string> = {
  berry_red: "#b8256f", red: "#db4035", orange: "#ff9933", yellow: "#fad000",
  olive_green: "#afb83b", lime_green: "#7ecc49", green: "#299438", mint_green: "#6accbc",
  teal: "#158fad", sky_blue: "#14aaf5", light_blue: "#96c3eb", blue: "#4073ff",
  grape: "#884dff", violet: "#af38eb", lavender: "#eb96eb", magenta: "#e05194",
  salmon: "#ff8d85", charcoal: "#808080", grey: "#b8b8b8", taupe: "#ccac93",
};

export function colorOf(color: string | undefined): string {
  return (color && TODOIST_COLORS[color]) || "var(--muted)";
}

export function dot(color: string | undefined): HTMLSpanElement {
  const d = el("span", "dot");
  d.style.background = colorOf(color);
  return d;
}

const POPOUT_SVG =
  '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M9.5 2.5h4v4M13.5 2.5 7.5 8.5M12 9.5v3a1 1 0 0 1-1 1H3.5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3"/></svg>';

/** Small "open in Todoist" link that sits beside a label. Opens in a new tab or the Todoist app. */
export function popout(url: string, what: string): HTMLAnchorElement {
  const a = el("a", "popout");
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener";
  a.title = "Open in Todoist";
  a.setAttribute("aria-label", "Open " + what + " in Todoist");
  a.innerHTML = POPOUT_SVG;
  // Inside a <summary>, don't also fold or unfold the list.
  a.addEventListener("click", (e) => e.stopPropagation());
  return a;
}
