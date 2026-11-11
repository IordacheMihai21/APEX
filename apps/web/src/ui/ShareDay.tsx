import { useState } from "react";
import { dayShareReady, dayShareText } from "../games/dayShare";
import { shared } from "../games/events";
import { t } from "../i18n";
import { shareLink } from "../shareLink";
import { Share } from "./icons";
import { secondaryBtn } from "./styles";

/**
 * The phone's share sheet where there is one, else the clipboard. True when copied (to say so).
 * The result goes as text: the grid and the link arrive together everywhere, and chat apps draw the link's preview.
 * (Sent with a picture, many apps keep the picture and drop the text, and the link with it: see sharePicture.)
 */
export async function shareOrCopy(text: string): Promise<boolean> {
  if (navigator.share) {
    try {
      await navigator.share({ text });
      return false;
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return false; // share sheet dismissed
      // no share sheet after all (a desktop browser without a share target): copy instead
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Whether this device can share a picture (a phone's share sheet with files). */
export function canSharePicture(): boolean {
  try {
    return typeof navigator !== "undefined" && !!navigator.canShare && navigator.canShare({ files: [new File([new Uint8Array(1)], "x.png", { type: "image/png" })] });
  } catch {
    return false;
  }
}

/**
 * The result card as a picture, for stories and feeds. The text goes with it where the app keeps it, and is copied
 * first, so the link can be pasted where the app drops it. True when the picture was handed to the share sheet.
 */
export async function sharePicture(text: string, image: Blob, name = "lapdle.png"): Promise<boolean> {
  // not awaited: the share sheet must open within the same tap (iOS drops it after an await)
  navigator.clipboard?.writeText(text).catch(() => {});
  try {
    const file = new File([image], name, { type: "image/png" });
    if (!navigator.canShare?.({ files: [file] })) return false;
    await navigator.share({ files: [file], text });
    return true;
  } catch {
    return false;
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
