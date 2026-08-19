/**
 * Web Audio — jest sırasında unlock; setTimeout içinden resume YOK
 * (yoksa Next "Console Error" çıkar: AudioContext suspended)
 */

let ctx: AudioContext | null = null;

function createCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return null;
    if (!ctx || ctx.state === "closed") ctx = new AC();
    return ctx;
  } catch {
    return null;
  }
}

/** Sadece kullanıcı tıklamasında çağır */
export function unlockGameAudio() {
  const c = createCtx();
  if (!c) return;
  if (c.state === "suspended") {
    void c.resume().catch(() => undefined);
  }
}

function canPlay(): AudioContext | null {
  const c = ctx;
  if (!c || c.state !== "running") return null;
  return c;
}

function tone(
  freq: number,
  dur: number,
  type: OscillatorType,
  gain = 0.1,
  when = 0,
) {
  try {
    const c = canPlay();
    if (!c) return;
    const t0 = c.currentTime + Math.max(0, when);
    const attack = Math.min(0.012, Math.max(0.008, dur * 0.25));
    const end = t0 + Math.max(0.04, dur);
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.value = Math.max(40, freq);
    // 0 gain exponential/linear uçları bazı tarayıcılarda uyarı verir
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(Math.max(0.0001, gain), t0 + attack);
    g.gain.linearRampToValueAtTime(0.0001, end);
    osc.connect(g);
    g.connect(c.destination);
    osc.start(t0);
    osc.stop(end + 0.02);
  } catch {
    // ignore
  }
}

export function playSpinStart() {
  tone(240, 0.1, "triangle", 0.09);
  tone(360, 0.12, "triangle", 0.07, 0.07);
}

export function playTick() {
  tone(820 + Math.random() * 100, 0.035, "square", 0.035);
}

export function playWin() {
  // az osilatör — setTimeout sonrası güvenli
  tone(523, 0.22, "triangle", 0.11, 0);
  tone(659, 0.22, "triangle", 0.1, 0.12);
  tone(784, 0.35, "triangle", 0.12, 0.24);
}

export function playLose() {
  tone(280, 0.2, "sine", 0.07);
  tone(200, 0.28, "sine", 0.06, 0.14);
}

export function playClick() {
  tone(520, 0.05, "triangle", 0.05);
}

export const SPIN_DURATION_MS = 7200;

/** Spin boyunca tick — yavaşlayarak (uzun spin) */
export function startSpinTicks(durationMs = SPIN_DURATION_MS): () => void {
  let cancelled = false;
  let timer = 0;
  const started =
    typeof performance !== "undefined" ? performance.now() : Date.now();

  const schedule = () => {
    if (cancelled) return;
    const now =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    const elapsed = now - started;
    if (elapsed >= durationMs - 120) return;
    // ctx running değilse sessiz (console error yok)
    if (canPlay()) playTick();
    const p = Math.min(1, elapsed / durationMs);
    // başta hızlı, sonda dramatik yavaşlama
    const gap = 42 + p * p * p * 380;
    timer = window.setTimeout(schedule, gap);
  };
  timer = window.setTimeout(schedule, 50);

  return () => {
    cancelled = true;
    window.clearTimeout(timer);
  };
}
