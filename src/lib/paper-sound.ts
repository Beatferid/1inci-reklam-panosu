let sharedCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  if (!sharedCtx || sharedCtx.state === "closed") {
    sharedCtx = new Ctor();
  }
  if (sharedCtx.state === "suspended") {
    void sharedCtx.resume().catch(() => null);
  }
  return sharedCtx;
}

/**
 * Kağıt sayfası çevirme sesi — beyaz gürültüden sentezlenir, ek ses dosyası
 * gerekmez. "next" ileri çevirmede tiz→pes, "prev" geri çevirmede pes→tiz
 * süpürme yaparak yöne göre hafifçe farklı bir karakter verir.
 */
export function playPageFlipSound(volume = 0.5, direction: "next" | "prev" = "next") {
  try {
    const ctx = getCtx();
    if (!ctx) return;

    const duration = direction === "prev" ? 0.29 : 0.32;
    const sampleRate = ctx.sampleRate;
    const bufferSize = Math.floor(sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const decay = Math.pow(1 - i / bufferSize, 1.6);
      data[i] = (Math.random() * 2 - 1) * decay;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const bandpass = ctx.createBiquadFilter();
    bandpass.type = "bandpass";
    bandpass.Q.value = 0.65;
    const [freqFrom, freqTo] =
      direction === "prev" ? [2200, 4200] : [3400, 750];
    bandpass.frequency.setValueAtTime(freqFrom, ctx.currentTime);
    bandpass.frequency.exponentialRampToValueAtTime(
      freqTo,
      ctx.currentTime + duration,
    );

    const highpass = ctx.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.value = 500;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      Math.max(0.05, volume),
      ctx.currentTime + 0.025,
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

    noise.connect(bandpass);
    bandpass.connect(highpass);
    highpass.connect(gain);
    gain.connect(ctx.destination);

    noise.start();
    noise.stop(ctx.currentTime + duration);
  } catch {
    // ses politikası engelleyebilir — sessizce yut
  }
}
