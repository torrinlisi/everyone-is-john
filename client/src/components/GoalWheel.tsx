import type { Goal } from "@shared/types";

interface GoalWheelProps {
  goal: Goal;
  onReroll: () => void;
  canReroll: boolean;
}

export default function GoalWheel({ goal, onReroll, canReroll }: GoalWheelProps) {
  return (
    <div style={styles.container}>
      <div style={styles.wheel}>
        <div style={styles.goalText}>{goal.text}</div>
        <div style={styles.difficulty}>Difficulty: {goal.difficulty}</div>
      </div>
      {canReroll && (
        <button style={styles.rerollBtn} onClick={onReroll}>
          Reroll Goal
        </button>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 16,
  },
  wheel: {
    width: 200,
    height: 200,
    borderRadius: "50%",
    background: "linear-gradient(135deg, #e94560 0%, #0f3460 100%)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    textAlign: "center",
  },
  goalText: {
    fontSize: 18,
    fontWeight: 600,
  },
  difficulty: {
    marginTop: 8,
    fontSize: 14,
    opacity: 0.9,
  },
  rerollBtn: {
    padding: "8px 20px",
    background: "#333",
    color: "#eee",
    border: "1px solid #555",
    borderRadius: 8,
    cursor: "pointer",
  },
};
