import type { Room, Player } from "@shared/types";

interface PlayerListProps {
  room: Room;
  currentPlayer: Player;
  onCompleteGoal?: (playerId: string) => void;
  onTransferGM?: (playerId: string) => void;
}

export default function PlayerList({ room, currentPlayer, onCompleteGoal, onTransferGM }: PlayerListProps) {
  const isGM = currentPlayer.role === "gm";

  return (
    <div style={styles.container}>
      <h2>Players</h2>
      <ul style={styles.list}>
        {room.players.map((player) => (
          <li
            key={player.id}
            style={{
              ...styles.item,
              ...(player.id === currentPlayer.id ? styles.itemYou : {}),
            }}
          >
            <div style={styles.row}>
              <span style={styles.name}>
                {player.name}
                {player.id === currentPlayer.id && " (you)"}
                {player.role === "gm" && " (GM)"}
                {room.currentController === player.id && " • In control"}
              </span>
              {onTransferGM && isGM && room.status === "lobby" && player.role === "voice" && (
                <button
                  style={styles.makeGmBtn}
                  onClick={() => onTransferGM(player.id)}
                >
                  Make GM
                </button>
              )}
              {player.role === "voice" && (
                <span style={styles.stats}>
                  WP: {player.willpower} | Score: {player.score}
                </span>
              )}
            </div>
            {player.role === "voice" && player.skills.length > 0 && (
              <div style={styles.skills}>
                Skills: {player.skills.map((s) => s.text).join(", ")}
              </div>
            )}
            {player.role === "voice" && player.goal && isGM && (
              <div style={styles.goal}>
                Goal: {player.goal.text} (diff: {player.goal.difficulty})
                {onCompleteGoal && room.currentController === player.id && (
                  <button
                    style={styles.completeBtn}
                    onClick={() => onCompleteGoal(player.id)}
                  >
                    Complete
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    marginTop: 24,
  },
  list: {
    listStyle: "none",
    padding: 0,
    margin: 0,
  },
  item: {
    padding: 12,
    marginBottom: 8,
    background: "#2a2a4a",
    borderRadius: 8,
  },
  itemYou: {
    borderLeft: "3px solid #e94560",
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  name: {
    fontWeight: 600,
  },
  stats: {
    color: "#aaa",
    fontSize: 14,
  },
  skills: {
    marginTop: 4,
    fontSize: 14,
    color: "#bbb",
  },
  goal: {
    marginTop: 8,
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  completeBtn: {
    padding: "4px 12px",
    fontSize: 12,
    background: "#e94560",
    color: "white",
    border: "none",
    borderRadius: 4,
    cursor: "pointer",
  },
  makeGmBtn: {
    padding: "4px 12px",
    fontSize: 12,
    background: "#0f3460",
    color: "#eee",
    border: "1px solid #1e5a8e",
    borderRadius: 4,
    cursor: "pointer",
  },
};
