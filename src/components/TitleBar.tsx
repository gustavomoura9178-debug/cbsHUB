import React, { useState } from "react";
import { Minus, Square, X, Pin, Radio, SlidersHorizontal } from "lucide-react";
import { useHubStore } from "../store/useHubStore";
import { Tooltip, TooltipTrigger, TooltipContent } from "./ui/tooltip";

export const TitleBar: React.FC = () => {
  const {
    roomId,
    isConnected,
    isAlwaysOnTop,
    setAlwaysOnTop,
    telemetry,
    participants,
    setIsSettingsOpen,
  } = useHubStore();

  const [isMaximized, setIsMaximized] = useState(false);

  const handleMinimize = () => {
    if (window.cbsHubAPI) {
      window.cbsHubAPI.minimizeWindow();
    } else {
      console.warn("[TitleBar] cbsHubAPI indisponível no renderer.");
    }
  };

  const handleMaximize = () => {
    if (window.cbsHubAPI) {
      window.cbsHubAPI.maximizeWindow();
      setIsMaximized((prev) => !prev);
    } else {
      console.warn("[TitleBar] cbsHubAPI indisponível no renderer.");
    }
  };

  const handleClose = () => {
    if (window.cbsHubAPI) {
      window.cbsHubAPI.closeWindow();
    } else {
      console.warn("[TitleBar] cbsHubAPI indisponível no renderer.");
    }
  };

  const togglePin = () => {
    const nextVal = !isAlwaysOnTop;
    setAlwaysOnTop(nextVal);
    if (window.cbsHubAPI) {
      window.cbsHubAPI.setAlwaysOnTop(nextVal);
    }
  };

  const participantCount = Object.keys(participants).length || 1;

  return (
    <header className="native-titlebar drag-region">
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-semibold tracking-tight text-caption text-foreground">
          cbs<span className="text-primary">HUB</span>
        </span>
        <span className="hidden sm:inline text-2xs text-muted-foreground">
          Um espaço para suas pessoas
        </span>
      </div>
      <div className="flex items-center gap-1 no-drag">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="native-window-button"
              aria-label={isAlwaysOnTop ? "Desafixar do topo" : "Fixar no topo"}
              aria-pressed={isAlwaysOnTop}
              onClick={togglePin}
            >
              <Pin
                className={`size-3 ${isAlwaysOnTop ? "text-primary" : ""}`}
              />
            </button>
          </TooltipTrigger>
          <TooltipContent>Manter janela no topo</TooltipContent>
        </Tooltip>
        <span className="h-3 w-px bg-border mx-1" />
        <button
          type="button"
          onClick={handleMinimize}
          aria-label="Minimizar janela"
          className="native-window-button"
        >
          <Minus className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={handleMaximize}
          aria-label={isMaximized ? "Restaurar janela" : "Maximizar janela"}
          className="native-window-button"
        >
          <Square className="size-3" />
        </button>
        <button
          type="button"
          onClick={handleClose}
          aria-label="Fechar janela"
          className="native-window-button hover:bg-destructive hover:text-destructive-foreground"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </header>
  );
};
