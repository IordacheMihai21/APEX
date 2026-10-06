import { useEffect, useRef, useState } from "react";
import { playStreak } from "../games/profile";
import { dismissInstall, installDismissed, promptInstall, useInstallWay } from "../install";
import { track } from "../analytics";
import { Export } from "@phosphor-icons/react";
import { primaryBtn, secondaryBtn } from "./styles";

/**
 * "Get the app": the hub's install band (after a first daily game, until it's
 * installed or waved away) and the footer link. On Chrome, Edge and Android
 * the button opens the browser's own install prompt; on iPhone and iPad it
 * shows the Add to Home Screen steps.
 */
export function InstallBand() {
  const way = useInstallWay();
  const [hidden, setHidden] = useState(installDismissed);
  const [ios, setIos] = useState(false);
  // only for players who came back for a game: a first visit is for playing, not installing
  if (!way || hidden || playStreak().daysPlayed < 1) return null;
  return (
    <section aria-label="Get the app" className="border-t border-line">
      <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-x-6 gap-y-3 px-4 py-6 md:px-8">
        <AppIcon />
        <div className="min-w-0 flex-1 basis-[240px]">
          <p className="wide text-[18px] leading-tight text-paint">Lapdle on your home screen</p>
          <p className="mt-1 text-[14px] text-steel">Today's set one tap away, full screen, and it plays offline.</p>
        </div>
        <div className="flex gap-2">
          <button
            className={primaryBtn}
            onClick={() => {
              track("Install button", { from: "hub", way });
              if (way === "prompt") void promptInstall("hub");
              else setIos(true);
            }}
          >
            Install
          </button>
          <button
            className={secondaryBtn}
            onClick={() => {
              dismissInstall();
              setHidden(true);
            }}
          >
            Not now
          </button>
        </div>
      </div>
      {ios && <IosSteps onClose={() => setIos(false)} />}
    </section>
  );
}

/** The footer's install link (a list item): shown wherever installing is possible, dismissed or not. */
export function InstallLink({ className }: { className: string }) {
  const way = useInstallWay();
  const [ios, setIos] = useState(false);
  if (!way) return null;
  return (
    <li>
      <button
        className={className}
        onClick={() => {
          track("Install button", { from: "footer", way });
          if (way === "prompt") void promptInstall("footer");
          else setIos(true);
        }}
      >
        Install the app
      </button>
      {ios && <IosSteps onClose={() => setIos(false)} />}
    </li>
  );
}

function AppIcon() {
  return <img src="/icon-192.png" alt="" width={48} height={48} className="h-12 w-12 shrink-0 rounded-[11px] border border-line" />;
}

/** Safari has no install prompt: the three taps, shown as a card. */
function IosSteps({ onClose }: { onClose: () => void }) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    close.current?.focus();
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  const steps: React.ReactNode[] = [
    <>
      Tap <Export weight="bold" aria-hidden="true" className="mx-0.5 inline h-4 w-4 -translate-y-px text-paint" /> <strong className="text-paint">Share</strong> in the browser's toolbar.
    </>,
    <>
      Scroll down and choose <strong className="text-paint">Add to Home Screen</strong>.
    </>,
    <>
      Tap <strong className="text-paint">Add</strong>. Lapdle opens from your home screen, full screen.
    </>,
  ];
  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-night/80 backdrop-blur-[2px] sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-ios-h"
        className="finish-in relative w-full border-t border-line bg-board px-5 pt-5 pb-[max(20px,env(safe-area-inset-bottom))] sm:max-w-[400px] sm:border"
        onClick={(e) => e.stopPropagation()}
      >
        <button ref={close} onClick={onClose} aria-label="Close" className="absolute top-2 right-2 grid h-10 w-10 place-items-center text-[24px] leading-none text-steel hover:text-paint">
          ×
        </button>
        <div className="flex items-center gap-3 pr-10">
          <AppIcon />
          <h2 id="install-ios-h" className="wide text-[22px] leading-tight text-paint">
            Add Lapdle to your home screen
          </h2>
        </div>
        <ol className="mt-5 space-y-4">
          {steps.map((s, i) => (
            <li key={i} className="grid grid-cols-[28px_1fr] items-start gap-3">
              <span className="wide num grid h-7 w-7 place-items-center bg-ink text-[14px] text-night">{i + 1}</span>
              <span className="pt-0.5 text-[15px] leading-snug text-paint/90">{s}</span>
            </li>
          ))}
        </ol>
        <button className={`${primaryBtn} mt-6 w-full`} onClick={onClose}>
          Got it
        </button>
      </div>
    </div>
  );
}
