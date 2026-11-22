import { supabase } from "./supabase";
import { useHubStore } from "../store/useHubStore";
import { storageDb } from "./storageDb";
import { soundboardEngine } from "./soundboardEngine";
import type {
  AudioProcessingConfig,
  VideoQualityConfig,
} from "../types/cbshub";

let syncTimer: number | null = null;
let hydrating = false;

function stripMachineDeviceIds(
  cfg: Partial<AudioProcessingConfig> | Record<string, unknown>,
): Partial<AudioProcessingConfig> {
  const {
    inputDeviceId: _inId,
    outputDeviceId: _outId,
    videoDeviceId: _vidId,
    ...portable
  } = cfg as Partial<AudioProcessingConfig>;
  return portable;
}

export async function loadCloudSettings(userId: string): Promise<void> {
  hydrating = true;
  try {
    const { data, error } = await supabase
      .from("user_settings")
      .select("user_id, audio_config, video_config, soundboard_favorites")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.warn(
        "[CloudSettings] Falha ao carregar user_settings:",
        error.message,
      );
      return;
    }

    const store = useHubStore.getState();
    if (data?.audio_config && typeof data.audio_config === "object") {
      // Nunca sobrescreve IDs de microfone/saída/webcam locais da máquina
      const portableAudio = stripMachineDeviceIds(data.audio_config);
      if (Object.keys(portableAudio).length > 0) {
        store.updateAudioConfig(portableAudio);
      }
    }

    if (data?.video_config && typeof data.video_config === "object") {
      const vc = data.video_config as Partial<VideoQualityConfig>;
      if (vc.resolution && vc.fps) {
        store.updateVideoQuality(
          vc.resolution,
          vc.fps,
          vc.includeSystemAudio ?? true,
        );
      }
    }

    if (Array.isArray(data?.soundboard_favorites)) {
      const favSet = new Set(
        data.soundboard_favorites.filter(
          (id): id is string => typeof id === "string",
        ),
      );
      const clips = await soundboardEngine.loadAllClips();
      for (const clip of clips) {
        const shouldBeFav = favSet.has(clip.id);
        if (clip.isFavorite !== shouldBeFav) {
          await storageDb.saveSoundboardClip({
            ...clip,
            isFavorite: shouldBeFav,
          });
        }
      }
      await soundboardEngine.loadAllClips();
    }
  } finally {
    hydrating = false;
  }
}

export function scheduleCloudSettingsSync(): void {
  if (hydrating) return;
  const state = useHubStore.getState();
  if (!state.authUserId) return;

  if (syncTimer !== null) {
    window.clearTimeout(syncTimer);
  }
  syncTimer = window.setTimeout(() => {
    syncTimer = null;
    void pushCloudSettingsNow();
  }, 400);
}

const CLOUD_SETTINGS_DIRTY_EVENT = "cbshub-cloud-settings-dirty";
const CLOUD_DIRTY_HANDLER_KEY = "__cbshubCloudDirtyHandler";

if (typeof window !== "undefined") {
  const win = window as unknown as Record<string, (() => void) | undefined>;
  const existingHandler = win[CLOUD_DIRTY_HANDLER_KEY];
  if (existingHandler) {
    window.removeEventListener(CLOUD_SETTINGS_DIRTY_EVENT, existingHandler);
  }
  const onCloudSettingsDirty = () => {
    scheduleCloudSettingsSync();
  };
  win[CLOUD_DIRTY_HANDLER_KEY] = onCloudSettingsDirty;
  window.addEventListener(CLOUD_SETTINGS_DIRTY_EVENT, onCloudSettingsDirty);
}

export async function pushCloudSettingsNow(): Promise<void> {
  const state = useHubStore.getState();
  if (!state.authUserId) return;

  const favoriteIds = state.soundboardClips
    .filter((c) => c.isFavorite)
    .map((c) => c.id);

  // Sincroniza apenas preferências portáveis (jamais IDs de hardware da máquina)
  const portableAudio = stripMachineDeviceIds(state.audioConfig);

  try {
    const { error } = await supabase.from("user_settings").upsert(
      {
        user_id: state.authUserId,
        audio_config: portableAudio,
        video_config: { ...state.videoQualityConfig },
        soundboard_favorites: favoriteIds,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) {
      console.warn(
        "[CloudSettings] Erro ao sincronizar user_settings:",
        error.message,
      );
    }
  } catch (err) {
    console.warn("[CloudSettings] Falha de rede ao sincronizar:", err);
  }
}
