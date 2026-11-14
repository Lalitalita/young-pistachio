import { describe, expect, it } from "vitest";
import { pickRotation, screenView } from "./phaseLogic";
import type { PublicState } from "./types";

const mk = (over: Partial<PublicState> = {}, screen: Partial<PublicState["screen"]> = {}): PublicState =>
  ({
    attract: false,
    phases: ["p0", "p1", "p2"].map((id) => ({ id, enabled: id !== "p2" })),
    screen: { mode: "auto", phase_id: "p1", rotation_s: 10, attract_after_s: 90, ...screen },
    ...over,
  }) as unknown as PublicState;

describe("pickRotation", () => {
  it("tourne toutes les N secondes", () => {
    const ids = ["a", "b", "c"];
    expect(pickRotation(ids, 0, 10)).toBe("a");
    expect(pickRotation(ids, 9_999, 10)).toBe("a");
    expect(pickRotation(ids, 10_000, 10)).toBe("b");
    expect(pickRotation(ids, 30_000, 10)).toBe("a");
  });
  it("liste vide", () => expect(pickRotation([], 0, 10)).toBeNull());
});

describe("screenView", () => {
  it("veille prioritaire", () => expect(screenView(mk({ attract: true }), 0)).toEqual({ kind: "attract" }));
  it("rotation ignore les phases désactivées", () => {
    expect(screenView(mk(), 0)).toEqual({ kind: "phase", id: "p0" });
    expect(screenView(mk(), 10_000)).toEqual({ kind: "phase", id: "p1" });
    expect(screenView(mk(), 20_000)).toEqual({ kind: "phase", id: "p0" });
  });
  it("phase fixée", () => expect(screenView(mk({}, { mode: "phase", phase_id: "p1" }), 0)).toEqual({ kind: "phase", id: "p1" }));
  it("phase fixée désactivée → première active", () =>
    expect(screenView(mk({}, { mode: "phase", phase_id: "p2" }), 0)).toEqual({ kind: "phase", id: "p0" }));
});

describe("screenView : panne majeure", () => {
  const withBoss = (status: string, attract = false, p3Enabled = true) =>
    mk({
      attract,
      phases: ["p0", "p1", "p3"].map((id) => ({ id, enabled: id !== "p3" || p3Enabled })) as any,
      p3: { boss: { status } } as any,
    });
  it("prend la main sur la rotation", () => expect(screenView(withBoss("voting"), 0)).toEqual({ kind: "phase", id: "p3" }));
  it("prend la main même en veille", () => expect(screenView(withBoss("recovering", true), 0)).toEqual({ kind: "phase", id: "p3" }));
  it("ne fait rien au repos", () => expect(screenView(withBoss("idle", true), 0)).toEqual({ kind: "attract" }));
  it("ignore la panne si la phase 3 est désactivée", () => expect(screenView(withBoss("voting", true, false), 0)).toEqual({ kind: "attract" }));
});

