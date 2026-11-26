import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { cn } from "../lib/utils";
import { useProfiles } from "../profiles/ProfileProvider";
import { useHubStore } from "../store/useHubStore";

interface Props {
  clientId?: string;
  isLocal?: boolean;
  interactive?: boolean;
  name: string;
  color?: string;
  speaking?: boolean;
  className?: string;
}

export function ParticipantAvatar({
  name,
  color,
  speaking,
  className,
  clientId,
  isLocal = false,
  interactive = true,
}: Props) {
  const profiles = useProfiles();
  const authUserId = useHubStore((s) => s.authUserId);
  const storeClientId = useHubStore((s) => s.clientId);
  const customAvatarUrl = useHubStore((s) => s.customAvatarUrl);
  const friendAvatarUrl = useHubStore(
    (s) => s.friends.find((f) => f.id === clientId)?.avatarUrl,
  );
  const remote = useHubStore(
    (state) =>
      Object.values(state.participants).find((p) => p.clientId === clientId)
        ?.profile,
  );
  const isOwn =
    isLocal ||
    (Boolean(clientId) &&
      (clientId === profiles.own.ownerId ||
        clientId === authUserId ||
        clientId === storeClientId));
  const profile = isOwn ? profiles.own : remote;
  const visible = isOwn || (clientId && !profiles.blocked.includes(clientId));
  const avatar = visible
    ? isOwn
      ? profile?.avatar || customAvatarUrl
      : profile?.avatar || friendAvatarUrl
    : undefined;
  const targetViewId = isOwn ? profiles.own.ownerId : clientId;

  const initials =
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";

  const content = (
    <Avatar
      className={cn(
        "participant-avatar overflow-hidden",
        speaking && "participant-avatar-speaking",
        className,
      )}
    >
      {avatar && <AvatarImage src={avatar} alt="" className="object-cover" />}
      <AvatarFallback
        style={{ backgroundColor: color || "var(--primary)" }}
        className="text-white"
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  );

  return targetViewId && interactive ? (
    <button
      type="button"
      className="profile-avatar-trigger"
      aria-label={`Ver perfil de ${name}`}
      onClick={() => profiles.view(targetViewId)}
    >
      {content}
    </button>
  ) : (
    content
  );
}
