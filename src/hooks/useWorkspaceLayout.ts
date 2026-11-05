import { useEffect, useState } from "react";

const KEY = "cbshub-workspace-layout";
export const SIDEBAR_MIN = 224;
export const SIDEBAR_MAX = 360;
export const SIDEBAR_DEFAULT = 264;
interface LayoutPreferences {
  sidebarWidth: number;
  sidebarCollapsed: boolean;
  membersOpen: boolean;
}
const defaults: LayoutPreferences = {
  sidebarWidth: SIDEBAR_DEFAULT,
  sidebarCollapsed: false,
  membersOpen: true,
};

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(
    () => window.matchMedia(query).matches,
  );
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);
  return matches;
}

export function useWorkspaceLayout() {
  const [layout, setLayout] = useState<LayoutPreferences>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || "{}");
      return {
        sidebarWidth:
          typeof saved.sidebarWidth === "number" &&
          Number.isFinite(saved.sidebarWidth)
            ? Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, saved.sidebarWidth))
            : defaults.sidebarWidth,
        sidebarCollapsed:
          typeof saved.sidebarCollapsed === "boolean"
            ? saved.sidebarCollapsed
            : defaults.sidebarCollapsed,
        membersOpen:
          typeof saved.membersOpen === "boolean"
            ? saved.membersOpen
            : defaults.membersOpen,
      };
    } catch {
      return defaults;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(layout));
    } catch {
      /* Storage may be unavailable. */
    }
  }, [layout]);
  return {
    ...layout,
    setSidebarWidth: (sidebarWidth: number) =>
      setLayout((current) => ({
        ...current,
        sidebarWidth: Math.max(
          SIDEBAR_MIN,
          Math.min(SIDEBAR_MAX, sidebarWidth),
        ),
      })),
    toggleSidebar: () =>
      setLayout((current) => ({
        ...current,
        sidebarCollapsed: !current.sidebarCollapsed,
      })),
    toggleMembers: () =>
      setLayout((current) => ({
        ...current,
        membersOpen: !current.membersOpen,
      })),
  };
}
