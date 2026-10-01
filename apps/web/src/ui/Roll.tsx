import { useEffect, useState } from "react";

const DIGITS = "0123456789";

/**
 * Text whose figures roll into place like a timing screen: every digit is a
 * strip of 0–9 that spins to its value, left to right with a short stagger.
 * It mounts on zeros and rolls once; later changes roll from the old value.
 * Non-digits (colons, points, signs) sit still.
 */
export function Roll({ text, className = "", stagger = 45 }: { text: string; className?: string; stagger?: number }) {
  const [shown, setShown] = useState(() => text.replace(/\d/g, "0"));
  useEffect(() => {
    // two frames so the zeros paint before the strips start moving
    let b = 0;
    const a = requestAnimationFrame(() => (b = requestAnimationFrame(() => setShown(text))));
    return () => {
      cancelAnimationFrame(a);
      cancelAnimationFrame(b);
    };
  }, [text]);

  let col = 0;
  return (
    <span className={`roll num ${className}`} role="text" aria-label={text}>
      {[...shown].map((ch, i) => {
        if (!DIGITS.includes(ch)) {
          return (
            <span key={i} aria-hidden="true" className="leading-none">
              {ch}
            </span>
          );
        }
        const delay = col++ * stagger;
        return (
          <span key={i} aria-hidden="true" className="roll-col">
            <span className="roll-strip" style={{ transform: `translateY(${-Number(ch)}em)`, transitionDelay: `${delay}ms` }}>
              {[...DIGITS].map((d) => (
                <span key={d}>{d}</span>
              ))}
            </span>
          </span>
        );
      })}
    </span>
  );
}
