import { useEffect, useState } from "react";
import { t, tn } from "../i18n";
import { track } from "../analytics";
import { standalone } from "../install";
import { type RestorePreview, ONLINE, RESTORE_ARRIVAL, applyRestore, existingDeviceId, myNickname, previewRestore, restoreCodeIn, restoreLink } from "../online";
import { primaryBtn, secondaryBtn } from "./styles";

/** Instagram's, TikTok's, Facebook's and Snapchat's own browsers: they forget the site between visits. */
export function inAppBrowser(ua = typeof navigator !== "undefined" ? navigator.userAgent : ""): string | null {
  if (/Instagram/i.test(ua)) return "Instagram";
  if (/FBAN|FBAV|FB_IAB|FBIOS/i.test(ua)) return "Facebook";
  if (/musical_ly|TikTok|Bytedance|BytedanceWebview/i.test(ua)) return "TikTok";
  if (/Snapchat/i.test(ua)) return "Snapchat";
  return null;
}

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * A band at the top in an app's own browser (Instagram, TikTok…): those forget the site from one visit to the next, so
 * the player would lose their name and streak every day. It says so, and copies a link that opens the same player in
 * Safari or Chrome (the restore link). Waved away for the visit.
 */
export function InAppBanner() {
  const app = inAppBrowser();
  const [hidden, setHidden] = useState(() => {
    try {
      return sessionStorage.getItem("lapdle.inapp.hidden") === "1";
    } catch {
      return false;
    }
  });
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (app && !hidden) track("In-app browser", { app, action: "shown" });
    // once per visit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!app || hidden || standalone()) return null;
  const hide = () => {
    setHidden(true);
    try {
      sessionStorage.setItem("lapdle.inapp.hidden", "1");
    } catch {
      /* it shows again on the next page */
    }
  };
  return (
    <div className="relative z-30 border-b border-ink/40 bg-board px-4 py-3" role="region" aria-label={t("Browser notice")}>
      <div className="mx-auto flex max-w-[1240px] items-start gap-3">
        <p className="min-w-0 flex-1 text-[14px] leading-snug text-paint">
          {t("You're in {app}'s browser, which forgets Lapdle between visits: your name and streak won't be kept. Copy your link and open it in Safari or Chrome.", { app })}
        </p>
        <button onClick={hide} aria-label={t("Close")} className="-mt-1 -mr-1 grid h-8 w-8 shrink-0 place-items-center text-[20px] leading-none text-steel hover:text-paint">
          ×
        </button>
      </div>
      <div className="mx-auto mt-2 max-w-[1240px]">
        <button
          className={`${primaryBtn} w-full sm:w-auto`}
          onClick={async () => {
            if (await copy(ONLINE ? restoreLink() : location.origin)) {
              setCopied(true);
              track("In-app browser", { app, action: "copied" });
            }
          }}
        >
          {copied ? t("Copied: paste it in Safari or Chrome") : t("Copy my link")}
        </button>
      </div>
    </div>
  );
}

/**
 * Opened with a restore link (lapdle.com/?restore=…): shows whose progress it is (the name and how many days) and
 * restores it on a tap, then reloads so every game reads it. Nothing changes without the tap.
 */
export function RestoreArrival() {
  const code = RESTORE_ARRIVAL;
  const [state, setState] = useState<{ kind: "loading" } | { kind: "found"; p: RestorePreview } | { kind: "unknown" } | { kind: "failed" } | { kind: "gone" }>(() =>
    !code || code === existingDeviceId() ? { kind: "gone" } : { kind: "loading" },
  );
  useEffect(() => {
    if (!code || state.kind !== "loading") return;
    void previewRestore(code).then((p) => setState(p === "failed" ? { kind: "failed" } : p ? { kind: "found", p } : { kind: "unknown" }));
    // once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (state.kind === "gone" || state.kind === "loading") return null;
  const close = () => setState({ kind: "gone" });
  const mine = myNickname();
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-night/80 backdrop-blur-[2px] sm:items-center sm:p-4" onClick={close}>
      <div role="dialog" aria-modal="true" aria-labelledby="restore-h" className="finish-in w-full border-t border-line bg-board px-5 pt-5 pb-[max(20px,env(safe-area-inset-bottom))] sm:max-w-[400px] sm:border" onClick={(e) => e.stopPropagation()}>
        {state.kind === "found" ? (
          <>
            <p className="caption text-ink">{t("Welcome back")}</p>
            <h2 id="restore-h" className="wide mt-1 text-[26px] leading-[1.05] text-paint">
              {state.p.nickname ?? t("Your progress")}
            </h2>
            <p className="mt-2 text-[14px] leading-snug text-steel">
              {tn(state.p.days.length, "{n} day played. Restore it on this browser?", "{n} days played. Restore them on this browser?")}
              {mine && mine !== state.p.nickname ? ` ${t("This replaces {name} on this browser.", { name: mine })}` : ""}
            </p>
            <div className="mt-4 flex flex-wrap gap-2.5">
              <button
                className={`${primaryBtn} flex-1 basis-40`}
                onClick={() => {
                  applyRestore(code!, state.p);
                  track("Restore", { action: "restored", days: state.p.days.length });
                  location.replace("/");
                }}
              >
                {t("Restore")}
              </button>
              <button className={`${secondaryBtn} flex-1 basis-28`} onClick={close}>
                {t("Not now")}
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 id="restore-h" className="wide text-[22px] leading-tight text-paint">
              {state.kind === "unknown" ? t("Nothing to restore") : t("That didn't work")}
            </h2>
            <p className="mt-2 text-[14px] leading-snug text-steel">{state.kind === "unknown" ? t("This link doesn't match any saved progress yet. Play a daily game first.") : t("That didn't work. Check your connection and try again.")}</p>
            <button className={`${secondaryBtn} mt-4 w-full`} onClick={close}>
              {t("Close")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** The menu's "Your progress" section: copy the restore link, or restore from one pasted here. */
export function RestoreMenu({ headingClass }: { headingClass: string }) {
  const [copied, setCopied] = useState(false);
  const [text, setText] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "invalid" | "unknown" | "failed">("idle");
  if (!ONLINE) return null;
  return (
    <>
      <p className={headingClass}>{t("Your progress")}</p>
      <div className="px-5 py-3">
        <p className="text-[14px] leading-snug text-steel">{t("Keep your name and streak on another phone or browser: save this link somewhere safe (it's your key, so don't share it).")}</p>
        <button
          className={`${secondaryBtn} mt-2.5 w-full`}
          onClick={async () => {
            if (await copy(restoreLink())) {
              setCopied(true);
              track("Restore", { action: "copied" });
            }
          }}
        >
          {copied ? t("Restore link copied") : t("Copy my restore link")}
        </button>
        <form
          className="mt-3 flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            const code = restoreCodeIn(text);
            if (!code) return setState("invalid");
            setState("busy");
            const p = await previewRestore(code);
            if (p === "failed") return setState("failed");
            if (!p) return setState("unknown");
            applyRestore(code, p);
            track("Restore", { action: "restored", days: p.days.length });
            location.replace("/");
          }}
        >
          <input
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setState("idle");
            }}
            placeholder={t("Paste a restore link")}
            aria-label={t("Paste a restore link")}
            className="h-[42px] min-w-0 flex-1 border border-paint/20 bg-night px-3 text-[15px] text-paint focus-visible:outline-2 focus-visible:outline-ink"
          />
          <button type="submit" className={secondaryBtn} disabled={state === "busy"}>
            {t("Restore")}
          </button>
        </form>
        {state === "invalid" && <p className="mt-1.5 text-[13px] text-kerb">{t("That isn't a restore link.")}</p>}
        {state === "unknown" && <p className="mt-1.5 text-[13px] text-kerb">{t("This link doesn't match any saved progress yet. Play a daily game first.")}</p>}
        {state === "failed" && <p className="mt-1.5 text-[13px] text-kerb">{t("That didn't work. Check your connection and try again.")}</p>}
      </div>
    </>
  );
}
