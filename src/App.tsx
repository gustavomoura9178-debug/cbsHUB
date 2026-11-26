import { useMediaState } from "./lib/mediaState";
import {
  BootSplash,
  ConnectionScreen,
  hydrateAuthenticatedUser,
} from "./components/ConnectionScreen";
import { IncomingCallModal } from "./components/IncomingCallModal";
import { usePushToTalk } from "./hooks/usePushToTalk";
import { useShallow } from "zustand/react/shallow";
import React, { useEffect, useRef, useState } from "react";
import { TitleBar } from "./components/TitleBar";
import { LeftSidebar } from "./components/LeftSidebar";
import { RoomTopBar } from "./components/RoomTopBar";
import { CallStagePanel } from "./components/CallStagePanel";
import { TextChatSection } from "./components/TextChatSection";
import { ScreenPickerModal } from "./components/ScreenPickerModal";
import { SettingsModal } from "./components/SettingsModal";
import { UpdateAvailableModal } from "./components/UpdateAvailableModal";
import { TooltipProvider } from "./components/ui/tooltip";
import { useHubStore } from "./store/useHubStore";
import { webrtcEngine } from "./lib/webrtcEngine";
import { supabase } from "./lib/supabase";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "./components/ui/sheet";
import { useMediaQuery } from "./hooks/useWorkspaceLayout";
import { ProfileDialog } from "./profiles/ProfileDialog";

export const App: React.FC = () => {
  usePushToTalk();
  const trayInVoice = useHubStore((s) => s.inVoiceCall);
  const trayReconnecting = useMediaState((s) => s.reconnecting);
  const authUserId = useHubStore((s) => s.authUserId);

  useEffect(() => {
    window.cbsHubAPI?.updateTrayState?.({
      inVoiceCall: trayInVoice,
      reconnecting: trayReconnecting,
    });
  }, [trayInVoice, trayReconnecting]);

  const [booting, setBooting] = useState(true);
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const promptedUpdateVersionsRef = useRef<Set<string>>(new Set());
  const [isOffline, setIsOffline] = useState(
    () => typeof navigator !== "undefined" && !navigator.onLine,
  );
  const {
    isSettingsOpen,
    isScreenPickerOpen,
    setIsSettingsOpen,
    setIsScreenPickerOpen,
  } = useHubStore(
    useShallow((state) => ({
      isSettingsOpen: state.isSettingsOpen,
      isScreenPickerOpen: state.isScreenPickerOpen,
      setIsSettingsOpen: state.setIsSettingsOpen,
      setIsScreenPickerOpen: state.setIsScreenPickerOpen,
    })),
  );

  const compact = useMediaQuery("(max-width: 767px)");
  const [navigationOpen, setNavigationOpen] = useState(false);

  // Inicialização da sessão Supabase Auth + Cloud Realtime
  useEffect(() => {
    let active = true;

    const initAuth = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!active) return;
        if (data.session?.user) {
          await hydrateAuthenticatedUser(data.session.user);
          await webrtcEngine.initializeCloudSession(data.session.user.id);
        }
      } catch (err) {
        console.warn("[App] Erro ao restaurar sessão:", err);
      } finally {
        if (active) setBooting(false);
      }
    };

    void initAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!active) return;
        if (session?.user) {
          void hydrateAuthenticatedUser(session.user).then(() =>
            webrtcEngine.initializeCloudSession(session.user.id),
          );
        } else {
          webrtcEngine.leaveRoom();
          webrtcEngine.teardownCloudSubscriptions();
          useHubStore.getState().logoutClearState();
        }
      },
    );

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
      webrtcEngine.leaveRoom();
      webrtcEngine.teardownCloudSubscriptions();
    };
  }, []);

  useEffect(() => {
    const handleUpdateState = (state: { status: string; version?: string }) => {
      if (state.status === "available") {
        const versionKey = state.version || "latest";
        if (!promptedUpdateVersionsRef.current.has(versionKey)) {
          promptedUpdateVersionsRef.current.add(versionKey);
          setUpdateModalOpen(true);
        }
      }
    };

    void window.cbsHubAPI
      ?.getUpdateState?.()
      .then((initial) => {
        if (initial) {
          useHubStore.getState().setAppUpdate(initial);
          handleUpdateState(initial);
        }
      })
      .catch(() => {});

    const unsub = window.cbsHubAPI?.onUpdateStatus?.((state) => {
      useHubStore.getState().setAppUpdate(state);
      handleUpdateState(state);
    });
    return () => {
      unsub?.();
    };
  }, []);

  useEffect(() => {
    const goOnline = () => {
      setIsOffline(false);
      webrtcEngine.notifyNetwork(true);
    };
    const goOffline = () => {
      setIsOffline(true);
      webrtcEngine.notifyNetwork(false);
    };
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    // Verificação periódica a cada 3s enquanto estiver offline para retomar imediatamente
    const pollId = window.setInterval(() => {
      if (navigator.onLine) {
        setIsOffline((was) => {
          if (was) {
            webrtcEngine.notifyNetwork(true);
            return false;
          }
          return false;
        });
      }
    }, 3000);

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      window.clearInterval(pollId);
    };
  }, []);

  // Listener global de teclado (ESC fecha modais ativos)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isScreenPickerOpen) setIsScreenPickerOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    isSettingsOpen,
    isScreenPickerOpen,
    setIsSettingsOpen,
    setIsScreenPickerOpen,
  ]);

  if (booting || isOffline) {
    return (
      <TooltipProvider>
        <TitleBar />
        <BootSplash
          message={
            isOffline
              ? "Conexão perdida. Reconectando automaticamente…"
              : "Preparando seu espaço…"
          }
        />
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className="workspace-root">
        <TitleBar />
        {!authUserId ? (
          <ConnectionScreen />
        ) : (
          <div className="workspace-body">
            {!compact && (
              <div className="workspace-sidebar w-60 shrink-0">
                <LeftSidebar />
              </div>
            )}
            <main className="workspace-main" id="conversation-workspace">
              <RoomTopBar
                onOpenMobileSidebar={() => setNavigationOpen(true)}
              />
              <div className="workspace-content">
                <div className="workspace-conversation">
                  <CallStagePanel />
                  <TextChatSection />
                </div>
              </div>
            </main>
          </div>
        )}

        <Sheet
          open={compact && navigationOpen}
          onOpenChange={setNavigationOpen}
        >
          <SheetContent side="left">
            <SheetTitle className="sr-only">Amigos e DMs</SheetTitle>
            <SheetDescription className="sr-only">
              Selecione um amigo ou gerencie solicitações de amizade.
            </SheetDescription>
            <LeftSidebar onNavigate={() => setNavigationOpen(false)} />
          </SheetContent>
        </Sheet>

        <IncomingCallModal />
        <ScreenPickerModal />
        <SettingsModal />
        <ProfileDialog />
        <UpdateAvailableModal
          open={updateModalOpen}
          onOpenChange={setUpdateModalOpen}
        />
      </div>
    </TooltipProvider>
  );
};

export default App;
