/** Last-resort sample peak ceiling after mixing; unity below the ceiling.
 * This is not a loudness normalizer or a network failure detector. */
export function createAudioPeakGuard(
  context: BaseAudioContext,
): WaveShaperNode {
  const node = context.createWaveShaper();
  const curve = new Float32Array(4097);
  for (let i = 0; i < curve.length; i++) {
    const sample = (i / (curve.length - 1)) * 2 - 1;
    curve[i] = Math.max(-0.98, Math.min(0.98, sample));
  }
  node.curve = curve;
  node.oversample = "none";
  return node;
}
export function safeAudioGain(
  value: number,
  fallback = 1,
  maximum = 2,
): number {
  return Number.isFinite(value)
    ? Math.max(0, Math.min(maximum, value))
    : fallback;
}
