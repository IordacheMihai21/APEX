/** Small stroked icon set (24×24 grid, 2px stroke, round caps) so every control shares one weight. */
type IconProps = { className?: string };

function Svg({ className = "h-[18px] w-[18px]", children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      {children}
    </svg>
  );
}

export const ChevronLeft = (p: IconProps) => (
  <Svg {...p}>
    <path d="M15 5l-7 7 7 7" />
  </Svg>
);
export const ChevronRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 5l7 7-7 7" />
  </Svg>
);
export const ChevronDown = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 9l6 6 6-6" />
  </Svg>
);
export const Plus = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);
export const Minus = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 12h14" />
  </Svg>
);
/** Nudge: a small arrow pushing against a kerb line. */
export const NudgeLeft = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 5v14M19 12H9M13 8l-4 4 4 4" />
  </Svg>
);
export const NudgeRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="M19 5v14M5 12h10M11 8l4 4-4 4" />
  </Svg>
);
export const Frame = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4" />
    <circle cx="12" cy="12" r="2.2" />
  </Svg>
);
export const WholeTrack = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 18c-2.5 0-3.5-2-3-4l2-7c.6-2 3-2.6 4.3-1l2.4 3c.8 1 2.3 1 3.1 0l.7-.9c1.4-1.8 4.3-.6 4 1.7L20 14c-.3 2.4-2 4-4.3 4z" />
  </Svg>
);
export const SoundOn = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 10v4h4l5 4V6L8 10H4z" />
    <path d="M16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12" />
  </Svg>
);
export const SoundOff = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 10v4h4l5 4V6L8 10H4z" />
    <path d="M17 9l5 6M22 9l-5 6" />
  </Svg>
);
export const Share = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3v12M7 8l5-5 5 5" />
    <path d="M5 13v6h14v-6" />
  </Svg>
);
export const Undo = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 14L4 9l5-5" />
    <path d="M4 9h10.5a5.5 5.5 0 010 11H11" />
  </Svg>
);
