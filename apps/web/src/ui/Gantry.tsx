/**
 * The five-light start gantry. Each pod carries two red lamps; unlit lamps stay
 * visible as dark glass. `lit` = number of pods on (0–5). `sequence` snaps
 * the lit pods on one by one when it mounts, the start procedure in miniature.
 */
export function Gantry({ lit, size = "md", label, sequence = false }: { lit: number; size?: "sm" | "md" | "lg"; label?: string; sequence?: boolean }) {
  const lamp = size === "lg" ? "h-9 w-9" : size === "md" ? "h-6 w-6" : "h-4 w-4";
  const gap = size === "lg" ? "gap-3" : "gap-2";
  return (
    <div className={`flex justify-center ${gap}`} role="img" aria-label={label ?? `${lit} of 5 start lights on`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex flex-col gap-1.5 border border-line bg-[#060607] p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_6px_14px_rgba(0,0,0,0.5)]">
          {[0, 1].map((j) => (
            <span
              key={j}
              style={sequence && i < lit ? { animationDelay: `${180 + i * 220}ms` } : undefined}
              className={`${lamp} rounded-full ${sequence && i < lit ? "lamp-seq" : ""} ${
                i < lit
                  ? "bg-[radial-gradient(circle_at_40%_35%,#ffb3a8_0%,#ff2b1a_38%,#9e0f06_100%)] shadow-[0_0_6px_1px_rgba(255,40,20,0.45)]"
                  : "bg-[radial-gradient(circle_at_40%_35%,#2a1412_0%,#150808_60%,#0b0404_100%)]"
              }`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
