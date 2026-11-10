import { useState } from "react";
import { arrivedChallenge, dismissChallenge } from "../games/scoreChallenge";
import { GAMES } from "../games/registry";
import { t } from "../i18n";
import { Swords } from "./icons";

/**
 * For a visit from a friend's "Challenge a friend" link: a strip across the top of that game saying what to beat.
 * It stays until it's closed; the friend's result shows again on the finish card.
 */
export function ChallengeBanner({ screen }: { screen: string }) {
  const [open, setOpen] = useState(true);
  const c = arrivedChallenge();
  const game = c && GAMES.find((g) => g.id === c.game);
  if (!open || !c || !game || c.game !== screen) return null;
  return (
    <div role="status" className="relative z-10 flex items-center gap-3 border-b border-ink/40 bg-board/95 px-4 py-2.5 backdrop-blur-sm">
      <Swords className="h-4 w-4 shrink-0 text-ink" />
      <p className="min-w-0 flex-1 text-[14px] leading-snug text-paint">
        {t("A friend got {value} on today's {game}. Can you beat it?", { value: c.value, game: game.name })}
      </p>
      <button
        onClick={() => {
          dismissChallenge();
          setOpen(false);
        }}
        aria-label={t("Close")}
        className="-mr-2 grid h-8 w-8 shrink-0 place-items-center text-[20px] leading-none text-steel hover:text-paint"
      >
        ×
      </button>
    </div>
  );
}
