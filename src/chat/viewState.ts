import { create } from "zustand";
export interface ChatView {
  searchOpen: boolean;
  query: string;
  pinned: boolean;
  activities: boolean;
}
export const EMPTY_CHAT_VIEW: ChatView = {
  searchOpen: false,
  query: "",
  pinned: false,
  activities: false,
};
function readCompact() {
  try {
    return localStorage.getItem("cbshub-chat-density") === "compact";
  } catch {
    return false;
  }
}
export const useChatView = create<{
  views: Record<string, ChatView>;
  compact: boolean;
}>(() => ({ views: Object.create(null), compact: readCompact() }));
export function updateChatView(room: string, patch: Partial<ChatView>) {
  useChatView.setState((state) => {
    const views = Object.assign(Object.create(null), state.views);
    views[room] = { ...EMPTY_CHAT_VIEW, ...state.views[room], ...patch };
    const keys = Object.keys(views);
    for (const key of keys.slice(0, Math.max(0, keys.length - 20)))
      delete views[key];
    return { views };
  });
}
export function setChatCompact(compact: boolean) {
  localStorage.setItem(
    "cbshub-chat-density",
    compact ? "compact" : "comfortable",
  );
  useChatView.setState({ compact });
}
