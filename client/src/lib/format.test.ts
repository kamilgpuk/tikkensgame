import { describe, it, expect } from "vitest";
import { fmt, fmtRate, fmtTime } from "./format.js";

describe("fmt — number formatting", () => {
  it("F1: fmt(0) → '0.0'", () => {
    expect(fmt(0)).toBe("0.0");
  });

  it("F2: fmt(999) → '999'", () => {
    expect(fmt(999)).toBe("999");
  });

  it("F3: fmt(1000) → '1.0K'", () => {
    expect(fmt(1000)).toBe("1.0K");
  });

  it("F4: fmt(1_500_000) → '1.5M'", () => {
    expect(fmt(1_500_000)).toBe("1.5M");
  });

  it("F5: fmt(1_000_000_000) → '1.0B'", () => {
    expect(fmt(1_000_000_000)).toBe("1.0B");
  });

  it("F6: fmt(negative) does not crash", () => {
    expect(() => fmt(-999)).not.toThrow();
  });

  it("F7: fmt(NaN) returns '0' gracefully", () => {
    expect(fmt(NaN)).toBe("0");
  });

  it("F8: fmt(Infinity) returns '0' gracefully", () => {
    expect(fmt(Infinity)).toBe("0");
  });
});

describe("fmtRate", () => {
  it("appends /s to formatted number", () => {
    expect(fmtRate(1000)).toBe("1.0K/s");
  });
});

describe("fmtTime", () => {
  it("shows seconds for < 60s", () => {
    expect(fmtTime(45)).toBe("45s");
  });

  it("shows minutes for >= 60s", () => {
    expect(fmtTime(120)).toBe("2m");
  });

  it("shows hours for >= 3600s", () => {
    expect(fmtTime(7200)).toBe("2h");
  });
});
