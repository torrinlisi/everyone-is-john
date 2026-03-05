import { Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing";
import Room from "./pages/Room";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/room/:roomId" element={<Room />} />
    </Routes>
  );
}
