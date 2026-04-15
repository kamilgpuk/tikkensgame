import { useState, useEffect } from "react";

const SHUTDOWN_AT = new Date('2026-04-17T21:00:00+02:00').getTime();
const SD_KEY = 'tikkens_shutdown_v1';

export function ShutdownNotice() {
  const shutdown = Date.now() >= SHUTDOWN_AT;
  const [showPopup, setShowPopup] = useState(false);

  useEffect(() => {
    if (!shutdown && !localStorage.getItem(SD_KEY)) {
      setShowPopup(true);
    }
  }, []);

  const dismiss = () => {
    setShowPopup(false);
    localStorage.setItem(SD_KEY, '1');
  };

  if (shutdown) {
    return (
      <div className="sd-overlay">
        <div className="sd-modal">
          <h2>T'kkens has shut down</h2>
          <p>This has been a fun hobby project, but the server costs have grown beyond what makes sense for me to maintain despite some optimisations.</p>
          <p>Thank you. Let's stay in touch.</p>
          <p className="sd-sig">— Kamil</p>
          <a className="sd-link" href="/">[ back to landing ]</a>
        </div>
      </div>
    );
  }

  if (!showPopup) return null;

  return (
    <div className="sd-backdrop" onClick={dismiss}>
      <div className="sd-modal" onClick={e => e.stopPropagation()}>
        <h2>Tikkens Game is shutting down on April 17th at 9pm CET</h2>
        <p>This has been a fun hobby project, but the server costs have grown beyond what makes sense for me to maintain despite some optimisations.</p>
        <p>Thank you. Let's stay in touch.</p>
        <p className="sd-sig">— Kamil</p>
        <button className="sd-ok" onClick={dismiss}>[ ok ]</button>
      </div>
    </div>
  );
}
