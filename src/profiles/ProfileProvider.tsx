import { openSettings } from "../lib/settingsNavigation";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useHubStore } from "../store/useHubStore";
import { webrtcEngine } from "../lib/webrtcEngine";
import {
  defaultProfile,
  validateProfile,
  type UserProfile,
} from "./model";
import {
  blockedIds,
  encodeWebpBlobFromDataUrl,
  loadProfile,
  saveProfile,
  setBlocked,
} from "./repository";
import { supabase, type DbOnlineStatus } from "../lib/supabase";

interface Context {
  own: UserProfile;
  error: string;
  selected: string | null;
  editing: boolean;
  full: boolean;
  blocked: string[];
  view: (id: string) => void;
  edit: () => void;
  close: () => void;
  expand: () => void;
  save: (p: UserProfile) => Promise<boolean>;
  block: (id: string, value: boolean) => void;
}

const Profiles = createContext<Context | null>(null);

export function useProfiles() {
  const context = useContext(Profiles);
  if (!context) throw new Error("ProfileProvider ausente");
  return context;
}

function mapPresenceToCloudStatus(
  presence: UserProfile["presence"],
): DbOnlineStatus {
  if (presence === "away") return "idle";
  if (presence === "invisible" || presence === "offline") return "invisible";
  return "online";
}

export function ProfileProvider({ children }: { children: ReactNode }) {
  const ownerId = useHubStore((s) => s.authUserId || s.clientId);
  const storeNickname = useHubStore((s) => s.nickname);
  const storeColor = useHubStore((s) => s.avatarColor);
  const storeAvatarUrl = useHubStore((s) => s.customAvatarUrl);
  const storeBannerUrl = useHubStore((s) => s.bannerUrl);

  const [initial] = useState(() => {
    const state = useHubStore.getState();
    const initialOwner = state.authUserId || state.clientId;
    try {
      return {
        profile: loadProfile(initialOwner, state.nickname),
        error: "",
      };
    } catch (e) {
      return {
        profile: defaultProfile(initialOwner, state.nickname),
        error: (e as Error).message,
      };
    }
  });

  const [own, setOwn] = useState(initial.profile),
    [error, setError] = useState(initial.error),
    [selected, setSelected] = useState<string | null>(null),
    [editing, setEditing] = useState(false),
    [full, setFull] = useState(false),
    [blocked, setBlockedState] = useState(blockedIds);

  // Sincroniza perfil local tendo public.profiles (store) como fonte de verdade quando logado
  useEffect(() => {
    try {
      const isAuthenticated = Boolean(useHubStore.getState().authUserId);
      const loaded = loadProfile(ownerId, storeNickname);
      const next: UserProfile = {
        ...loaded,
        ownerId,
        displayName:
          isAuthenticated && storeNickname && storeNickname !== "Usuário"
            ? storeNickname.slice(0, 40)
            : loaded.displayName,
        avatar:
          isAuthenticated && storeAvatarUrl
            ? storeAvatarUrl
            : isAuthenticated && storeAvatarUrl === null
              ? ""
              : loaded.avatar,
        banner:
          isAuthenticated && storeBannerUrl
            ? storeBannerUrl
            : isAuthenticated && storeBannerUrl === null
              ? ""
              : loaded.banner,
        appearance: {
          ...loaded.appearance,
          color:
            isAuthenticated && /^#[0-9a-f]{6}$/i.test(storeColor)
              ? storeColor
              : loaded.appearance.color,
        },
      };
      const persisted = saveProfile(next, ownerId);
      setOwn(persisted);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, [ownerId, storeNickname, storeColor, storeAvatarUrl, storeBannerUrl]);

  useEffect(() => {
    const change = () => {
      setBlockedState(blockedIds());
      webrtcEngine.refreshLocalProfile();
    };
    window.addEventListener("cbshub-profile-changed", change);
    return () => window.removeEventListener("cbshub-profile-changed", change);
  }, []);

  useEffect(() => {
    const state = useHubStore.getState();
    if (!state.authUserId) {
      state.setNickname(own.displayName);
      state.setAvatarColor(own.appearance.color);
    }
  }, [own]);

  const value: Context = {
    own,
    error,
    selected,
    editing,
    full,
    blocked,
    view: (id) => {
      setSelected(id);
      setEditing(false);
      setFull(false);
    },
    edit: () => {
      setSelected(null);
      setEditing(false);
      setFull(true);
      openSettings("profile");
    },
    expand: () => setFull(true),
    close: () => {
      setSelected(null);
      setEditing(false);
    },
    save: async (draft) => {
      try {
        const state = useHubStore.getState();
        const currentOwner = state.authUserId || state.clientId;
        const normalizedDraft: UserProfile = {
          ...draft,
          ownerId: currentOwner,
        };
        const clean = validateProfile(normalizedDraft, currentOwner);
        if (
          Object.values(state.participants).some(
            (p) =>
              p.clientId !== currentOwner &&
              p.profile?.username === clean.username,
          )
        ) {
          throw new Error("Nome de usuário já utilizado nesta sala.");
        }

        let finalAvatar = clean.avatar;
        let finalBanner = clean.banner;

        if (state.authUserId) {
          const userId = state.authUserId;
          let nextCloudAvatar: string | null | undefined;
          let nextCloudBanner: string | null | undefined;

          if (clean.avatar.startsWith("data:image/")) {
            const blob = await encodeWebpBlobFromDataUrl(clean.avatar, "avatar");
            const path = `${userId}/avatar.webp`;
            const { error: uploadErr } = await supabase.storage
              .from("cbs-profiles")
              .upload(path, blob, {
                upsert: true,
                contentType: "image/webp",
              });
            if (uploadErr) {
              throw new Error(`Erro ao enviar avatar: ${uploadErr.message}`);
            }
            const { data: pub } = supabase.storage
              .from("cbs-profiles")
              .getPublicUrl(path);
            finalAvatar = `${pub.publicUrl}?t=${Date.now()}`;
            nextCloudAvatar = finalAvatar;
          } else if (clean.avatar === "" && own.avatar !== "") {
            await supabase.storage
              .from("cbs-profiles")
              .remove([`${userId}/avatar.webp`])
              .catch(() => {});
            nextCloudAvatar = null;
          } else if (clean.avatar) {
            nextCloudAvatar = clean.avatar;
          }

          if (clean.banner.startsWith("data:image/")) {
            const blob = await encodeWebpBlobFromDataUrl(clean.banner, "banner");
            const path = `${userId}/banner.webp`;
            const { error: uploadErr } = await supabase.storage
              .from("cbs-profiles")
              .upload(path, blob, {
                upsert: true,
                contentType: "image/webp",
              });
            if (uploadErr) {
              throw new Error(`Erro ao enviar capa: ${uploadErr.message}`);
            }
            const { data: pub } = supabase.storage
              .from("cbs-profiles")
              .getPublicUrl(path);
            finalBanner = `${pub.publicUrl}?t=${Date.now()}`;
            nextCloudBanner = finalBanner;
          } else if (clean.banner === "" && own.banner !== "") {
            await supabase.storage
              .from("cbs-profiles")
              .remove([`${userId}/banner.webp`])
              .catch(() => {});
            nextCloudBanner = null;
          } else if (clean.banner) {
            nextCloudBanner = clean.banner;
          }

          const customText = [clean.emoji, clean.status]
            .filter(Boolean)
            .join(" ")
            .trim();

          await webrtcEngine.updateCloudProfile({
            nickname: clean.displayName,
            avatar_color: clean.appearance.color,
            custom_status: customText || null,
            online_status: mapPresenceToCloudStatus(clean.presence),
            ...(nextCloudAvatar !== undefined
              ? { custom_avatar_url: nextCloudAvatar }
              : {}),
            ...(nextCloudBanner !== undefined
              ? { banner_url: nextCloudBanner }
              : {}),
          });

          state.setProfileMediaUrls(
            nextCloudAvatar !== undefined ? nextCloudAvatar : state.customAvatarUrl,
            nextCloudBanner !== undefined ? nextCloudBanner : state.bannerUrl,
          );
        }

        const saved = saveProfile(
          {
            ...clean,
            avatar: finalAvatar,
            banner: finalBanner,
          },
          currentOwner,
        );
        setOwn(saved);
        setError("");

        state.setNickname(saved.displayName);
        state.setAvatarColor(saved.appearance.color);

        window.dispatchEvent(new Event("cbshub-profile-changed"));
        setEditing(false);
        setSelected(null);
        return true;
      } catch (e) {
        const message =
          e instanceof Error
            ? e.message
            : typeof e === "object" && e !== null && "message" in e
              ? String((e as { message: unknown }).message)
              : String(e || "Falha ao salvar perfil.");
        setError(message);
        return false;
      }
    },
    block: (id, value) => {
      try {
        const state = useHubStore.getState();
        setBlocked(id, value, state.authUserId || state.clientId);
        setError("");
      } catch (e) {
        setError((e as Error).message);
      }
    },
  };

  return <Profiles.Provider value={value}>{children}</Profiles.Provider>;
}
