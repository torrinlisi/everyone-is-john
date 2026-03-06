export interface Goal {
  id: string;
  text: string;
  difficulty: number;
}

export interface Skill {
  id: string;
  text: string;
}

export interface RoomSettings {
  rerollGoalOnComplete: boolean;
  rerollSkillsOnComplete: boolean;
  wpRechargePerRound: number;
  wpCapEnabled: boolean;
  wpCap: number;
  allowCustomGoal: boolean;
  allowGoalChoice: boolean;
  allowDuplicateGoals: boolean;
}

export type PlayerRole = "gm" | "voice";

export interface Player {
  id: string;
  name: string;
  role: PlayerRole;
  skills: Skill[];
  goal: Goal | null;
  willpower: number;
  score: number;
}

export interface SkillCheckResult {
  playerId: string;
  value: number;
}

export interface Room {
  id: string;
  playerCount: number;
  players: Player[];
  currentController: string | null;
  status: "lobby" | "playing";
  settings: RoomSettings;
  settingsConfirmed: boolean;
  biddingPhase: boolean;
  bids: Record<string, number>;
  bidOffPlayers: string[] | null;
  bidOffSubmitted: Record<string, boolean>;
  skillCheckThreshold: number | null;
  skillCheckResult: SkillCheckResult | null;
  kickedAddresses: string[];
}

export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  rerollGoalOnComplete: true,
  rerollSkillsOnComplete: false,
  wpRechargePerRound: 3,
  wpCapEnabled: true,
  wpCap: 10,
  allowCustomGoal: false,
  allowGoalChoice: false,
  allowDuplicateGoals: true,
};

export const WILLPOWER_COMBOS = {
  2: 10,
  3: 7,
} as const;
