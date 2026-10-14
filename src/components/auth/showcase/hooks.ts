import { useEffect, useState } from "react";

/** True when the user asked the OS for reduced motion. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(mq.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return reduced;
}

/**
 * Scripted timeline. `times` are the start times (ms) of each step; returns the
 * index of the step currently playing. With reduced motion it jumps to the
 * final step so people see the end state instead of motion.
 */
export function useSteps(times: number[], reduced = false): number {
  const [step, setStep] = useState(reduced ? times.length - 1 : 0);
  useEffect(() => {
    if (reduced) {
      setStep(times.length - 1);
      return;
    }
    setStep(0);
    const ids = times.map((t, i) => window.setTimeout(() => setStep(i), t));
    return () => ids.forEach((id) => window.clearTimeout(id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);
  return step;
}

/** Eases a number from its current value to `target` once `run` is true. */
export function useCountUp(target: number, run: boolean, ms = 1100, reduced = false): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!run) {
      setValue(0);
      return;
    }
    if (reduced) {
      setValue(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, run, ms, reduced]);
  return value;
}

/** Types `text` out one character at a time while `run` is true. */
export function useTyping(text: string, run: boolean, charsPerSecond = 30, reduced = false): string {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!run) {
      setN(0);
      return;
    }
    if (reduced) {
      setN(text.length);
      return;
    }
    const id = window.setInterval(() => {
      setN((c) => {
        if (c >= text.length) {
          window.clearInterval(id);
          return c;
        }
        return c + 1;
      });
    }, 1000 / charsPerSecond);
    return () => window.clearInterval(id);
  }, [text, run, charsPerSecond, reduced]);
  return text.slice(0, n);
}
