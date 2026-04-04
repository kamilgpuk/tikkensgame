import { useState } from "react";

interface Props {
  onRegister: (name: string, pin: string) => Promise<{ nameTaken: boolean }>;
  onLogin: (name: string, pin: string) => Promise<void>;
}

type Mode = "register" | "login";

export function Register({ onRegister, onLogin }: Props) {
  const [mode, setMode] = useState<Mode>("register");
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [nameTakenWarning, setNameTakenWarning] = useState(false);
  const [loading, setLoading] = useState(false);

  const reset = (nextMode: Mode) => {
    setMode(nextMode);
    setError("");
    setNameTakenWarning(false);
    setPin("");
  };

  const valid = name.trim().length >= 1 && name.trim().length <= 20 && /^\d{4,8}$/.test(pin);

  const handleSubmit = async () => {
    if (!valid || loading) return;
    setError("");
    setNameTakenWarning(false);
    setLoading(true);
    try {
      if (mode === "register") {
        const { nameTaken } = await onRegister(name.trim(), pin);
        if (nameTaken) setNameTakenWarning(true);
      } else {
        await onLogin(name.trim(), pin);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSubmit();
  };

  return (
    <div className="register">
      <h1>TIKKENS</h1>
      <p className="subtitle">build the next big thing. generate tokens. achieve AGI.</p>

      <div className="auth-tabs">
        <button
          className={mode === "register" ? "active" : ""}
          onClick={() => reset("register")}
        >
          new player
        </button>
        <button
          className={mode === "login" ? "active" : ""}
          onClick={() => reset("login")}
        >
          log in
        </button>
      </div>

      <div className="register-form">
        <input
          type="text"
          placeholder="name (max 20 chars)"
          value={name}
          maxLength={20}
          onChange={(e) => { setName(e.target.value); setError(""); setNameTakenWarning(false); }}
          onKeyDown={onKey}
          autoFocus
        />
        <input
          type="text"
          inputMode="numeric"
          pattern="\d{4,8}"
          placeholder="pin (4–8 digits)"
          value={pin}
          maxLength={8}
          onChange={(e) => { setPin(e.target.value.replace(/\D/g, "")); setError(""); }}
          onKeyDown={onKey}
        />
        <button onClick={handleSubmit} disabled={!valid || loading}>
          {loading ? "..." : mode === "register" ? "start" : "log in"}
        </button>
      </div>

      {nameTakenWarning && (
        <p className="auth-warning">
          This name is already in use. You can keep it, but a distinctive name makes recovery easier.
        </p>
      )}

      {error && <p className="auth-error">{error}</p>}

      {mode === "register" && (
        <p className="auth-hint">
          Your PIN is your recovery key — write it down. Use it to log in from any device.
        </p>
      )}
    </div>
  );
}
