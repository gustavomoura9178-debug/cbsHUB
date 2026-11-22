import { useEffect, type RefObject } from "react";
import { useHubStore } from "../store/useHubStore";

export async function applySafeSinkId(
  target:
    | { setSinkId?: (id: string) => Promise<void> }
    | null
    | undefined,
  deviceId: string,
): Promise<void> {
  if (!target || typeof target.setSinkId !== "function") return;
  if (!deviceId || deviceId === "default") {
    try {
      await target.setSinkId("");
    } catch {
      /* ignore */
    }
    return;
  }

  try {
    if (
      typeof navigator !== "undefined" &&
      navigator.mediaDevices?.enumerateDevices
    ) {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const exists = devices.some(
        (d) => d.kind === "audiooutput" && d.deviceId === deviceId,
      );
      if (!exists) {
        useHubStore
          .getState()
          .updateAudioConfig({ outputDeviceId: "default" });
        await target.setSinkId("").catch(() => {});
        return;
      }
    }
    await target.setSinkId(deviceId);
  } catch {
    useHubStore.getState().updateAudioConfig({ outputDeviceId: "default" });
    try {
      await target.setSinkId("");
    } catch {
      /* ignore */
    }
  }
}

export function useMediaOutput(
  ref: RefObject<HTMLMediaElement | null>,
  clientId: string,
  stream: MediaStream | null | undefined,
) {
  const output = useHubStore((s) => s.audioConfig.outputDeviceId);
  const master = useHubStore((s) => s.audioConfig.remoteStreamVolume);
  const isDeafened = useHubStore((s) => s.isDeafened);
  const volume = useHubStore((s) => s.peerVolumes[clientId] ?? 1);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.volume = isDeafened ? 0 : Math.max(0, Math.min(1, volume) * master);
    void applySafeSinkId(
      element as HTMLMediaElement & { setSinkId?: (id: string) => Promise<void> },
      output,
    );
  }, [ref, stream, output, master, volume, isDeafened]);
}
