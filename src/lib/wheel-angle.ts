/** Görsel dilimde prizeId'nin orta açısı (0° = üst, saat yönü). Client-safe. */
export function prizeTargetRotation(
  slices: { id: string; isEmpty?: boolean; slicePercent: number }[],
  prizeId: string,
): number {
  const mids: number[] = [];
  let acc = 0;
  for (const s of slices) {
    const sweep = Math.max(0.5, s.slicePercent);
    const midPct = acc + sweep / 2;
    if (
      s.id === prizeId ||
      s.id.startsWith(`${prizeId}-sep-`) ||
      (Boolean(s.isEmpty) && Boolean(prizeId) && s.id.includes(prizeId))
    ) {
      mids.push((midPct / 100) * 360);
    }
    acc += sweep;
  }
  if (mids.length === 0) {
    acc = 0;
    for (const s of slices) {
      const sweep = Math.max(0.5, s.slicePercent);
      const midPct = acc + sweep / 2;
      if (s.isEmpty) {
        const midDeg = (midPct / 100) * 360;
        return (360 - midDeg + 360) % 360;
      }
      acc += sweep;
    }
    return 0;
  }
  const midDeg = mids[Math.floor(mids.length / 2)]!;
  return (360 - midDeg + 360) % 360;
}
