import { memo } from "react";
import { ChatPanel } from "../chat/ChatPanel";
import { useHubStore } from "../store/useHubStore";

export const TextChatSection = memo(function TextChatSection() {
  const contextKey = useHubStore((state) => {
    if (state.activeContext?.type === "room") {
      return `room:${state.activeContext.roomId}`;
    }
    if (state.activeContext?.type === "dm") {
      return `dm:${state.activeContext.channelId}`;
    }
    return state.activeChannelId || "no-context";
  });
  return <ChatPanel key={contextKey} />;
});
