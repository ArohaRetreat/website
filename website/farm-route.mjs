import { CatmullRomCurve3, Vector3 } from "three";
export const clamp = (n, lo = 0, hi = 1) =>
  Math.max(lo, Math.min(hi, Number.isFinite(n) ? n : 0));
export const smooth = (n) => {
  n = clamp(n);
  return n * n * (3 - 2 * n);
};
import { FARM_STOPS } from "./farm-stops.mjs";
export { FARM_STOPS } from "./farm-stops.mjs";
const positions = [
  [0, 3.2, 38],
  [0, 2.8, 25],
  [0, 2.5, 13],
  [2.7, 3.2, 0],
  [0.8, 3.5, 1.6],
  [0, 3.3, -22],
  [3.7, 3.5, -35],
  [25, 17, -18],
  [34, 29, 32],
];
const targets = [
  [0, 2.3, 17],
  [0, 2.3, 7],
  [-9, 0.5, 0],
  [8, 2, -12],
  [8.2, 2.2, -13],
  [-8, 2, -31],
  [12, 1.6, -43],
  [1, 0, -25],
  [0, 0, -17],
];
const cameraCurve = new CatmullRomCurve3(
  positions.map((p) => new Vector3(...p)),
  false,
  "centripetal",
);
const lookCurve = new CatmullRomCurve3(
  targets.map((p) => new Vector3(...p)),
  false,
  "centripetal",
);
const pacing = [
  [0, 0],
  [0.13, 0.125],
  [0.27, 0.25],
  [0.48, 0.5],
  [0.67, 0.625],
  [0.83, 0.75],
  [1, 1],
];
export function sampleRoute(
  progress,
  target = { position: new Vector3(), look: new Vector3() },
) {
  const p = clamp(progress);
  let i = 0;
  while (i < pacing.length - 2 && p > pacing[i + 1][0]) i++;
  const [a, x] = pacing[i],
    [b, y] = pacing[i + 1];
  // Slow at each destination, but retain velocity between destinations.
  const t = clamp((p - a) / (b - a)),
    q = x + (y - x) * (t * 0.35 + smooth(t) * 0.65);
  cameraCurve.getPoint(q, target.position);
  lookCurve.getPoint(q, target.look);
  target.gate = smooth((p - 0.018) / 0.15);
  target.stop = FARM_STOPS.reduce(
    (best, s, j) =>
      Math.abs(s.at - p) < Math.abs(FARM_STOPS[best].at - p) ? j : best,
    0,
  );
  return target;
}
export function terrainHeight(x, z) {
  const far =
    Math.max(0, Math.abs(x) - 24) * 0.045 + Math.max(0, -z - 59) * 0.06;
  const hills =
    far * (1.6 + 0.8 * Math.sin(x * 0.13) + 0.5 * Math.cos(z * 0.18));
  const pond = Math.exp(-((x + 10) ** 2 / 58 + (z - 1) ** 2 / 27)) * 0.6;
  return 0.08 * Math.sin(x * 0.29) * Math.cos(z * 0.24) + hills - pond;
}
export function seeded(seed = 42) {
  return () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
