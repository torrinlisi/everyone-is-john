import { Router } from "express";
import { Server } from "socket.io";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { randomBytes } from "crypto";
import type {
  Room,
  Player,
  Goal,
  Skill,
  RoomSettings,
} from "../shared/types.js";
import { DEFAULT_ROOM_SETTINGS, WILLPOWER_COMBOS } from "../shared/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, "..", "data");

const rooms = new Map<string, Room>();

function loadJson<T>(filename: string): T {
  const content = readFileSync(path.join(DATA_PATH, filename), "utf-8");
  return JSON.parse(content) as T;
}

export function getGoals(): Goal[] {
  return loadJson<Goal[]>("goals.json");
}

export function getSkills(): Skill[] {
  return loadJson<Skill[]>("skills.json");
}

function generateRoomId(): string {
  return randomBytes(3).toString("hex");
}

function pickRandomGoal(): Goal {
  const goals = getGoals();
  return goals[Math.floor(Math.random() * goals.length)];
}

export function createRoom(
  playerName: string,
  playerCount: number
): { roomId: string; player: Player } {
  const roomId = generateRoomId();
  const gm: Player = {
    id: randomBytes(8).toString("hex"),
    name: playerName,
    role: "gm",
    skills: [],
    goal: null,
    willpower: 0,
    score: 0,
  };
  const room: Room = {
    id: roomId,
    playerCount,
    players: [gm],
    currentController: null,
    status: "lobby",
    settings: { ...DEFAULT_ROOM_SETTINGS },
    biddingPhase: false,
    bids: {},
  };
  rooms.set(roomId, room);
  return { roomId, player: gm };
}

export function joinRoom(
  roomId: string,
  playerName: string,
  skillIds: string[],
  willpowerCombo: 2 | 3
): { player: Player; room: Room } | { error: string } {
  const room = rooms.get(roomId);
  if (!room) return { error: "Room not found" };
  if (room.players.length >= room.playerCount)
    return { error: "Room is full" };

  const skillsData = getSkills();
  const skills = skillIds
    .map((id) => skillsData.find((s) => s.id === id))
    .filter((s): s is Skill => s != null);

  if (skills.length !== willpowerCombo)
    return { error: `Must select exactly ${willpowerCombo} skills` };

  const willpower = WILLPOWER_COMBOS[willpowerCombo];
  const goal = pickRandomGoal();

  const player: Player = {
    id: randomBytes(8).toString("hex"),
    name: playerName,
    role: "voice",
    skills,
    goal,
    willpower,
    score: 0,
  };

  room.players.push(player);
  return { player, room };
}

export function getRoom(roomId: string): Room | undefined {
  return rooms.get(roomId);
}

export function updateRoomSettings(
  roomId: string,
  gmPlayerId: string,
  settings: Partial<RoomSettings>
): boolean {
  const room = rooms.get(roomId);
  if (!room) return false;
  const gm = room.players.find((p) => p.id === gmPlayerId && p.role === "gm");
  if (!gm) return false;
  room.settings = { ...room.settings, ...settings };
  return true;
}

export function rerollGoalForPlayer(roomId: string, playerId: string): Goal | null {
  const room = rooms.get(roomId);
  if (!room) return null;
  const player = room.players.find((p) => p.id === playerId && p.role === "voice");
  if (!player) return null;
  const goal = pickRandomGoal();
  player.goal = goal;
  return goal;
}

export const goalsRouter = Router();
export const skillsRouter = Router();
export const roomRouter = Router();

goalsRouter.get("/", (_req, res) => {
  res.json(getGoals());
});

skillsRouter.get("/", (_req, res) => {
  res.json(getSkills());
});

roomRouter.get("/:id", (req, res) => {
  const room = getRoom(req.params.id);
  if (!room) return res.status(404).json({ error: "Room not found" });
  res.json({
    id: room.id,
    playerCount: room.playerCount,
    playerCountCurrent: room.players.length,
    status: room.status,
  });
});

export function setupSocketHandlers(io: Server): void {
  io.on("connection", (socket) => {
    socket.on("create-room", (data: { playerName: string; playerCount: number }) => {
      const { playerName, playerCount } = data;
      if (!playerName || typeof playerCount !== "number" || playerCount < 2) {
        socket.emit("error", { message: "Invalid create-room data" });
        return;
      }
      const { roomId, player } = createRoom(playerName, playerCount);
      socket.join(roomId);
      socket.join(`player:${player.id}`);
      (socket as unknown as { roomId?: string; playerId?: string }).roomId = roomId;
      (socket as unknown as { roomId?: string; playerId?: string }).playerId = player.id;
      socket.emit("room-created", { roomId, player });
      const room = getRoom(roomId)!;
      io.to(roomId).emit("room-update", room);
    });

    socket.on("join-room", (data: {
      roomId: string;
      playerName: string;
      skillIds: string[];
      willpowerCombo: 2 | 3;
    }) => {
      const { roomId, playerName, skillIds, willpowerCombo } = data;
      const result = joinRoom(roomId, playerName, skillIds, willpowerCombo);
      if ("error" in result) {
        socket.emit("error", { message: result.error });
        return;
      }
      const { player, room } = result;
      socket.join(roomId);
      socket.join(`player:${player.id}`);
      (socket as unknown as { roomId?: string; playerId?: string }).roomId = roomId;
      (socket as unknown as { roomId?: string; playerId?: string }).playerId = player.id;
      socket.emit("joined-room", { player, room });
      io.to(roomId).emit("room-update", room);
      io.to(`player:${player.id}`).emit("goal-assigned", { goal: player.goal });
    });

    socket.on("rejoin", (data: { roomId: string; playerId: string }) => {
      const { roomId, playerId } = data;
      const room = getRoom(roomId);
      if (!room) {
        socket.emit("error", { message: "Room not found" });
        return;
      }
      const player = room.players.find((p) => p.id === playerId);
      if (!player) {
        socket.emit("error", { message: "Player not found in room" });
        return;
      }
      socket.join(roomId);
      socket.join(`player:${playerId}`);
      (socket as unknown as { roomId?: string; playerId?: string }).roomId = roomId;
      (socket as unknown as { roomId?: string; playerId?: string }).playerId = playerId;
      socket.emit("rejoined", { player, room });
      io.to(roomId).emit("room-update", room);
      if (player.goal) {
        io.to(`player:${playerId}`).emit("goal-assigned", { goal: player.goal });
      }
    });

    socket.on("transfer-gm", (data: { roomId: string; playerId: string; newGmPlayerId: string }) => {
      const { roomId, playerId } = data;
      if (!roomId || !playerId) return;
      const room = getRoom(roomId);
      if (!room || room.status !== "lobby") return;
      const currentGm = room.players.find((p) => p.id === playerId && p.role === "gm");
      const newGm = room.players.find((p) => p.id === data.newGmPlayerId && p.role === "voice");
      if (!currentGm || !newGm) {
        socket.emit("error", { message: "Invalid transfer" });
        return;
      }
      currentGm.role = "voice";
      currentGm.skills = [];
      currentGm.goal = null;
      currentGm.willpower = 0;
      currentGm.score = 0;
      newGm.role = "gm";
      newGm.skills = [];
      newGm.goal = null;
      newGm.willpower = 0;
      newGm.score = 0;
      io.to(roomId).emit("room-update", room);
    });

    socket.on("update-settings", (data: Partial<RoomSettings>) => {
      const meta = socket as unknown as { roomId?: string; playerId?: string };
      if (!meta.roomId || !meta.playerId) return;
      const ok = updateRoomSettings(meta.roomId, meta.playerId, data);
      if (!ok) {
        socket.emit("error", { message: "Only GM can update settings" });
        return;
      }
      const room = getRoom(meta.roomId);
      if (room) io.to(meta.roomId).emit("room-update", room);
    });

    socket.on("reroll-goal", () => {
      const meta = socket as unknown as { roomId?: string; playerId?: string };
      if (!meta.roomId || !meta.playerId) return;
      const goal = rerollGoalForPlayer(meta.roomId, meta.playerId);
      if (goal) {
        io.to(`player:${meta.playerId}`).emit("goal-assigned", { goal });
        const room = getRoom(meta.roomId);
        if (room) io.to(meta.roomId).emit("room-update", room);
      }
    });

    socket.on("start-game", () => {
      const meta = socket as unknown as { roomId?: string; playerId?: string };
      if (!meta.roomId || !meta.playerId) return;
      const room = getRoom(meta.roomId);
      if (!room) return;
      const gm = room.players.find((p) => p.id === meta.playerId && p.role === "gm");
      if (!gm) {
        socket.emit("error", { message: "Only GM can start the game" });
        return;
      }
      const voices = room.players.filter((p) => p.role === "voice");
      if (voices.length === 0) {
        socket.emit("error", { message: "Need at least one Voice to start" });
        return;
      }
      room.status = "playing";
      room.biddingPhase = true;
      room.bids = {};
      room.currentController = null;
      io.to(meta.roomId).emit("room-update", room);
    });

    socket.on("bid", (data: { amount: number }) => {
      const meta = socket as unknown as { roomId?: string; playerId?: string };
      if (!meta.roomId || !meta.playerId) return;
      const room = getRoom(meta.roomId);
      if (!room || room.status !== "playing" || !room.biddingPhase) return;
      const player = room.players.find((p) => p.id === meta.playerId);
      if (!player || player.role !== "voice") return;
      const amount = Math.floor(Number(data?.amount)) || 0;
      if (amount < 1 || amount > player.willpower) return;
      room.bids[meta.playerId] = amount;
      io.to(meta.roomId).emit("room-update", room);
    });

    socket.on("give-control", () => {
      const meta = socket as unknown as { roomId?: string; playerId?: string };
      if (!meta.roomId || !meta.playerId) return;
      const room = getRoom(meta.roomId);
      if (!room || room.status !== "playing" || !room.biddingPhase) return;
      const gm = room.players.find((p) => p.id === meta.playerId && p.role === "gm");
      if (!gm) {
        socket.emit("error", { message: "Only GM can give control" });
        return;
      }
      const voices = room.players.filter((p) => p.role === "voice");
      const allBid = voices.every((v) => v.id in room.bids);
      if (!allBid) {
        socket.emit("error", { message: "All players must bid first" });
        return;
      }
      let highestId: string | null = null;
      let highestBid = 0;
      for (const v of voices) {
        const bid = room.bids[v.id] ?? 0;
        if (bid > highestBid) {
          highestBid = bid;
          highestId = v.id;
        }
      }
      if (!highestId) return;
      const winner = room.players.find((p) => p.id === highestId)!;
      winner.willpower -= highestBid;
      room.currentController = highestId;
      room.biddingPhase = false;
      room.bids = {};

      const recharge = room.settings.wpRechargePerRound ?? 0;
      const cap = room.settings.wpCapEnabled ? Infinity : (room.settings.wpCap ?? 10);
      for (const p of voices) {
        p.willpower = Math.min(p.willpower + recharge, cap);
      }

      io.to(meta.roomId).emit("room-update", room);
      io.to(meta.roomId).emit("control-changed", { controllerId: highestId });
    });

    socket.on("start-bidding", () => {
      const meta = socket as unknown as { roomId?: string; playerId?: string };
      if (!meta.roomId || !meta.playerId) return;
      const room = getRoom(meta.roomId);
      if (!room || room.status !== "playing") return;
      const gm = room.players.find((p) => p.id === meta.playerId && p.role === "gm");
      if (!gm) {
        socket.emit("error", { message: "Only GM can start bidding" });
        return;
      }
      room.biddingPhase = true;
      room.bids = {};
      room.currentController = null;
      io.to(meta.roomId).emit("room-update", room);
    });

    socket.on("complete-goal", (data: { playerId: string }) => {
      const meta = socket as unknown as { roomId?: string; playerId?: string };
      if (!meta.roomId || !meta.playerId) return;
      const room = getRoom(meta.roomId);
      if (!room) return;
      const gm = room.players.find((p) => p.id === meta.playerId && p.role === "gm");
      if (!gm) {
        socket.emit("error", { message: "Only GM can complete goals" });
        return;
      }
      const targetPlayer = room.players.find((p) => p.id === data.playerId && p.role === "voice");
      if (!targetPlayer || !targetPlayer.goal) return;
      targetPlayer.score += targetPlayer.goal.difficulty;

      if (room.settings.rerollGoalOnComplete) {
        targetPlayer.goal = pickRandomGoal();
        io.to(`player:${data.playerId}`).emit("goal-assigned", { goal: targetPlayer.goal });
      } else {
        targetPlayer.goal = null;
      }

      if (room.settings.rerollSkillsOnComplete) {
        targetPlayer.skills = [];
        io.to(`player:${data.playerId}`).emit("reroll-skills-required", {});
      }

      room.biddingPhase = true;
      room.bids = {};
      room.currentController = null;

      io.to(meta.roomId).emit("room-update", room);
    });

    socket.on("reset-game", () => {
      const meta = socket as unknown as { roomId?: string; playerId?: string };
      if (!meta.roomId || !meta.playerId) return;
      const room = getRoom(meta.roomId);
      if (!room) return;
      const gm = room.players.find((p) => p.id === meta.playerId && p.role === "gm");
      if (!gm) {
        socket.emit("error", { message: "Only GM can reset the game" });
        return;
      }
      room.status = "lobby";
      room.biddingPhase = false;
      room.bids = {};
      room.currentController = null;
      for (const p of room.players) {
        if (p.role === "voice") {
          p.skills = [];
          p.goal = null;
          p.willpower = 0;
          p.score = 0;
        }
      }
      io.to(meta.roomId).emit("room-update", room);
    });

    socket.on("reselect-skills", (data: { roomId: string; playerId: string; skillIds: string[]; willpowerCombo: 2 | 3 }) => {
      const { roomId, playerId, skillIds, willpowerCombo } = data;
      if (!roomId || !playerId) {
        socket.emit("error", { message: "Missing roomId or playerId" });
        return;
      }
      const room = getRoom(roomId);
      if (!room || room.status !== "lobby") {
        socket.emit("error", { message: "Room not found or not in lobby" });
        return;
      }
      const player = room.players.find((p) => p.id === playerId && p.role === "voice");
      if (!player || player.skills.length > 0) {
        socket.emit("error", { message: "Player not found or already has skills" });
        return;
      }
      const skillsData = getSkills();
      const skills = skillIds
        .map((id) => skillsData.find((s) => s.id === id))
        .filter((s): s is Skill => s != null);
      if (skills.length !== willpowerCombo) {
        socket.emit("error", { message: `Invalid skills: need ${willpowerCombo} valid skills` });
        return;
      }
      socket.join(roomId);
      socket.join(`player:${playerId}`);
      (socket as unknown as { roomId?: string; playerId?: string }).roomId = roomId;
      (socket as unknown as { roomId?: string; playerId?: string }).playerId = playerId;
      player.skills = skills;
      player.willpower = WILLPOWER_COMBOS[willpowerCombo];
      player.goal = pickRandomGoal();
      io.to(roomId).emit("room-update", room);
      socket.emit("reselect-skills-done", { player, room });
      io.to(`player:${playerId}`).emit("goal-assigned", { goal: player.goal });
    });
  });
}
