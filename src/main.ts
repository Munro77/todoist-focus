import "./styles.css";
import { App, errorText } from "./app";
import { MockApi } from "./mock/mockApi";
import { FOCUS_RULES } from "./rules/focus";
import { TodoistClient, type TodoistApi } from "./todoist/client";
import { $ } from "./ui/dom";

const TOKEN_KEY = "tdboard.token";
const CACHE_KEY = "tdboard.cache.v1";

const mock = import.meta.env.VITE_MOCK === "1" || new URLSearchParams(location.search).has("mock");

const store = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* blocked */
    }
  },
  del: (k: string) => {
    try {
      localStorage.removeItem(k);
    } catch {
      /* blocked */
    }
  },
};

let app: App | null = null;

function makeApp(api: TodoistApi): App {
  const a = new App({
    api,
    rules: FOCUS_RULES,
    cacheKey: mock ? null : CACHE_KEY,
    onAuthError: (msg) => showSetup(msg),
  });
  return a;
}

function showApp(): void {
  $("setup").hidden = true;
  $("app").hidden = false;
}

function showSetup(message?: string): void {
  app?.stop();
  $("app").hidden = true;
  $("setup").hidden = false;
  const msg = $("setup-msg");
  msg.textContent = message ?? "";
  msg.hidden = !message;
  setTimeout(() => $("token-in").focus(), 50);
}

$("setup-form").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const input = $<HTMLInputElement>("token-in");
  const token = input.value.trim();
  if (!token) return;
  const btn = $<HTMLButtonElement>("setup-go");
  btn.disabled = true;
  btn.textContent = "Checking…";
  const candidate = makeApp(new TodoistClient(token));
  try {
    await candidate.connect();
    store.set(TOKEN_KEY, token);
    input.value = "";
    app = candidate;
    showApp();
    app.start();
  } catch (e) {
    const msg = $("setup-msg");
    msg.hidden = false;
    msg.textContent = errorText(e);
  } finally {
    btn.disabled = false;
    btn.textContent = "Connect";
  }
});

const signout = $<HTMLButtonElement>("signout");
signout.addEventListener("click", () => {
  // Two taps, so a stray tap doesn't log you out.
  if (signout.dataset.armed !== "1") {
    signout.dataset.armed = "1";
    signout.textContent = "Tap again to forget token";
    setTimeout(() => {
      signout.dataset.armed = "";
      signout.textContent = "Forget token";
    }, 4000);
    return;
  }
  signout.dataset.armed = "";
  signout.textContent = "Forget token";
  store.del(TOKEN_KEY);
  app?.clear();
  app = null;
  showSetup("Token removed from this device.");
});

let qTimer = 0;
$<HTMLInputElement>("q").addEventListener("input", (e) => {
  clearTimeout(qTimer);
  const v = (e.target as HTMLInputElement).value.trim();
  qTimer = window.setTimeout(() => app?.setQuery(v), 120);
});
$("add-form").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  if (!app) return;
  const titleIn = $<HTMLInputElement>("new-title");
  const dueIn = $<HTMLInputElement>("new-due");
  const title = titleIn.value.trim();
  if (!title) return;
  const btn = $<HTMLButtonElement>("new-add");
  btn.disabled = true;
  btn.textContent = "Adding…";
  const ok = await app.addTask(title, $<HTMLSelectElement>("new-proj").value, dueIn.value);
  if (ok) {
    titleIn.value = "";
    dueIn.value = "";
  }
  btn.disabled = false;
  btn.textContent = "Add";
  titleIn.focus();
});
$("refresh").addEventListener("click", () => void app?.refresh());

// Boot
if (mock) {
  $("mock-flag").hidden = false;
  signout.hidden = true;
  app = makeApp(new MockApi());
  showApp();
  app.start();
} else {
  const token = store.get(TOKEN_KEY);
  if (token) {
    app = makeApp(new TodoistClient(token));
    showApp();
    app.start();
  } else showSetup();
}
