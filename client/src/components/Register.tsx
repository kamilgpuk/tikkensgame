import { useState } from "react";

interface Props {
  onRegister: (name: string) => void;
}

export function Register({ onRegister }: Props) {
  const [name, setName] = useState("");

  return (
    <div className="register">
      <h1>TIKKENS</h1>
      <p className="subtitle">build the next big thing. generate tokens. achieve AGI.</p>
      <div className="register-form">
        <input
          type="text"
          placeholder="enter your name"
          value={name}
          maxLength={32}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && name.trim() && onRegister(name.trim())}
          autoFocus
        />
        <button
          onClick={() => name.trim() && onRegister(name.trim())}
          disabled={!name.trim()}
        >
          start
        </button>
      </div>
    </div>
  );
}
