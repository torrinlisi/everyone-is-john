import { useEffect, useState } from "react";
import type { Goal, Room } from "@shared/types";

interface GoalPickerProps {
  room: Room;
  onSubmit: (data: { goalId?: string; customText?: string; customDifficulty?: number; random?: boolean }) => void;
}

const API_URL = import.meta.env.VITE_API_URL || "";

export default function GoalPicker({ room, onSubmit }: GoalPickerProps) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [customText, setCustomText] = useState("");
  const [customDifficulty, setCustomDifficulty] = useState<number>(1);

  const allowChoice = room.settings.allowGoalChoice ?? false;
  const allowCustom = room.settings.allowCustomGoal ?? false;
  const allowDuplicates = room.settings.allowDuplicateGoals ?? true;

  const takenGoalIds = allowDuplicates
    ? new Set<string>()
    : new Set(
        room.players
          .filter((p) => p.role === "voice" && p.goal)
          .map((p) => p.goal!.id)
      );

  useEffect(() => {
    fetch(`${API_URL}/api/goals`)
      .then((r) => r.json())
      .then(setGoals)
      .catch(() => setGoals([]));
  }, []);

  const availableGoals = goals.filter((g) => allowDuplicates || !takenGoalIds.has(g.id));

  const handleSubmitChoice = (goalId: string) => {
    onSubmit({ goalId });
  };

  const handleSubmitCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customText.trim()) return;
    onSubmit({ customText: customText.trim(), customDifficulty });
  };

  const handleRandom = () => {
    onSubmit({ random: true });
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Choose your goal</h2>
      {allowChoice && availableGoals.length > 0 && (
        <div style={styles.section}>
          <p style={styles.hint}>Pick from the list:</p>
          <div style={styles.grid}>
            {availableGoals.map((goal) => (
              <button
                key={goal.id}
                type="button"
                style={styles.goalBtn}
                onClick={() => handleSubmitChoice(goal.id)}
              >
                {goal.text} (diff: {goal.difficulty})
              </button>
            ))}
          </div>
        </div>
      )}
      {allowCustom && (
        <form onSubmit={handleSubmitCustom} style={styles.section}>
          <p style={styles.hint}>Or enter a custom goal:</p>
          <input
            type="text"
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            placeholder="Your custom goal..."
            style={styles.input}
          />
          <label style={styles.diffRow}>
            <span>Difficulty (1–3):</span>
            <input
              type="number"
              min={1}
              max={3}
              value={customDifficulty}
              onChange={(e) => setCustomDifficulty(Math.max(1, Math.min(3, parseInt(e.target.value, 10) || 1)))}
              style={styles.numInput}
            />
          </label>
          <button type="submit" style={styles.btn} disabled={!customText.trim()}>
            Submit custom goal
          </button>
        </form>
      )}
      {(allowChoice || allowCustom) && (
        <button type="button" style={styles.randomBtn} onClick={handleRandom}>
          Random goal
        </button>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    gap: 20,
    padding: 24,
    background: "#2a2a4a",
    borderRadius: 8,
    marginTop: 24,
  },
  title: {
    margin: 0,
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  hint: {
    margin: 0,
    color: "#aaa",
    fontSize: 14,
  },
  grid: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },
  goalBtn: {
    padding: "8px 16px",
    background: "#1a1a2e",
    color: "#eee",
    border: "1px solid #555",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 14,
  },
  input: {
    padding: 12,
    fontSize: 16,
    borderRadius: 8,
    border: "1px solid #444",
    background: "#1a1a2e",
    color: "#eee",
    width: "100%",
  },
  diffRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  numInput: {
    width: 60,
    padding: 8,
    background: "#1a1a2e",
    border: "1px solid #444",
    borderRadius: 4,
    color: "#eee",
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
    alignSelf: "flex-start",
  },
  randomBtn: {
    padding: "8px 16px",
    background: "#333",
    color: "#eee",
    border: "1px solid #555",
    borderRadius: 8,
    cursor: "pointer",
    alignSelf: "flex-start",
  },
};
