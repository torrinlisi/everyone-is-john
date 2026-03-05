import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Landing() {
  const navigate = useNavigate();
  const [joinLink, setJoinLink] = useState("");

  const handleCreateRoom = () => {
    navigate("/room/new");
  };

  const handleJoinByLink = (e: React.FormEvent) => {
    e.preventDefault();
    const match = joinLink.match(/\/room\/([a-zA-Z0-9]+)/) || joinLink.match(/([a-zA-Z0-9]{6})/);
    const roomId = match ? match[1] : joinLink.trim();
    if (roomId) {
      navigate(`/room/${roomId}`);
    }
  };

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Everyone is John</h1>
      <p style={styles.subtitle}>A multiplayer game of competing voices</p>

      <div style={styles.actions}>
        <button style={styles.primaryBtn} onClick={handleCreateRoom}>
          Create Room
        </button>

        <div style={styles.divider}>or</div>

        <form onSubmit={handleJoinByLink} style={styles.joinForm}>
          <input
            type="text"
            placeholder="Paste room link or ID"
            value={joinLink}
            onChange={(e) => setJoinLink(e.target.value)}
            style={styles.input}
          />
          <button type="submit" style={styles.secondaryBtn}>
            Join Room
          </button>
        </form>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    fontSize: "2.5rem",
    margin: 0,
    marginBottom: 8,
  },
  subtitle: {
    color: "#aaa",
    marginBottom: 48,
  },
  actions: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 24,
    width: "100%",
    maxWidth: 400,
  },
  primaryBtn: {
    padding: "12px 32px",
    fontSize: "1.1rem",
    background: "#e94560",
    color: "white",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    fontWeight: 600,
  },
  divider: {
    color: "#666",
  },
  joinForm: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    width: "100%",
  },
  input: {
    padding: 12,
    fontSize: 16,
    borderRadius: 8,
    border: "1px solid #444",
    background: "#2a2a4a",
    color: "#eee",
  },
  secondaryBtn: {
    padding: 12,
    fontSize: 16,
    background: "#333",
    color: "#eee",
    border: "1px solid #555",
    borderRadius: 8,
    cursor: "pointer",
  },
};
