import { useState } from "react";
import type { Room, Player } from "@shared/types";

interface SkillCheckProps {
  room: Room;
  currentPlayer: Player;
  onSetThreshold: (threshold: number) => void;
  onRoll: () => void;
  onClear: () => void;
}

export default function SkillCheck({
  room,
  currentPlayer,
  onSetThreshold,
  onRoll,
  onClear,
}: SkillCheckProps) {
  const [rolling, setRolling] = useState(false);
  const isGM = currentPlayer.role === "gm";
  const controller = room.currentController
    ? room.players.find((p) => p.id === room.currentController)
    : null;
  const isController = room.currentController === currentPlayer.id;
  const threshold = room.skillCheckThreshold ?? null;
  const result = room.skillCheckResult ?? null;

  if (room.status !== "playing" || room.biddingPhase || !controller) return null;

  return (
    <div style={styles.container}>
      <h2>Skill Check</h2>
      {result ? (
        <div style={styles.result}>
          <p style={styles.resultText}>
            {room.players.find((p) => p.id === result.playerId)?.name ?? "Player"} rolled{" "}
            <span style={styles.dieValue}>{result.value}</span>
            {threshold != null && (
              <span style={result.value >= threshold ? styles.success : styles.fail}>
                {" "}
                ({result.value >= threshold ? "Success" : "Fail"})
              </span>
            )}
          </p>
          {isGM && (
            <button style={styles.clearBtn} onClick={onClear}>
              New check
            </button>
          )}
        </div>
      ) : (
        <>
          {isGM && (
            <div style={styles.thresholdRow}>
              <span>Threshold:</span>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <button
                  key={n}
                  type="button"
                  style={{
                    ...styles.dieBtn,
                    ...(threshold === n ? styles.dieBtnSelected : {}),
                  }}
                  onClick={() => onSetThreshold(n)}
                >
                  {n}
                </button>
              ))}
            </div>
          )}
          {threshold != null && (
            <div style={styles.rollSection}>
              <p style={styles.mustRoll}>
                {controller.name} must roll d6 (need {threshold}+)
              </p>
              {isController ? (
                <button
                  style={styles.rollBtn}
                  onClick={() => {
                    setRolling(true);
                    onRoll();
                    setTimeout(() => setRolling(false), 600);
                  }}
                  disabled={rolling}
                >
                  {rolling ? "Rolling..." : "Roll d6"}
                </button>
              ) : (
                <p style={styles.waiting}>Waiting for {controller.name} to roll...</p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    marginTop: 24,
    padding: 16,
    background: "#2a2a4a",
    borderRadius: 8,
  },
  thresholdRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 12,
  },
  dieBtn: {
    width: 36,
    height: 36,
    padding: 0,
    fontSize: 16,
    fontWeight: 600,
    background: "#333",
    color: "#eee",
    border: "1px solid #555",
    borderRadius: 8,
    cursor: "pointer",
  },
  dieBtnSelected: {
    background: "#e94560",
    borderColor: "#e94560",
  },
  rollSection: {
    marginTop: 12,
  },
  mustRoll: {
    margin: "0 0 8px 0",
    color: "#aaa",
  },
  rollBtn: {
    padding: "12px 24px",
    fontSize: 18,
    fontWeight: 600,
    background: "#e94560",
    color: "white",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
  },
  waiting: {
    margin: 0,
    color: "#888",
    fontStyle: "italic",
  },
  result: {
    marginTop: 8,
  },
  resultText: {
    margin: 0,
    fontSize: 18,
  },
  dieValue: {
    fontWeight: 700,
    fontSize: 24,
    color: "#e94560",
  },
  success: {
    color: "#4ade80",
  },
  fail: {
    color: "#f87171",
  },
  clearBtn: {
    marginTop: 12,
    padding: "8px 16px",
    background: "#333",
    color: "#eee",
    border: "1px solid #555",
    borderRadius: 8,
    cursor: "pointer",
  },
};
