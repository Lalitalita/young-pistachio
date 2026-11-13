import { describe, expect, it } from "vitest";
import { backoffDelay } from "./useSocket";

describe("backoffDelay", () => {
  it("croît puis plafonne", () => {
    const d = (n: number) => backoffDelay(n, 500, 15000, () => 1);
    expect(d(0)).toBe(500);
    expect(d(2)).toBe(2000);
    expect(d(20)).toBe(15000);
  });
  it("reste dans [exp/2, exp]", () => {
    for (let i = 0; i < 50; i++) {
      const v = backoffDelay(3);
      expect(v).toBeGreaterThanOrEqual(2000);
      expect(v).toBeLessThanOrEqual(4000);
    }
  });
});
