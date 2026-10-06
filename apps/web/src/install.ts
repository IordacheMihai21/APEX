import { useEffect, useState } from "react";
import { track } from "./analytics";

/**
 * Installing Lapdle as an app. Chrome, Edge and Android offer an install
 * prompt the page can open from its own button (the beforeinstallprompt
 * event, caught here as early as possible so it isn't missed); Safari on
 * iPhone and iPad has no prompt, only Share > Add to Home Screen, so there the
 * button explains the steps. Nothing shows when the app is already installed.
 */
interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: InstallPrompt | null = null;
let installedNow = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // our own button opens it, when the player wants it
    deferred = e as InstallPrompt;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    installedNow = true;
    deferred = null;
    track("App installed");
    notify();
  });
}

/** Running as the installed app (home screen or desktop window). */
export function standalone(): boolean {
  if (typeof window === "undefined") return false;
  return matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** iPhone and iPad (including iPads that report a desktop Mac), where installing is Share > Add to Home Screen. */
export function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export type InstallWay = "prompt" | "ios" | null;

/** How this browser can install the app right now (null: it can't, or it already is). */
export function installWay(): InstallWay {
  if (installedNow || standalone()) return null;
  if (deferred) return "prompt";
  if (isIos()) return "ios";
  return null;
}

/** Open the browser's install prompt; resolves true if the player accepted. */
export async function promptInstall(from: string): Promise<boolean> {
  const p = deferred;
  if (!p) return false;
  deferred = null;
  await p.prompt();
  const { outcome } = await p.userChoice;
  track("Install prompt", { from, outcome });
  notify();
  return outcome === "accepted";
}

export function useInstallWay(): InstallWay {
  const [way, setWay] = useState<InstallWay>(installWay);
  useEffect(() => {
    const on = () => setWay(installWay());
    listeners.add(on);
    on();
    return () => void listeners.delete(on);
  }, []);
  return way;
}

const DISMISS_KEY = "apex.install.dismissed";
export function installDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}
export function dismissInstall() {
  try {
    localStorage.setItem(DISMISS_KEY, "1");
  } catch {
    /* it just shows again next time */
  }
}
