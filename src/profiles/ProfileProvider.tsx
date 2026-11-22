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
import { blockedIds, loadProfile, saveProfile, setBlocked } from "./repository";
import type { DbOnlineStatus } from "../lib/supabase";

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
  save: (p: UserProfile) => boolean;
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
  }, [ownerId, storeNickname, storeColor]);

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
    save: (draft) => {
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
        const saved = saveProfile(clean, currentOwner);
        setOwn(saved);
        setError("");

        state.setNickname(saved.displayName);
        state.setAvatarColor(saved.appearance.color);

        if (state.authUserId) {
          const customText = [saved.emoji, saved.status]
            .filter(Boolean)
            .join(" ")
            .trim();
          void webrtcEngine
            .updateCloudProfile({
              nickname: saved.displayName,
              avatar_color: saved.appearance.color,
              custom_status: customText || null,
              online_status: mapPresenceToCloudStatus(saved.presence),
            })
            .catch(() => {});
        }

        window.dispatchEvent(new Event("cbshub-profile-changed"));
        setEditing(false);
        setSelected(null);
        return true;
      } catch (e) {
        setError((e as Error).message);
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
