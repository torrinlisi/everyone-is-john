import type { RoomSettings } from "@shared/types";

interface GMSettingsPanelProps {
  settings: RoomSettings;
  settingsConfirmed: boolean;
  onUpdate: (settings: Partial<RoomSettings>) => void;
  onConfirmSettings: () => void;
  onStartGame: () => void;
  canStart: boolean;
}

export default function GMSettingsPanel({
  settings,
  settingsConfirmed,
  onUpdate,
  onConfirmSettings,
  onStartGame,
  canStart,
}: GMSettingsPanelProps) {
  return (
    <div style={styles.container}>
      <h2>GM Settings</h2>
      <label style={styles.checkbox}>
        <input
          type="checkbox"
          checked={settings.rerollGoalOnComplete}
          onChange={(e) => onUpdate({ rerollGoalOnComplete: e.target.checked })}
        />
        Reroll goal on goal complete
      </label>
      <label style={styles.checkbox}>
        <input
          type="checkbox"
          checked={settings.rerollSkillsOnComplete}
          onChange={(e) => onUpdate({ rerollSkillsOnComplete: e.target.checked })}
        />
        Reroll skills on goal complete
      </label>
      <label style={styles.checkbox}>
        <input
          type="checkbox"
          checked={settings.allowCustomGoal ?? false}
          onChange={(e) => onUpdate({ allowCustomGoal: e.target.checked })}
        />
        Allow custom goal
      </label>
      <label style={styles.checkbox}>
        <input
          type="checkbox"
          checked={settings.allowGoalChoice ?? false}
          onChange={(e) => onUpdate({ allowGoalChoice: e.target.checked })}
        />
        Allow goal choice
      </label>
      <label style={styles.checkbox}>
        <input
          type="checkbox"
          checked={settings.allowDuplicateGoals ?? true}
          onChange={(e) => onUpdate({ allowDuplicateGoals: e.target.checked })}
        />
        Allow duplicate goals
      </label>
      <label style={styles.row}>
        <span>WP recharge per bidding round:</span>
        <input
          type="number"
          min={0}
          value={settings.wpRechargePerRound ?? 3}
          onChange={(e) => onUpdate({ wpRechargePerRound: Math.max(0, parseInt(e.target.value, 10) || 0) })}
          style={styles.numInput}
        />
      </label>
      <label style={styles.checkbox}>
        <input
          type="checkbox"
          checked={settings.wpCapEnabled ?? true}
          onChange={(e) => onUpdate({ wpCapEnabled: e.target.checked })}
        />
        No WP limit
      </label>
      {!(settings.wpCapEnabled ?? true) && (
        <label style={styles.row}>
          <span>WP cap:</span>
          <input
            type="number"
            min={1}
            value={settings.wpCap ?? 10}
            onChange={(e) => onUpdate({ wpCap: Math.max(1, parseInt(e.target.value, 10) || 1) })}
            style={styles.numInput}
          />
        </label>
      )}
      {!settingsConfirmed && (
        <button style={styles.confirmBtn} onClick={onConfirmSettings}>
          Confirm settings (open for joining)
        </button>
      )}
      {settingsConfirmed && (
        <p style={styles.confirmedNote}>Settings confirmed – players can join</p>
      )}
      <button
        style={{ ...styles.startBtn, opacity: canStart ? 1 : 0.5 }}
        onClick={onStartGame}
        disabled={!canStart}
      >
        Start Game
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: 16,
    background: "#2a2a4a",
    borderRadius: 8,
    marginBottom: 24,
  },
  checkbox: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
    cursor: "pointer",
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  numInput: {
    width: 60,
    padding: 4,
    background: "#1a1a2e",
    border: "1px solid #444",
    borderRadius: 4,
    color: "#eee",
  },
  confirmBtn: {
    marginTop: 16,
    padding: "12px 24px",
    background: "#0f3460",
    color: "#eee",
    border: "1px solid #1e5a8e",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 600,
  },
  confirmedNote: {
    marginTop: 12,
    color: "#4ade80",
    fontSize: 14,
  },
  startBtn: {
    marginTop: 16,
    padding: "12px 24px",
    background: "#e94560",
    color: "white",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 600,
  },
};
