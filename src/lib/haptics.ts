/**
 * Lightweight haptics helper.
 * - Uses navigator.vibrate where available (Android, some browsers).
 * - On iOS Safari, vibrate is unsupported but calls are harmless no-ops.
 *   For installed PWAs we additionally trigger a short audio click that
 *   feels tactile when paired with a visual pulse.
 */

type Pattern = "light" | "medium" | "heavy" | "success" | "warning";

const PATTERNS: Record<Pattern, number | number[]> = {
  light: 8,
  medium: 14,
  heavy: 22,
  success: [12, 40, 18, 30, 24],
  warning: [10, 60, 10],
};

export function haptic(pattern: Pattern = "light") {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(PATTERNS[pattern]);
    }
  } catch {
    /* ignore */
  }
}
