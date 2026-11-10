import { useEffect, useState } from "react";
import { cleanNickname } from "../games/nickname";
import { type BoardRow, fetchBoard, myNickname, setNickname } from "../online";
import { t } from "../i18n";
import { unlocks } from "../community";
import { lapTime } from "./format";
import { secondaryBtn } from "./styles";

type Board = { day: string; trackId: string; condition: "dry" | "wet" | "lowdf" };

/**
 * Today's Daily Quali board by name: the named players' positions among everyone who drove today, and a nickname
 * box for a player who isn't on it by name yet. A name goes on every lap this device puts on the board, today's
 * included; taking it off (in the box once named) puts the laps back to anonymous.
 */
export function DailyBoard({ board }: { board: Board }) {
  // undefined while loading, null when the board can't be reached
  const [rows, setRows] = useState<BoardRow[] | null | undefined>(undefined);
  const [mine, setMine] = useState(myNickname);
  const [draft, setDraft] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "taken" | "invalid" | "failed">("idle");
  const [editing, setEditing] = useState(false);

  const load = () => void fetchBoard(board).then(setRows);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [board.day, board.trackId, board.condition, mine]);

  const save = async (name: string | null) => {
    if (name !== null && !cleanNickname(name)) return setState("invalid");
    setState("busy");
    const r = await setNickname(name === null ? null : cleanNickname(name));
    if (r !== "ok") return setState(r);
    setState("idle");
    setEditing(false);
    setMine(myNickname());
    // a ten-friend inviter gets the star as soon as there's a name to put it on
    if (name && unlocks().badge) void import("../community").then((m) => m.refreshInvites());
  };

  return (
    <section aria-label={t("Today's board")} className="mt-4 border-t border-line pt-3">
      <h3 className="caption">{t("Today's board")}</h3>
      {rows && rows.length > 0 ? (
        <ol className="mt-2 divide-y divide-line">
          {rows.map((r) => (
            <li key={r.nickname} className={`flex items-baseline gap-3 py-1.5 text-[14px] ${r.nickname === mine ? "text-ink" : "text-paint"}`}>
              <span className="num w-7 shrink-0 text-right text-steel">P{r.pos}</span>
              <span className="min-w-0 flex-1 truncate font-semibold">
                {r.nickname}
                {r.badge && (
                  <span className="ml-1.5 text-[#f5c518]" title={t("Brought 10 friends to Lapdle")} aria-label={t("Brought 10 friends to Lapdle")}>
                    ★
                  </span>
                )}
              </span>
              <span className="num shrink-0">{lapTime(r.lapMs)}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-1.5 text-[13px] text-steel">{rows ? t("No names on today's board yet. Be the first.") : rows === null ? t("The board can't be reached right now.") : t("Loading the board…")}</p>
      )}

      {mine && !editing ? (
        <p className="mt-2 text-[13px] text-steel">
          {t("You're on the board as {name}.", { name: mine })}{" "}
          <button className="underline underline-offset-2 hover:text-paint" onClick={() => setEditing(true)}>
            {t("Change")}
          </button>
        </p>
      ) : (
        <form
          className="mt-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            void save(draft);
          }}
        >
          <label className="text-[13px] text-steel" htmlFor="board-nick">
            {t("Add a nickname to put your lap on the board")}
          </label>
          <div className="mt-1.5 flex gap-2">
            <input
              id="board-nick"
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                setState("idle");
              }}
              maxLength={16}
              autoComplete="nickname"
              placeholder={mine ?? t("Nickname")}
              className="h-[42px] min-w-0 flex-1 border border-paint/20 bg-night px-3 text-[14px] text-paint placeholder:text-steel/70 focus-visible:outline-2 focus-visible:outline-ink"
            />
            <button type="submit" className={secondaryBtn} disabled={state === "busy" || !draft.trim()}>
              {state === "busy" ? t("Saving…") : t("Save")}
            </button>
          </div>
          {state === "taken" && <p className="mt-1.5 text-[13px] text-kerb">{t("That nickname is taken. Try another.")}</p>}
          {state === "invalid" && <p className="mt-1.5 text-[13px] text-kerb">{t("3 to 16 letters, numbers, spaces, dots, dashes or underscores.")}</p>}
          {state === "failed" && <p className="mt-1.5 text-[13px] text-kerb">{t("That didn't work. Check your connection and try again.")}</p>}
          {mine && (
            <button type="button" className="mt-1.5 text-[13px] text-steel underline underline-offset-2 hover:text-paint" onClick={() => void save(null)}>
              {t("Take my name off the board")}
            </button>
          )}
          <p className="mt-1.5 text-[12px] text-steel/80">{t("Shown to everyone with your lap times. No account; you can change or remove it any time.")}</p>
        </form>
      )}
    </section>
  );
}
