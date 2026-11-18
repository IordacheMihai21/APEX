import { GAMES, type GameId, game } from "../games/registry";
import { EXTRA_GUIDES, type ExtraGuideId, extraGuide } from "./extraGuides";

export type GuideId = GameId | ExtraGuideId;
export const ALL_GUIDES = [...GAMES, ...EXTRA_GUIDES];
export const guideFor = (id: GuideId) => extraGuide(id) ?? game(id as GameId);
