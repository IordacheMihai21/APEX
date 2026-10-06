import { todayProgress } from "../games/registry";
import { go } from "./FinishCard";
import { ChevronRight } from "./icons";
import { secondaryBtn } from "./styles";

/**
 * After a daily game: the next one of today's set still to play, as a
 * button, with how far through the set the player is. Nothing once the whole
 * set is done (the result says so itself).
 */
export function NextToday() {
  const { items, done, total } = todayProgress();
  const next = items.find((i) => i.status.state !== "done");
  if (!next) return null;
  return (
    <button className={`${secondaryBtn} gap-2`} onClick={() => go(next.game.id)}>
      <span className="num text-steel">
        {done}/{total}
      </span>
      Next: {next.game.name}
      <ChevronRight className="h-4 w-4" />
    </button>
  );
}
