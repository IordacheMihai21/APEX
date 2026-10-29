import { useState } from "react";
import { dayShareReady, dayShareText } from "../games/dayShare";
import { shared } from "../games/events";
import { t } from "../i18n";
import { shareLink } from "../shareLink";
import { Share } from "./icons";
import { secondaryBtn } from "./styles";

/** The phone's share sheet where there is one, else the clipboard. True when copied (to say so). */
export async function shareOrCopy(text: string): Promise<boolean> {
  try {
    if (navigator.share) {
      await navigator.share({ text });
      return false;
    }
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false; // share sheet dismissed
  }
}

/** "Share your day": the whole daily set in one share, once two games or more are done. */
export function ShareDayButton({ className = secondaryBtn }: { className?: string }) {
  const [copied, setCopied] = useState(false);
  if (!dayShareReady()) return null;
  const go = async () => {
    shared("day");
    if (await shareOrCopy(dayShareText(shareLink("/", "share-day")))) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };
  return (
    <button className={className} onClick={go}>
      <Share className="h-4 w-4" /> {copied ? t("Copied") : t("Share your day")}
    </button>
  );
}
