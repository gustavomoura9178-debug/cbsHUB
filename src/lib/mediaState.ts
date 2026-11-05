import { create } from "zustand";

export interface CallQuality {
  state: RTCPeerConnectionState;
  rttMs: number | null;
  loss: number | null;
}
interface MediaState {
  error: string | null;
  microphoneBusy: boolean;
  cameraBusy: boolean;
  screenBusy: boolean;
  reconnecting: boolean;
  quality: Record<string, CallQuality>;
}
export const useMediaState = create<MediaState>(() => ({
  error: null,
  microphoneBusy: false,
  cameraBusy: false,
  screenBusy: false,
  reconnecting: false,
  quality: {},
}));
export function mediaError(action: string, error: unknown) {
  const detail = error instanceof Error ? error.message : String(error);
  useMediaState.setState({ error: `${action}: ${detail}` });
}
export const supportsAudioOutput = () =>
  typeof HTMLMediaElement !== "undefined" &&
  "setSinkId" in HTMLMediaElement.prototype;
