// Shutdown timestamp: April 17 2026, 9pm CEST (UTC+2)
export const SHUTDOWN_AT = new Date('2026-04-17T21:00:00+02:00');

export function isShutdown(): boolean {
  return Date.now() >= SHUTDOWN_AT.getTime();
}
