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

function getClientAddress(socket: { handshake: { address: string; headers?: Record<string, string | string[] | undefined> } }): string {
  const forwarded = socket.handshake.headers?.["x-forwarded-for"];
  if (forwarded) {
    const first = typeof forwarded === "string" ? forwarded.split(",")[0] : forwarded[0];
    return first?.trim() ?? socket.handshake.address;
  }
  return socket.handshake.address;
}

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

function pickRandomGoal(room: Room, excludePlayerId?: string): Goal {
  const allGoals = getGoals();
  let goals = allGoals;
  if (!room.settings.allowDuplicateGoals) {
    const assignedIds = new Set(
      room.players
        .filter((p) => p.role === "voice" && p.id !== excludePlayerId && p.goal)
        .map((p) => p.goal!.id)
    );
    goals = allGoals.filter((g) => !assignedIds.has(g.id));
    if (goals.length === 0) goals = allGoals;
  }
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
    settingsConfirmed: false,
    biddingPhase: false,
    bids: {},
    bidOffPlayers: null,
    bidOffSubmitted: {},
    skillCheckThreshold: null,
    skillCheckResult: null,
    kickedAddresses: [],
  };
  rooms.set(roomId, room);
  return { roomId, player: gm };
}

export function joinRoom(
  roomId: string,
  playerName: string,
  skillIds: string[],
  willpowerCombo: 2 | 3,
  goalData?: { goalId?: string; customText?: string; customDifficulty?: number; random?: boolean }
): { player: Player; room: Room } | { error: string } {
  const room = rooms.get(roomId);
  if (!room) return { error: "Room not found" };
  if (room.players.length >= room.playerCount + 1)
    return { error: "Room is full" };

  const skillsData = getSkills();
  const skills = skillIds
    .map((id) => skillsData.find((s) => s.id === id))
    .filter((s): s is Skill => s != null);

  if (skills.length !== willpowerCombo)
    return { error: `Must select exactly ${willpowerCombo} skills` };

  const willpower = WILLPOWER_COMBOS[willpowerCombo];
  const needsGoalChoice = (room.settings.allowGoalChoice ?? false) || (room.settings.allowCustomGoal ?? false);
  let goal: Goal | null;
  if (needsGoalChoice && goalData) {
    if (goalData.goalId && (room.settings.allowGoalChoice ?? false)) {
      const goals = getGoals();
      const found = goals.find((g) => g.id === goalData.goalId);
      if (!found) return { error: "Invalid goal" };
      if (!(room.settings.allowDuplicateGoals ?? true)) {
        const taken = room.players.some((p) => p.role === "voice" && p.goal?.id === goalData.goalId);
        if (taken) return { error: "That goal is already taken" };
      }
      goal = found;
    } else if (goalData.customText?.trim() && (room.settings.allowCustomGoal ?? false)) {
      const diff = Math.max(1, Math.min(3, Math.floor(Number(goalData.customDifficulty)) || 1));
      goal = { id: "custom-" + randomBytes(4).toString("hex"), text: goalData.customText.trim(), difficulty: diff };
    } else if (goalData.random) {
      goal = pickRandomGoal(room);
    } else {
      return { error: "Goal selection required" };
    }
  } else if (needsGoalChoice) {
    return { error: "Goal selection required" };
  } else {
    goal = pickRandomGoal(room);
  }

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
  const needsGoalChoice = room.settings.allowGoalChoice || room.settings.allowCustomGoal;
  if (needsGoalChoice) {
    player.goal = null;
    return null;
  }
  const goal = pickRandomGoal(room, playerId);
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
    playerCountCurrent: room.players.filter((p) => p.role === "voice").length,
    settingsConfirmed: room.settingsConfirmed ?? false,
    status: room.status,
    settings: room.settings,
    players: room.players,
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
      goalId?: string;
      customText?: string;
      customDifficulty?: number;
      random?: boolean;
    }) => {
      const { roomId, playerName, skillIds, willpowerCombo, goalId, customText, customDifficulty, random } = data;
      const goalData = goalId != null || customText != null || customDifficulty != null || random
        ? { goalId, customText, customDifficulty, random }
        : undefined;
      const existingRoom = getRoom(roomId);
      if (existingRoom) {
        const addr = getClientAddress(socket);
        const kickedAddrs = existingRoom.kickedAddresses ?? [];
        if (kickedAddrs.includes(addr)) {
          socket.emit("error", { message: "You have been kicked from this game and cannot rejoin" });
          return;
        }
        if (!(existingRoom.settingsConfirmed ?? false)) {
          socket.emit("error", { message: "GM has not confirmed settings yet" });
          return;
        }
      }
      const result = joinRoom(roomId, playerName, skillIds, willpowerCombo, goalData);
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
      if (player.goal) io.to(`player:${player.id}`).emit("goal-assigned", { goal: player.goal });
    });

    socket.on("rejoin", (data: { roomId: string; playerId: string }) => {
      const { roomId, playerId } = data;
      const room = getRoom(roomId);
      if (!room) {
        socket.emit("error", { message: "Room not found" });
        return;
      }
      const addr = getClientAddress(socket);
      const kickedAddrs = room.kickedAddresses ?? [];
      if (kickedAddrs.includes(addr)) {
        socket.emit("error", { message: "You have been kicked from this game and cannot rejoin" });
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

    socket.on("confirm-settings", () => {
      const meta = socket as unknown as { roomId?: string; playerId?: string };
      if (!meta.roomId || !meta.playerId) return;
      const room = getRoom(meta.roomId);
      if (!room || room.status !== "lobby") return;
      const gm = room.players.find((p) => p.id === meta.playerId && p.role === "gm");
      if (!gm) {
        socket.emit("error", { message: "Only GM can confirm settings" });
        return;
      }
      room.settingsConfirmed = true;
      io.to(meta.roomId).emit("room-update", room);
    });

    socket.on("reroll-goal-for-player", (data: { playerId: string }) => {
      const meta = socket as unknown as { roomId?: string; playerId?: string };
      if (!meta.roomId || !meta.playerId) return;
      const room = getRoom(meta.roomId);
      if (!room) return;
      const gm = room.players.find((p) => p.id === meta.playerId && p.role === "gm");
      if (!gm) {
        socket.emit("error", { message: "Only GM can reroll goals" });
        return;
      }
      rerollGoalForPlayer(meta.roomId, data.playerId);
      const updatedRoom = getRoom(meta.roomId);
      if (updatedRoom) io.to(meta.roomId).emit("room-update", updatedRoom);
    });

    socket.on("submit-goal", (data: { goalId?: string; customText?: string; customDifficulty?: number; random?: boolean }) => {
      const meta = socket as unknown as { roomId?: string; playerId?: string };
      if (!meta.roomId || !meta.playerId) return;
      const room = getRoom(meta.roomId);
      if (!room) return;
      const player = room.players.find((p) => p.id === meta.playerId && p.role === "voice");
      if (!player || player.goal) return;
      const allowChoice = room.settings.allowGoalChoice ?? false;
      const allowCustom = room.settings.allowCustomGoal ?? false;
      let goal: Goal;
      if (data.goalId && allowChoice) {
        const goals = getGoals();
        const found = goals.find((g) => g.id === data.goalId);
        if (!found) {
          socket.emit("error", { message: "Invalid goal" });
          return;
        }
        if (!room.settings.allowDuplicateGoals) {
          const taken = room.players.some(
            (p) => p.role === "voice" && p.id !== meta.playerId && p.goal?.id === data.goalId
          );
          if (taken) {
            socket.emit("error", { message: "That goal is already taken" });
            return;
          }
        }
        goal = found;
      } else if (data.customText?.trim() && data.customDifficulty != null && allowCustom) {
        const diff = Math.max(1, Math.min(3, Math.floor(Number(data.customDifficulty)) || 1));
        goal = {
          id: "custom-" + randomBytes(4).toString("hex"),
          text: data.customText.trim(),
          difficulty: diff,
        };
      } else if (data.random === true && (allowChoice || allowCustom)) {
        goal = pickRandomGoal(room, meta.playerId);
      } else {
        socket.emit("error", { message: "Invalid goal selection" });
        return;
      }
      player.goal = goal;
      io.to(`player:${meta.playerId}`).emit("goal-assigned", { goal });
      io.to(meta.roomId).emit("room-update", room);
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
      if (voices.length < 2) {
        socket.emit("error", { message: "Need at least 2 players to start" });
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
      if (room.bidOffPlayers) {
        if (!room.bidOffPlayers.includes(meta.playerId)) return;
        const lastBid = room.bids[meta.playerId] ?? 0;
        if (amount < lastBid) return;
      }
      room.bids[meta.playerId] = amount;
      if (room.bidOffPlayers) {
        room.bidOffSubmitted = room.bidOffSubmitted || {};
        room.bidOffSubmitted[meta.playerId] = true;
      }
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
      const bidders = room.bidOffPlayers ?? voices.map((v) => v.id);
      const allBid = bidders.every((id) => id in room.bids);
      if (!allBid) {
        socket.emit("error", { message: "All players must bid first" });
        return;
      }
      if (room.bidOffPlayers) {
        const allSubmitted = room.bidOffPlayers.every((id) => room.bidOffSubmitted?.[id]);
        if (!allSubmitted) {
          socket.emit("error", { message: "All tied players must submit their bid" });
          return;
        }
      }
      let highestBid = 0;
      const tied: string[] = [];
      for (const id of bidders) {
        const bid = room.bids[id] ?? 0;
        if (bid > highestBid) {
          highestBid = bid;
          tied.length = 0;
          tied.push(id);
        } else if (bid === highestBid && bid > 0) {
          tied.push(id);
        }
      }
      if (tied.length === 0) return;
      if (tied.length > 1) {
        room.bidOffPlayers = tied;
        room.bidOffSubmitted = {};
        io.to(meta.roomId).emit("room-update", room);
        return;
      }
      const winnerId = tied[0];
      const winner = room.players.find((p) => p.id === winnerId)!;
      winner.willpower -= room.bids[winnerId] ?? 0;
      room.currentController = winnerId;
      room.biddingPhase = false;
      room.bids = {};
      room.bidOffPlayers = null;
      room.bidOffSubmitted = {};
      room.skillCheckThreshold = null;
      room.skillCheckResult = null;

      const recharge = room.settings.wpRechargePerRound ?? 0;
      const cap = room.settings.wpCapEnabled ? Infinity : (room.settings.wpCap ?? 10);
      for (const p of voices) {
        p.willpower = Math.min(p.willpower + recharge, cap);
      }

      io.to(meta.roomId).emit("room-update", room);
      io.to(meta.roomId).emit("control-changed", { controllerId: winnerId });
    });

    socket.on("give-control-to-player", (data: { targetPlayerId: string }) => {
      const meta = socket as unknown as { roomId?: string; playerId?: string };
      if (!meta.roomId || !meta.playerId) return;
      const room = getRoom(meta.roomId);
      if (!room || room.status !== "playing" || !room.biddingPhase) return;
      const gm = room.players.find((p) => p.id === meta.playerId && p.role === "gm");
      if (!gm) {
        socket.emit("error", { message: "Only GM can give control" });
        return;
      }
      const target = room.players.find((p) => p.id === data.targetPlayerId && p.role === "voice");
      if (!target) return;
      const voices = room.players.filter((p) => p.role === "voice");
      const bidAmount = room.bids[data.targetPlayerId] ?? 0;
      target.willpower -= bidAmount;
      room.currentController = data.targetPlayerId;
      room.biddingPhase = false;
      room.bids = {};
      room.bidOffPlayers = null;
      room.bidOffSubmitted = {};
      room.skillCheckThreshold = null;
      room.skillCheckResult = null;

      const recharge = room.settings.wpRechargePerRound ?? 0;
      const cap = room.settings.wpCapEnabled ? Infinity : (room.settings.wpCap ?? 10);
      for (const p of voices) {
        p.willpower = Math.min(p.willpower + recharge, cap);
      }

      io.to(meta.roomId).emit("room-update", room);
      io.to(meta.roomId).emit("control-changed", { controllerId: data.targetPlayerId });
    });

    socket.on("kick-player", async (data: { playerId: string }) => {
      const meta = socket as unknown as { roomId?: string; playerId?: string };
      if (!meta.roomId || !meta.playerId) return;
      const room = getRoom(meta.roomId);
      if (!room) return;
      const gm = room.players.find((p) => p.id === meta.playerId && p.role === "gm");
      if (!gm) {
        socket.emit("error", { message: "Only GM can kick players" });
        return;
      }
      const target = room.players.find((p) => p.id === data.playerId && p.role === "voice");
      if (!target) return;
      const socketsInRoom = await io.in(meta.roomId).fetchSockets();
      const kickedSocket = socketsInRoom.find(
        (s) => (s as unknown as { playerId?: string }).playerId === data.playerId
      );
      if (kickedSocket) {
        room.kickedAddresses = room.kickedAddresses ?? [];
        room.kickedAddresses.push(getClientAddress(kickedSocket));
      }
      room.players = room.players.filter((p) => p.id !== data.playerId);
      if (room.currentController === data.playerId) {
        room.currentController = null;
      }
      io.to(`player:${data.playerId}`).emit("kicked", {});
      io.to(meta.roomId).emit("room-update", room);
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
      room.bidOffPlayers = null;
      room.bidOffSubmitted = {};
      room.currentController = null;
      room.skillCheckThreshold = null;
      room.skillCheckResult = null;
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
        const needsGoalChoice = (room.settings.allowGoalChoice ?? false) || (room.settings.allowCustomGoal ?? false);
        if (needsGoalChoice) {
          targetPlayer.goal = null;
        } else {
          targetPlayer.goal = pickRandomGoal(room, data.playerId);
          io.to(`player:${data.playerId}`).emit("goal-assigned", { goal: targetPlayer.goal });
        }
      } else {
        targetPlayer.goal = null;
      }

      if (room.settings.rerollSkillsOnComplete) {
        targetPlayer.skills = [];
        io.to(`player:${data.playerId}`).emit("reroll-skills-required", {});
      }

      room.biddingPhase = true;
      room.bids = {};
      room.bidOffPlayers = null;
      room.bidOffSubmitted = {};
      room.currentController = null;
      room.skillCheckThreshold = null;
      room.skillCheckResult = null;

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
      room.settingsConfirmed = false;
      room.biddingPhase = false;
      room.bids = {};
      room.bidOffPlayers = null;
      room.bidOffSubmitted = {};
      room.currentController = null;
      room.skillCheckThreshold = null;
      room.skillCheckResult = null;
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
      const needsGoalChoice = (room.settings.allowGoalChoice ?? false) || (room.settings.allowCustomGoal ?? false);
      player.goal = needsGoalChoice ? null : pickRandomGoal(room, playerId);
      io.to(roomId).emit("room-update", room);
      socket.emit("reselect-skills-done", { player, room });
      if (player.goal) io.to(`player:${playerId}`).emit("goal-assigned", { goal: player.goal });
    });

    socket.on("set-skill-check-threshold", (data: { roomId: string; playerId: string; threshold: number }) => {
      const { roomId, playerId, threshold } = data;
      if (!roomId || !playerId || threshold < 1 || threshold > 6) return;
      const room = getRoom(roomId);
      if (!room || room.status !== "playing" || room.biddingPhase) return;
      const gm = room.players.find((p) => p.id === playerId && p.role === "gm");
      if (!gm) return;
      if (!room.currentController) return;
      room.skillCheckThreshold = threshold;
      room.skillCheckResult = null;
      io.to(roomId).emit("room-update", room);
    });

    socket.on("roll-skill-check", (data: { roomId: string; playerId: string }) => {
      const { roomId, playerId } = data;
      if (!roomId || !playerId) return;
      const room = getRoom(roomId);
      if (!room || room.status !== "playing" || room.biddingPhase) return;
      if (room.currentController !== playerId) return;
      if (room.skillCheckThreshold == null) return;
      const value = Math.floor(Math.random() * 6) + 1;
      room.skillCheckResult = { playerId, value };
      io.to(roomId).emit("room-update", room);
    });

    socket.on("clear-skill-check", (data: { roomId: string; playerId: string }) => {
      const { roomId, playerId } = data;
      if (!roomId || !playerId) return;
      const room = getRoom(roomId);
      if (!room) return;
      const gm = room.players.find((p) => p.id === playerId && p.role === "gm");
      if (!gm) return;
      room.skillCheckThreshold = null;
      room.skillCheckResult = null;
      io.to(roomId).emit("room-update", room);
    });
  });
}
