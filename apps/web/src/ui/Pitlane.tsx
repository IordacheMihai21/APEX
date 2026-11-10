import { useEffect, useRef, useState } from "react";
import { cleanNickname } from "../games/nickname";
import { markOffered, shouldOfferName, suggestName } from "../games/pitName";
import { t } from "../i18n";
import { dateKey } from "../modes/schedule";
import { ONLINE, myNickname, setNickname } from "../online";
import { track } from "../analytics";
import { primaryBtn, secondaryBtn } from "./styles";

/** Ask for the pitlane name: `force` opens it whatever the offer rules (the menu's Change). */
export const openPitlane = (force = false) => window.dispatchEvent(new CustomEvent("lapdle:pitlane", { detail: { force } }));

/**
 * "Welcome to the pitlane. What should we call you?" A dialog after the first daily game is finished (and once more on
 * a later day if waved away), with a made-up racing name filled in. The name goes on the Daily Quali board and the
 * monthly Championship. Nothing is asked on arrival, and playing never needs it.
 */
export function Pitlane() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "taken" | "invalid" | "failed">("idle");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const on = (e: Event) => {
      const force = (e as CustomEvent<{ force?: boolean }>).detail?.force;
      if (!ONLINE) return;
      const today = dateKey();
      if (!force && !shouldOfferName(!!myNickname(), today)) return;
      // a finish card is the moment's own dialog: wait until it's closed
      const show = () => {
        if (!force) markOffered(today);
        setName(myNickname() ?? suggestName());
        setState("idle");
        setOpen(true);
        track("Pitlane", { action: force ? "opened" : "offered" });
      };
      if (force) return show();
      const wait = setInterval(() => {
        if (!document.querySelector(".finish-in")) {
          clearInterval(wait);
          show();
        }
      }, 700);
    };
    window.addEventListener("lapdle:pitlane", on);
    return () => window.removeEventListener("lapdle:pitlane", on);
  }, []);

  useEffect(() => {
    if (!open) return;
    input.current?.select();
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open]);

  if (!open) return null;
  const save = async () => {
    const clean = cleanNickname(name);
    if (!clean) return setState("invalid");
    setState("busy");
    const r = await setNickname(clean);
    if (r !== "ok") return setState(r);
    track("Pitlane", { action: "named" });
    setOpen(false);
  };
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-night/80 backdrop-blur-[2px] sm:items-center sm:p-4" onClick={() => setOpen(false)}>
      <div role="dialog" aria-modal="true" aria-labelledby="pit-h" className="finish-in w-full border-t border-line bg-board px-5 pt-5 pb-[max(20px,env(safe-area-inset-bottom))] sm:max-w-[400px] sm:border" onClick={(e) => e.stopPropagation()}>
        <p className="caption text-ink">{t("Welcome to the pitlane")}</p>
        <h2 id="pit-h" className="wide mt-1 text-[26px] leading-[1.05] text-paint">
          {t("What should we call you?")}
        </h2>
        <p className="mt-2 text-[14px] leading-snug text-steel">{t("Your name goes on the Daily Quali board and in this month's Championship, where the players who race the most Grands Prix (days played) take the top spots.")}</p>
        <form
          className="mt-4"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <div className="flex gap-2">
            <input
              ref={input}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setState("idle");
              }}
              maxLength={16}
              aria-label={t("Nickname")}
              autoComplete="nickname"
              className="h-[46px] min-w-0 flex-1 border border-paint/20 bg-night px-3 text-[16px] text-paint focus-visible:outline-2 focus-visible:outline-ink"
            />
            <button type="button" className={secondaryBtn} aria-label={t("Suggest another name")} title={t("Suggest another name")} onClick={() => setName(suggestName())}>
              ⚄
            </button>
          </div>
          {state === "taken" && <p className="mt-1.5 text-[13px] text-kerb">{t("That nickname is taken. Try another.")}</p>}
          {state === "invalid" && <p className="mt-1.5 text-[13px] text-kerb">{t("3 to 16 letters, numbers, spaces, dots, dashes or underscores.")}</p>}
          {state === "failed" && <p className="mt-1.5 text-[13px] text-kerb">{t("That didn't work. Check your connection and try again.")}</p>}
          <div className="mt-4 flex flex-wrap gap-2.5">
            <button type="submit" className={`${primaryBtn} flex-1 basis-40`} disabled={state === "busy"}>
              {state === "busy" ? t("Saving…") : t("Race under this name")}
            </button>
            <button type="button" className={`${secondaryBtn} flex-1 basis-28`} onClick={() => setOpen(false)}>
              {t("Maybe later")}
            </button>
          </div>
          <p className="mt-3 text-[12px] text-steel/80">{t("Shown to everyone with your lap times. No account; you can change or remove it any time.")}</p>
        </form>
      </div>
    </div>
  );
}
