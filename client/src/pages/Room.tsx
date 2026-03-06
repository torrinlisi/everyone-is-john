import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSocket } from "../hooks/useSocket";
import PlayerList from "../components/PlayerList";
import GoalWheel from "../components/GoalWheel";
import GMSettingsPanel from "../components/GMSettingsPanel";
import SkillCheck from "../components/SkillCheck";
import SkillPicker from "../components/SkillPicker";
import GoalPicker from "../components/GoalPicker";
import { saveSession, getSession, clearSession } from "../utils/sessionStorage";
import type { Player } from "@shared/types";

type JoinStep = "name" | "goal" | "skills" | "ready";
type Mode = "host" | "join" | "rejoin";

export default function Room() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { socket, room, setRoom, error, setError, connected } = useSocket();

  const [mode, setMode] = useState<Mode | null>(null);
  const [joinStep, setJoinStep] = useState<JoinStep>("name");
  const [playerName, setPlayerName] = useState("");
  const [playerCount, setPlayerCount] = useState(4);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [willpowerCombo, setWillpowerCombo] = useState<2 | 3>(2);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [bidAmount, setBidAmount] = useState("");
  const [joinRoomInfo, setJoinRoomInfo] = useState<{
    settings: import("@shared/types").RoomSettings;
    players: import("@shared/types").Player[];
  } | null>(null);
  const [pendingGoal, setPendingGoal] = useState<{
    goalId?: string;
    customText?: string;
    customDifficulty?: number;
    random?: boolean;
  } | null>(null);

  const isNewRoom = roomId === "new";

  useEffect(() => {
    if (isNewRoom) {
      setMode("host");
      setJoinStep("name");
    } else if (roomId) {
      const session = getSession();
      if (session?.roomId === roomId && session?.playerId) {
        setMode("rejoin");
      } else {
        if (session?.roomId !== roomId) clearSession();
        setMode("join");
        setJoinStep("name");
      }
    }
  }, [roomId, isNewRoom]);

  useEffect(() => {
    if (room && currentPlayer) {
      const p = room.players.find((x) => x.id === currentPlayer.id);
      if (p) setCurrentPlayer(p);
    }
  }, [room]);

  useEffect(() => {
    if (
      currentPlayer?.role === "voice" &&
      room?.status === "lobby" &&
      currentPlayer.skills.length === 0
    ) {
      setSelectedSkills([]);
      setWillpowerCombo(2);
    }
  }, [room?.status, currentPlayer?.role, currentPlayer?.skills.length]);

  useEffect(() => {
    if (!socket || !connected || !roomId || roomId === "new" || mode !== "rejoin") return;
    const session = getSession();
    if (session?.roomId === roomId && session?.playerId) {
      setError(null);
      socket.emit("rejoin", { roomId: session.roomId, playerId: session.playerId });
    }
  }, [socket, connected, roomId, mode]);

  useEffect(() => {
    if (error && mode === "rejoin") {
      clearSession();
      setError(null);
      setMode("join");
    }
  }, [error, mode, setError]);

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!socket || !playerName.trim()) return;
    setError(null);
    socket.emit("create-room", {
      playerName: playerName.trim(),
      playerCount: Math.max(2, Math.min(8, playerCount)),
    });
  };

  useEffect(() => {
    if (!socket) return;
    socket.on("room-created", (data: { roomId: string; player: Player }) => {
      saveSession({ roomId: data.roomId, playerId: data.player.id });
      setCurrentPlayer(data.player);
      navigate(`/room/${data.roomId}`, { replace: true });
    });
    socket.on("joined-room", (data: { player: Player; room: unknown }) => {
      saveSession({ roomId: (data.room as { id: string }).id, playerId: data.player.id });
      setCurrentPlayer(data.player);
      setRoom(data.room as typeof room);
      setJoinStep("ready");
    });
    socket.on("rejoined", (data: { player: Player; room: unknown }) => {
      setCurrentPlayer(data.player);
      setRoom(data.room as typeof room);
      setJoinStep("ready");
    });
    socket.on("reselect-skills-done", (data: { player: Player; room: unknown }) => {
      setCurrentPlayer(data.player);
      setRoom(data.room as typeof room);
    });
    socket.on("kicked", () => {
      clearSession();
      window.alert("You have been kicked from the game.");
      navigate("/");
    });
    return () => {
      socket.off("room-created");
      socket.off("joined-room");
      socket.off("rejoined");
      socket.off("reselect-skills-done");
      socket.off("kicked");
    };
  }, [socket, navigate, setRoom]);

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!socket || !roomId || roomId === "new" || !playerName.trim()) return;
    setError(null);
    if (joinStep === "name") {
      const apiUrl = import.meta.env.VITE_API_URL || "";
      try {
        const res = await fetch(`${apiUrl}/api/room/${roomId}`);
        if (!res.ok) {
          setError("Room doesn't exist");
          return;
        }
        const data = await res.json();
        if (!(data.settingsConfirmed ?? false)) {
          setError("Waiting for GM to confirm settings");
          return;
        }
        setJoinRoomInfo({
          settings: data.settings ?? { rerollGoalOnComplete: true, rerollSkillsOnComplete: false, wpRechargePerRound: 3, wpCapEnabled: true, wpCap: 10, allowCustomGoal: false, allowGoalChoice: false, allowDuplicateGoals: true },
          players: data.players ?? [],
        });
        const needsGoalChoice = (data.settings?.allowGoalChoice ?? false) || (data.settings?.allowCustomGoal ?? false);
        setJoinStep(needsGoalChoice ? "goal" : "skills");
      } catch {
        setError("Room doesn't exist");
      }
      return;
    }
    if (joinStep === "goal") {
      return;
    }
    if (joinStep === "skills" && selectedSkills.length === willpowerCombo) {
      socket.emit("join-room", {
        roomId,
        playerName: playerName.trim(),
        skillIds: selectedSkills,
        willpowerCombo,
        ...(pendingGoal ?? {}),
      });
    }
  };

  const handleStartGame = () => {
    if (!socket || !currentPlayer || currentPlayer.role !== "gm") return;
    socket.emit("start-game");
  };

  const handleBid = (e: React.FormEvent) => {
    e.preventDefault();
    if (!socket || !currentPlayer || currentPlayer.role !== "voice") return;
    const amount = parseInt(bidAmount, 10);
    if (isNaN(amount) || amount < 1 || amount > currentPlayer.willpower) return;
    socket.emit("bid", { amount });
    setBidAmount("");
  };

  const handleSetSkillCheckThreshold = (threshold: number) => {
    if (!socket || !room || !currentPlayer) return;
    socket.emit("set-skill-check-threshold", {
      roomId: room.id,
      playerId: currentPlayer.id,
      threshold,
    });
  };

  const handleRollSkillCheck = () => {
    if (!socket || !room || !currentPlayer) return;
    socket.emit("roll-skill-check", {
      roomId: room.id,
      playerId: currentPlayer.id,
    });
  };

  const handleClearSkillCheck = () => {
    if (!socket || !room || !currentPlayer) return;
    socket.emit("clear-skill-check", {
      roomId: room.id,
      playerId: currentPlayer.id,
    });
  };

  const handleTransferGM = (newGmPlayerId: string) => {
    if (!socket || !room || !currentPlayer || !window.confirm("Transfer GM role? You will become a Voice and need to select skills.")) return;
    socket.emit("transfer-gm", {
      roomId: room.id,
      playerId: currentPlayer.id,
      newGmPlayerId,
    });
  };

  const handleUpdateSettings = (settings: Partial<import("@shared/types").RoomSettings>) => {
    if (!socket) return;
    socket.emit("update-settings", settings);
  };

  const handleConfirmSettings = () => {
    if (!socket) return;
    socket.emit("confirm-settings");
  };

  const handleGiveControl = () => {
    if (!socket) return;
    socket.emit("give-control");
  };

  const handleGiveControlToPlayer = (targetPlayerId: string) => {
    if (!socket) return;
    socket.emit("give-control-to-player", { targetPlayerId });
  };

  const handleStartBidding = () => {
    if (!socket) return;
    socket.emit("start-bidding");
  };

  const handleResetGame = () => {
    if (!socket || !window.confirm("Are you sure you want to reset the game?")) return;
    socket.emit("reset-game");
  };

  if (!connected || !socket) {
    return (
      <div style={styles.center}>
        <p>Connecting...</p>
      </div>
    );
  }

  if (isNewRoom && mode === "host") {
    return (
      <div style={styles.container}>
        <h1 style={styles.title}>Create Room</h1>
        {error && <p style={styles.error}>{error}</p>}
        <form onSubmit={handleCreateRoom} style={styles.form}>
          <label>
            Your name (GM)
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="GM Name"
              style={styles.input}
              required
            />
          </label>
          <label>
            Player count (excluding GM)
            <input
              type="number"
              min={2}
              max={8}
              value={playerCount}
              onChange={(e) => setPlayerCount(parseInt(e.target.value, 10) || 2)}
              style={styles.input}
            />
          </label>
          <button type="submit" style={styles.btn}>
            Create Room
          </button>
        </form>
      </div>
    );
  }

  if (roomId && roomId !== "new" && mode === "rejoin" && !currentPlayer) {
    return (
      <div style={styles.center}>
        <h1 style={styles.title}>Rejoining...</h1>
        {error && <p style={styles.error}>{error}</p>}
      </div>
    );
  }

  if (roomId && roomId !== "new" && mode === "join" && joinStep !== "ready" && !currentPlayer) {
    return (
      <div style={styles.container}>
        <h1 style={styles.title}>Join Room</h1>
        {error && <p style={styles.error}>{error}</p>}
        {joinStep === "goal" && joinRoomInfo ? (
          <GoalPicker
            room={{
              id: roomId,
              playerCount: 0,
              players: joinRoomInfo.players,
              currentController: null,
              status: "lobby",
              settings: joinRoomInfo.settings,
              biddingPhase: false,
              bids: {},
              bidOffPlayers: null,
              bidOffSubmitted: {},
              skillCheckThreshold: null,
              skillCheckResult: null,
              kickedAddresses: [],
              settingsConfirmed: true,
            }}
            onSubmit={(data) => {
              setPendingGoal(data);
              setJoinStep("skills");
            }}
          />
        ) : (
          <form onSubmit={handleJoinRoom} style={styles.form}>
            {joinStep === "name" && (
              <>
                <label>
                  Your name
                  <input
                    type="text"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    placeholder="Player Name"
                    style={styles.input}
                    required
                  />
                </label>
                <button type="submit" style={styles.btn}>
                  Next
                </button>
              </>
            )}
            {joinStep === "skills" && (
              <>
                <SkillPicker
                  selected={selectedSkills}
                  onSelect={setSelectedSkills}
                  count={willpowerCombo}
                  onComboChange={setWillpowerCombo}
                />
                <button
                  type="submit"
                  style={styles.btn}
                  disabled={selectedSkills.length !== willpowerCombo}
                >
                  Join
                </button>
              </>
            )}
          </form>
        )}
      </div>
    );
  }

  if (!room || !currentPlayer) {
    return (
      <div style={styles.center}>
        <p>Loading room...</p>
      </div>
    );
  }

  const needsSkillsReselect =
    currentPlayer.role === "voice" &&
    room.status === "lobby" &&
    currentPlayer.skills.length === 0;

  if (needsSkillsReselect) {
    return (
      <div style={styles.container}>
        <h1 style={styles.title}>Select skills</h1>
        <p style={styles.subtitle}>Game was reset. Please select your skills again.</p>
        {error && <p style={styles.error}>{error}</p>}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!socket || !room || !currentPlayer || selectedSkills.length !== willpowerCombo) return;
            setError(null);
            socket.emit("reselect-skills", {
              roomId: room.id,
              playerId: currentPlayer.id,
              skillIds: selectedSkills,
              willpowerCombo,
            });
          }}
          style={styles.form}
        >
          <SkillPicker
            selected={selectedSkills}
            onSelect={setSelectedSkills}
            count={willpowerCombo}
            onComboChange={setWillpowerCombo}
          />
          <button
            type="submit"
            style={styles.btn}
            disabled={selectedSkills.length !== willpowerCombo}
          >
            Confirm
          </button>
        </form>
      </div>
    );
  }

  const isGM = currentPlayer.role === "gm";

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>Room {room.id}</h1>
        <p style={styles.subtitle}>
          {room.players.filter((p) => p.role === "voice").length} / {room.playerCount} players • {room.status}
        </p>
        {!isGM && (
          <p style={currentPlayer.id === room.currentController ? styles.youInControl : styles.you}>
            You: {currentPlayer.name}
            {currentPlayer.id === room.currentController && " • In control"}
          </p>
        )}
        {isGM && (
          <button
            style={styles.copyBtn}
            onClick={() => {
              const url = `${window.location.origin}/room/${room.id}`;
              navigator.clipboard.writeText(url);
            }}
          >
            Copy room link
          </button>
        )}
      </header>

      {error && (
        <p style={styles.error} onClick={() => setError(null)}>
          {error}
        </p>
      )}

      {!isGM &&
        currentPlayer.role === "voice" &&
        !currentPlayer.goal &&
        ((room.settings.allowGoalChoice ?? false) || (room.settings.allowCustomGoal ?? false)) && (
          <GoalPicker
            room={room}
            onSubmit={(data) => socket?.emit("submit-goal", data)}
          />
        )}

      {isGM && room.status === "lobby" && (
        <GMSettingsPanel
          settings={room.settings}
          settingsConfirmed={room.settingsConfirmed ?? false}
          onUpdate={handleUpdateSettings}
          onConfirmSettings={handleConfirmSettings}
          onStartGame={handleStartGame}
          canStart={room.players.filter((p) => p.role === "voice").length >= 2}
        />
      )}

      {isGM && room.status === "playing" && (room.biddingPhase ?? false) && (
        <div style={styles.section}>
          <h2>Bidding (GM only)</h2>
          {(room.bidOffPlayers ?? []).length > 0 ? (
            <p style={styles.bidOffNote}>Bid off: tied players must bid again (≥ their last bid)</p>
          ) : null}
          <ul style={styles.bidList}>
            {(room.bidOffPlayers
              ? room.players.filter((p) => p.role === "voice" && (room.bidOffPlayers ?? []).includes(p.id))
              : room.players.filter((p) => p.role === "voice")
            ).map((p) => (
              <li key={p.id} style={styles.bidItem}>
                {p.name}: {p.id in (room.bids || {}) ? `${room.bids[p.id]} WP` : "—"}
                {(room.bidOffSubmitted ?? {})[p.id] ? " ✓" : ""}
              </li>
            ))}
          </ul>
          {(() => {
            const voices = room.players.filter((p) => p.role === "voice");
            const bidders = (room.bidOffPlayers ?? []).length > 0 ? (room.bidOffPlayers ?? []) : voices.map((v) => v.id);
            const allBidsIn =
              bidders.length > 0 &&
              bidders.every((id) => (room.bidOffPlayers ?? []).length > 0 ? (room.bidOffSubmitted ?? {})[id] : id in (room.bids || {}));
            const isBidOff = (room.bidOffPlayers ?? []).length > 0;
            return (
              <div style={styles.bidActions}>
                {allBidsIn ? (
                  isBidOff ? (
                    <button style={styles.btn} onClick={handleGiveControl}>
                      Bid Off
                    </button>
                  ) : (
                    <button style={styles.btn} onClick={handleGiveControl}>
                      Give Control
                    </button>
                  )
                ) : (
                  <button style={styles.btn} disabled>
                    {isBidOff ? "Bid Off" : "Give Control"}
                  </button>
                )}
                <div style={styles.giveToPlayerRow}>
                  <span style={styles.giveToLabel}>Give to player (fallback):</span>
                  {voices.map((p) => (
                    <button
                      key={p.id}
                      style={styles.giveToBtn}
                      onClick={() => handleGiveControlToPlayer(p.id)}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {isGM && room.status === "playing" && !(room.biddingPhase ?? false) && (
        <button style={styles.secondaryBtn} onClick={handleStartBidding}>
          Start bidding round
        </button>
      )}

      {isGM && room.status === "playing" && (
        <button style={styles.resetBtn} onClick={handleResetGame}>
          Reset game
        </button>
      )}

      <PlayerList
        room={room}
        currentPlayer={currentPlayer}
        onCompleteGoal={isGM ? (playerId) => socket.emit("complete-goal", { playerId }) : undefined}
        onRerollGoal={isGM ? (playerId: string) => socket.emit("reroll-goal-for-player", { playerId }) : undefined}
        onTransferGM={isGM ? handleTransferGM : undefined}
        onKick={isGM ? (playerId: string) => socket.emit("kick-player", { playerId }) : undefined}
      />

      <SkillCheck
        room={room}
        currentPlayer={currentPlayer}
        onSetThreshold={handleSetSkillCheckThreshold}
        onRoll={handleRollSkillCheck}
        onClear={handleClearSkillCheck}
      />

      {!isGM && currentPlayer.role === "voice" && currentPlayer.goal && (
        <div style={styles.section}>
          <h2>Your Goal</h2>
          <GoalWheel goal={currentPlayer.goal} onReroll={() => {}} canReroll={false} />
        </div>
      )}

      {!isGM && currentPlayer.role === "voice" && room.status === "playing" && (room.biddingPhase ?? false) && (
        <div style={styles.section}>
          <h2>Bid for Control</h2>
          {(room.bidOffPlayers ?? []).length > 0 && !(room.bidOffPlayers ?? []).includes(currentPlayer.id) ? (
            <p style={styles.waiting}>Bid off in progress. Waiting for tied players to bid...</p>
          ) : ((room.bidOffPlayers ?? []).length === 0 && currentPlayer.id in (room.bids || {})) ||
            ((room.bidOffPlayers ?? []).includes(currentPlayer.id) && (room.bidOffSubmitted ?? {})[currentPlayer.id]) ? (
            <p style={styles.ready}>✓ Ready</p>
          ) : (
            <form onSubmit={handleBid} style={styles.bidForm}>
              <p>Willpower: {currentPlayer.willpower}</p>
              {(room.bidOffPlayers ?? []).length > 0 && (
                <p style={styles.minBid}>
                  Min bid: {(room.bids || {})[currentPlayer.id] ?? 1} (must be ≥ your last bid)
                </p>
              )}
              <input
                type="number"
                min={(room.bidOffPlayers ?? []).includes(currentPlayer.id) ? ((room.bids || {})[currentPlayer.id] ?? 1) : 1}
                max={currentPlayer.willpower}
                value={bidAmount}
                onChange={(e) => setBidAmount(e.target.value)}
                placeholder="Bid amount"
                style={styles.input}
              />
              <button type="submit" style={styles.btn}>
                {(room.bidOffSubmitted ?? {})[currentPlayer.id] ? "Update bid" : "Bid"}
              </button>
            </form>
          )}
        </div>
      )}

      <button
        style={styles.backBtn}
        onClick={() => {
          clearSession();
          navigate("/");
        }}
      >
        Leave
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100vh",
    padding: 24,
    maxWidth: 800,
    margin: "0 auto",
  },
  center: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    marginBottom: 24,
  },
  title: {
    margin: 0,
    marginBottom: 4,
  },
  subtitle: {
    color: "#aaa",
    margin: 0,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
    maxWidth: 400,
  },
  section: {
    marginTop: 24,
    padding: 16,
    background: "#2a2a4a",
    borderRadius: 8,
  },
  input: {
    display: "block",
    padding: 12,
    fontSize: 16,
    borderRadius: 8,
    border: "1px solid #444",
    background: "#1a1a2e",
    color: "#eee",
    marginTop: 4,
    width: "100%",
  },
  btn: {
    padding: 12,
    fontSize: 16,
    background: "#e94560",
    color: "white",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 600,
  },
  bidForm: {
    display: "flex",
    gap: 12,
    marginTop: 8,
  },
  error: {
    color: "#e94560",
    marginBottom: 16,
  },
  backBtn: {
    marginTop: 32,
    padding: 8,
    background: "transparent",
    color: "#888",
    border: "1px solid #555",
    borderRadius: 8,
    cursor: "pointer",
  },
  copyBtn: {
    marginTop: 8,
    padding: "8px 16px",
    background: "#333",
    color: "#eee",
    border: "1px solid #555",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 14,
  },
  you: {
    margin: "8px 0 0 0",
    color: "#aaa",
    fontSize: 14,
  },
  youInControl: {
    margin: "8px 0 0 0",
    color: "#4ade80",
    fontSize: 14,
    fontWeight: 600,
  },
  bidList: {
    listStyle: "none",
    padding: 0,
    margin: "0 0 12px 0",
  },
  bidItem: {
    padding: 4,
  },
  ready: {
    color: "#4ade80",
    margin: 0,
  },
  bidOffNote: {
    margin: "0 0 12px 0",
    color: "#fbbf24",
    fontSize: 14,
  },
  bidActions: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  giveToPlayerRow: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  giveToLabel: {
    color: "#aaa",
    fontSize: 14,
  },
  giveToBtn: {
    padding: "4px 12px",
    fontSize: 12,
    background: "#333",
    color: "#eee",
    border: "1px solid #555",
    borderRadius: 4,
    cursor: "pointer",
  },
  minBid: {
    margin: "0 0 8px 0",
    color: "#aaa",
    fontSize: 14,
  },
  waiting: {
    margin: 0,
    color: "#888",
    fontStyle: "italic",
  },
  secondaryBtn: {
    marginTop: 16,
    marginRight: 8,
    padding: "8px 16px",
    background: "#333",
    color: "#eee",
    border: "1px solid #555",
    borderRadius: 8,
    cursor: "pointer",
  },
  resetBtn: {
    marginTop: 16,
    padding: "8px 16px",
    background: "#7f1d1d",
    color: "#fecaca",
    border: "1px solid #991b1b",
    borderRadius: 8,
    cursor: "pointer",
  },
};
