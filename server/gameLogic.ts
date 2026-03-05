import type { Room, Player } from "../shared/types.js";

export function getVoicePlayers(room: Room): Player[] {
  return room.players.filter((p) => p.role === "voice");
}

export function getGM(room: Room): Player | undefined {
  return room.players.find((p) => p.role === "gm");
}
