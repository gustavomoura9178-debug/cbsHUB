import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { useSidebarControls } from "../hooks/useSidebarControls";
import { CallControlDock } from "./CallControlDock";
import { Popover, PopoverTrigger, PopoverContent } from "./ui/popover";
import { Button } from "./ui/button";
export function CallControls({ compact = false }: { compact?: boolean }) {
  const sidebar = useSidebarControls(),
    [expanded, setExpanded] = useState(false);
  if (compact)
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Dispositivos e opções"
            title="Dispositivos e opções"
          >
            <SlidersHorizontal className="size-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align="end"
          className="w-auto max-w-[calc(100vw-2rem)] max-h-[70dvh] overflow-y-auto"
        >
          <CallControlDock />
        </PopoverContent>
      </Popover>
    );
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
