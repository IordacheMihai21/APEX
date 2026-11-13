import { useEffect, useState } from "react";
import { track } from "../analytics";
import { t } from "../i18n";
import { disableReminder, dismissReminder, enableReminder, hourLabel, useReminder } from "../reminder";
import { secondaryBtn } from "./styles";

const HOURS = Array.from({ length: 24 }, (_, h) => h);

/** The hour picker: the player's own clock, every hour of the day. */
function HourSelect({ value, onChange, label }: { value: number; onChange: (h: number) => void; label: string }) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="num h-[42px] border border-paint/20 bg-night px-2 text-[14px] font-semibold text-paint focus-visible:outline-2 focus-visible:outline-ink"
    >
      {HOURS.map((h) => (
        <option key={h} value={h}>
          {hourLabel(h)}
        </option>
      ))}
    </select>
  );
}

/**
 * After a daily game (the Daily Quali's result, a daily minigame's finish card): a reminder for tomorrow's games at an
 * hour the player picks (the hour they're playing now to start with). Once on, one quiet line says when it comes.
 * On an iPhone or iPad outside the installed app, where it can't be turned on, a line says to add Lapdle to the Home
 * Screen first. Hidden where the browser can't do it at all, once waved away, and after the player blocked
 * notifications. Each time it's shown counts once ("Reminder" offered), so the offer's reach can be measured.
 */
export function ReminderOffer({ from, className = "mt-4" }: { from: string; className?: string }) {
  const { support, hour, dismissed } = useReminder();
  const [pick, setPick] = useState(() => new Date().getHours());
  const [state, setState] = useState<"idle" | "busy" | "denied" | "failed">("idle");
  const shown = !dismissed && hour === null && support !== "no";
  useEffect(() => {
    if (shown) track("Reminder", { action: support === "yes" ? "offered" : "install-first", from });
    // once per mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (support === "no") return null;
  if (hour !== null) return <p className={`${className} text-[13px] text-steel`}>{t("Daily reminder on, at {time}.", { time: hourLabel(hour) })}</p>;
  if (dismissed) return null;
  if (support === "install-first")
    return (
      <div className={`${className} flex items-start justify-between gap-2 border border-line bg-night/50 px-3 py-3`}>
        <p className="text-[14px] leading-snug text-paint">{t("Want a reminder when tomorrow's games are out? Add Lapdle to your Home Screen (Share, then Add to Home Screen), then turn it on in the app.")}</p>
        <button onClick={dismissReminder} aria-label={t("No reminder")} className="-mt-1 -mr-1 grid h-7 w-7 shrink-0 place-items-center text-[18px] leading-none text-steel hover:text-paint">
          ×
        </button>
      </div>
    );
  return (
    <div className={`${className} border border-ink/40 bg-night/50 px-3 py-3`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[14px] leading-snug text-paint">{t("Get a reminder when tomorrow's games are out.")}</p>
        <button onClick={dismissReminder} aria-label={t("No reminder")} className="-mt-1 -mr-1 grid h-7 w-7 shrink-0 place-items-center text-[18px] leading-none text-steel hover:text-paint">
          ×
        </button>
      </div>
      <div className="mt-2.5 flex gap-2">
        <HourSelect value={pick} onChange={setPick} label={t("Reminder time")} />
        <button
          className={`${secondaryBtn} flex-1`}
          disabled={state === "busy"}
          onClick={async () => {
            setState("busy");
            const r = await enableReminder(pick, from);
            if (r === "failed") track("Reminder", { action: "failed", from });
            setState(r === "on" ? "idle" : r);
          }}
        >
          {state === "busy" ? t("Turning on…") : t("Remind me")}
        </button>
      </div>
      {state === "denied" && <p className="mt-2 text-[13px] text-steel">{t("Notifications are blocked for Lapdle in this browser. You can allow them in the site settings.")}</p>}
      {state === "failed" && <p className="mt-2 text-[13px] text-steel">{t("That didn't work. Check your connection and try again.")}</p>}
    </div>
  );
}

/** The menu's reminder section: turn it on at the current hour, change the hour, or turn it off. */
export function ReminderMenu({ rowClass, headingClass }: { rowClass: string; headingClass: string }) {
  const { support, hour } = useReminder();
  const [busy, setBusy] = useState(false);
  if (support === "no") return null;
  return (
    <>
      <p className={headingClass}>{t("Daily reminder")}</p>
      {support === "install-first" ? (
        <p className="px-5 py-3 text-[14px] leading-snug text-steel">{t("On iPhone and iPad, add Lapdle to your Home Screen first, then turn the reminder on in the app.")}</p>
      ) : hour === null ? (
        <ul>
          <li>
            <button
              className={rowClass}
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await enableReminder(new Date().getHours(), "menu");
                setBusy(false);
              }}
            >
              <span className="min-w-0 flex-1">{t("Remind me every day at {time}", { time: hourLabel(new Date().getHours()) })}</span>
            </button>
          </li>
        </ul>
      ) : (
        <div className="flex items-center gap-3 px-5 py-3">
          <HourSelect
            value={hour}
            label={t("Reminder time")}
            onChange={async (h) => {
              setBusy(true);
              await enableReminder(h, "menu");
              setBusy(false);
            }}
          />
          <button className={`${secondaryBtn} flex-1`} disabled={busy} onClick={() => void disableReminder("menu")}>
            {t("Turn off")}
          </button>
        </div>
      )}
    </>
  );
}
