import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import type { Room } from "@shared/types";

const API_URL = import.meta.env.VITE_API_URL || "";

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const s = io(API_URL, { autoConnect: false });
    socketRef.current = s;
    setSocket(s);

    s.on("connect", () => setConnected(true));
    s.on("disconnect", () => setConnected(false));
    s.on("error", (data: { message?: string }) => setError(data?.message || "Error"));
    s.on("room-update", (r: Room) => setRoom(r));

    s.connect();
    return () => {
      s.disconnect();
      socketRef.current = null;
      setSocket(null);
    };
  }, []);

  return { socket, room, setRoom, error, setError, connected };
}
