import React from "react";
import { ArrowRight, Download, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { AnimatedLogo } from "./AnimatedLogo";
import { APP_VERSION, sanitizeReleaseNotes } from "../lib/appUpdaterUi";
import { useHubStore } from "../store/useHubStore";

export interface UpdateAvailableModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const UpdateAvailableModal: React.FC<UpdateAvailableModalProps> = ({
  open,
  onOpenChange,
}) => {
  const appUpdate = useHubStore((s) => s.appUpdate);
  const newVersion = appUpdate.version || APP_VERSION;
  const notes = sanitizeReleaseNotes(appUpdate.releaseNotes);

  const handleUpdateNow = () => {
    onOpenChange(false);
    void window.cbsHubAPI?.startUpdateFlow?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-[#09090b] border border-zinc-800 text-zinc-100 p-6 shadow-2xl">
        <DialogHeader className="space-y-3">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-zinc-900/90 border border-zinc-800 flex items-center justify-center shrink-0">
              <AnimatedLogo size={36} />
            </div>
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#12C9BD] mb-0.5">
                <Sparkles className="size-3" />
                <span>Atualização disponível</span>
              </div>
              <DialogTitle className="text-base font-semibold text-zinc-100">
                Nova atualização disponível
              </DialogTitle>
            </div>
          </div>

          <DialogDescription className="text-xs text-zinc-400">
            Uma nova versão do cbsHUB está pronta para ser baixada e instalada.
          </DialogDescription>
        </DialogHeader>

        {/* Comparação visual de versões */}
        <div className="flex items-center justify-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950/80 px-4 py-3">
          <span className="px-2.5 py-1 rounded-md bg-zinc-900 border border-zinc-800 font-mono text-xs text-zinc-400">
            v{APP_VERSION}
          </span>
          <ArrowRight className="size-4 text-[#12C9BD] shrink-0" />
          <span className="px-2.5 py-1 rounded-md bg-[#12C9BD]/15 border border-[#12C9BD]/40 font-mono text-xs font-semibold text-[#12C9BD]">
            v{newVersion}
          </span>
        </div>

        {/* Notas da release higienizadas */}
        {notes && (
          <div className="space-y-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400 block">
              Novidades da versão
            </span>
            <div className="max-h-40 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
              <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-line break-words">
                {notes}
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
          >
            Mais tarde
          </Button>
          <Button
            type="button"
            onClick={handleUpdateNow}
            className="gap-1.5 bg-[#12C9BD] text-zinc-950 hover:bg-[#12C9BD]/90 font-semibold"
          >
            <Download className="size-3.5" />
            <span>Atualizar agora</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
