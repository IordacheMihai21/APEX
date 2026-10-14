import {
  ArrowCounterClockwise,
  ArrowDown,
  ArrowUp,
  ArrowLineLeft,
  ArrowLineRight,
  ArrowsDownUp,
  CaretDown,
  CaretLeft,
  CaretRight,
  CloudRain,
  CornersOut,
  FlagCheckered,
  Gauge,
  type Icon,
  MapTrifold,
  Palette,
  Question,
  Minus as PhMinus,
  Plus as PhPlus,
  ShareNetwork,
  SteeringWheel,
  Wind,
  Wrench,
} from "@phosphor-icons/react";

/** The control icons: Phosphor, bold weight throughout so every control shares one stroke. */
type IconProps = { className?: string };

const make = (I: Icon) => {
  const C = ({ className = "h-[18px] w-[18px]" }: IconProps) => <I weight="bold" className={className} aria-hidden="true" />;
  return C;
};

export const ChevronLeft = make(CaretLeft);
export const ChevronRight = make(CaretRight);
export const ChevronDown = make(CaretDown);
export const Plus = make(PhPlus);
export const Minus = make(PhMinus);
export const NudgeLeft = make(ArrowLineLeft);
export const NudgeRight = make(ArrowLineRight);
export const Frame = make(CornersOut);
export const WholeTrack = make(MapTrifold);
export const Share = make(ShareNetwork);
export const Undo = make(ArrowCounterClockwise);
export const ColourBlind = make(Palette);
export const Up = make(ArrowUp);
export const Down = make(ArrowDown);
export const Chequered = make(FlagCheckered);
export const Rain = make(CloudRain);
export const LowDownforce = make(Wind);

/** One mark per daily game, for the Today bar before the game is played. */
export const GameMarks = {
  quali: make(SteeringWheel),
  mystery: make(Question),
  "pit-stop": make(Wrench),
  "higher-lower": make(ArrowsDownUp),
  "braking-point": make(Gauge),
} as const;
