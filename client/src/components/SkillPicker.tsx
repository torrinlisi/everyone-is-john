import { useEffect, useState } from "react";

interface Skill {
  id: string;
  text: string;
}

interface SkillPickerProps {
  selected: string[];
  onSelect: (ids: string[]) => void;
  count: 2 | 3;
  onComboChange: (combo: 2 | 3) => void;
}

const API_URL = import.meta.env.VITE_API_URL || "";

export default function SkillPicker({
  selected,
  onSelect,
  count,
  onComboChange,
}: SkillPickerProps) {
  const [skills, setSkills] = useState<Skill[]>([]);

  useEffect(() => {
    fetch(`${API_URL}/api/skills`)
      .then((r) => r.json())
      .then(setSkills)
      .catch(() => setSkills([]));
  }, []);

  const toggleSkill = (id: string) => {
    if (selected.includes(id)) {
      onSelect(selected.filter((s) => s !== id));
    } else if (selected.length < count) {
      onSelect([...selected, id]);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.comboRow}>
        <span>Willpower combo:</span>
        <label style={styles.radio}>
          <input
            type="radio"
            checked={count === 2}
            onChange={() => {
              onComboChange(2);
              onSelect([]);
            }}
          />
          2 skills (10 WP)
        </label>
        <label style={styles.radio}>
          <input
            type="radio"
            checked={count === 3}
            onChange={() => {
              onComboChange(3);
              onSelect([]);
            }}
          />
          3 skills (7 WP)
        </label>
      </div>
      <p style={styles.hint}>
        Select {count} skills ({selected.length} selected)
      </p>
      <div style={styles.grid}>
        {skills.map((skill) => (
          <button
            key={skill.id}
            type="button"
            style={{
              ...styles.skillBtn,
              ...(selected.includes(skill.id) ? styles.skillBtnSelected : {}),
            }}
            onClick={() => toggleSkill(skill.id)}
            disabled={!selected.includes(skill.id) && selected.length >= count}
          >
            {skill.text}
          </button>
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  comboRow: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    flexWrap: "wrap",
  },
  radio: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    cursor: "pointer",
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
  skillBtn: {
    padding: "8px 16px",
    background: "#2a2a4a",
    color: "#eee",
    border: "1px solid #555",
    borderRadius: 8,
    cursor: "pointer",
  },
  skillBtnSelected: {
    background: "#e94560",
    borderColor: "#e94560",
  },
};
