import {
  ArrowCounterClockwise,
  ArrowDown,
  ArrowUp,
  ArrowLineLeft,
  ArrowLineRight,
  CaretDown,
  CaretLeft,
  CaretRight,
  CornersOut,
  FlagCheckered,
  type Icon,
  MapTrifold,
  Palette,
  Minus as PhMinus,
  Plus as PhPlus,
  ShareNetwork,
  SpeakerHigh,
  SpeakerSlash,
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
export const SoundOn = make(SpeakerHigh);
export const SoundOff = make(SpeakerSlash);
export const Share = make(ShareNetwork);
export const Undo = make(ArrowCounterClockwise);
export const ColourBlind = make(Palette);
export const Up = make(ArrowUp);
export const Down = make(ArrowDown);
export const Chequered = make(FlagCheckered);
