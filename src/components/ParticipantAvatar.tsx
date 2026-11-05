import { Avatar, AvatarFallback } from "./ui/avatar";
import { cn } from "../lib/utils";
interface Props {
  name: string;
  color?: string;
  speaking?: boolean;
  className?: string;
}
export function ParticipantAvatar({ name, color, speaking, className }: Props) {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";
  return (
    <Avatar
      className={cn(
        "participant-avatar",
        speaking && "participant-avatar-speaking",
        className,
      )}
    >
      <AvatarFallback
        style={{ backgroundColor: color || "var(--primary)" }}
        className="text-white"
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
