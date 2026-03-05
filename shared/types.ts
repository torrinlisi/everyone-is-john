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

export interface Room {
  id: string;
  playerCount: number;
  players: Player[];
  currentController: string | null;
  status: "lobby" | "playing";
  settings: RoomSettings;
  biddingPhase: boolean;
  bids: Record<string, number>;
}

export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  rerollGoalOnComplete: true,
  rerollSkillsOnComplete: false,
  wpRechargePerRound: 3,
  wpCapEnabled: true,
  wpCap: 10,
};

export const WILLPOWER_COMBOS = {
  2: 10,
  3: 7,
} as const;
