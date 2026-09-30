/**
 * Seven-segment digits with ghost segments: unlit segments are drawn too, faintly,
 * as on real timing displays. Supports 0-9, "-", ":", "." and " ".
 */
const SEG: Record<string, string> = {
  "0": "abcdef",
  "1": "bc",
  "2": "abged",
  "3": "abgcd",
  "4": "fgbc",
  "5": "afgcd",
  "6": "afgedc",
  "7": "abc",
  "8": "abcdefg",
  "9": "abfgcd",
  "-": "g",
  " ": "",
};

// segment polygons in a 10 × 18 cell
const POLY: Record<string, string> = {
  a: "2,1 8,1 7,2.6 3,2.6",
  b: "8.4,1.4 9,2 9,8.2 8.4,8.8 7.4,7.8 7.4,2.4",
  c: "8.4,9.2 9,9.8 9,16 8.4,16.6 7.4,15.6 7.4,10.2",
  d: "2,17 8,17 7,15.4 3,15.4",
  e: "1.6,9.2 1,9.8 1,16 1.6,16.6 2.6,15.6 2.6,10.2",
  f: "1.6,1.4 1,2 1,8.2 1.6,8.8 2.6,7.8 2.6,2.4",
  g: "2.2,9 3,8.2 7,8.2 7.8,9 7,9.8 3,9.8",
};

export function Segments({ text, className = "", color = "currentColor", ghost = 0.1 }: { text: string; className?: string; color?: string; ghost?: number }) {
  const cells: { ch: string; w: number }[] = [...text].map((ch) => ({ ch, w: ch === ":" || ch === "." ? 4 : 11 }));
  const width = cells.reduce((a, c) => a + c.w, 0);
  let x = 0;
  return (
    <svg viewBox={`0 0 ${width} 18`} className={className} role="img" aria-label={text} style={{ overflow: "visible" }}>
      <g transform="skewX(-6) translate(1 0)">
        {cells.map(({ ch, w }, i) => {
          const ox = x;
          x += w;
          if (ch === ":")
            return (
              <g key={i} fill={color}>
                <rect x={ox + 1.2} y={5.2} width={1.6} height={1.6} />
                <rect x={ox + 1.2} y={11.2} width={1.6} height={1.6} />
              </g>
            );
          if (ch === ".") return <rect key={i} x={ox + 1.2} y={15.4} width={1.6} height={1.6} fill={color} />;
          const on = SEG[ch] ?? "";
          return (
            <g key={i} transform={`translate(${ox} 0)`}>
              {Object.entries(POLY).map(([k, pts]) => (
                <polygon key={k} points={pts} fill={color} opacity={on.includes(k) ? 1 : ghost} />
              ))}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
