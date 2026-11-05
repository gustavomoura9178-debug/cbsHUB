import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { useSidebarControls } from "../hooks/useSidebarControls";
import { CallControlDock } from "./CallControlDock";
import { Button } from "./ui/button";
export function CallControls() {
  const sidebar = useSidebarControls(),
    [expanded, setExpanded] = useState(false);
  if (!sidebar) return <CallControlDock />;
  return (
    <div className="flex flex-col items-center gap-1 min-w-0">
      <Button
        size="sm"
        variant="ghost"
        aria-expanded={expanded}
        aria-controls="advanced-call-controls"
        onClick={() => setExpanded((v) => !v)}
      >
        <SlidersHorizontal className="size-3.5 mr-2" />
        {expanded ? "Ocultar opções da chamada" : "Dispositivos e opções"}
      </Button>
      {expanded && (
        <div id="advanced-call-controls">
          <CallControlDock />
        </div>
      )}
    </div>
  );
}
