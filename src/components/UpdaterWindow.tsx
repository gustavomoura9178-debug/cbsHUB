import React, { useEffect, useState } from "react";
import { AlertCircle, ArrowLeft, RotateCw } from "lucide-react";
import { AnimatedLogo } from "./AnimatedLogo";
import { formatBytes, formatSpeed } from "../lib/appUpdaterUi";
import type { AppUpdateState } from "../types/cbshub";

const dragStyle = { WebkitAppRegion: "drag" } as React.CSSProperties;
const noDragStyle = { WebkitAppRegion: "no-drag" } as React.CSSProperties;

export const UpdaterWindow: React.FC = () => {
  const [updateState, setUpdateState] = useState<AppUpdateState>({
    status: "downloading",
    percent: 0,
  });

  useEffect(() => {
    const isDemo =
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("demo") === "1";

    if (isDemo) {
      let step = 0;
      const totalBytes = 82.5 * 1024 * 1024;
      setUpdateState({
        status: "checking",
        version: "2.3.0",
        percent: 0,
      });
      const timer = window.setInterval(() => {
        step += 1;
        if (step <= 1) {
          setUpdateState({
            status: "downloading",
            version: "2.3.0",
            percent: 0,
            transferred: 0,
            total: totalBytes,
            bytesPerSecond: 0,
          });
          return;
        }
        if (step < 12) {
          const pct = Math.min(98, Math.round(((step - 1) / 10) * 100));
          setUpdateState({
            status: "downloading",
            version: "2.3.0",
            percent: pct,
            transferred: (totalBytes * pct) / 100,
            total: totalBytes,
            bytesPerSecond: 4.8 * 1024 * 1024,
          });
          return;
        }
        setUpdateState({
          status: "installing",
          version: "2.3.0",
          percent: 100,
          transferred: totalBytes,
          total: totalBytes,
        });
        window.clearInterval(timer);
      }, 450);
      return () => window.clearInterval(timer);
    }

    let mounted = true;
    void window.cbsHubAPI
      ?.getUpdateState?.()
      .then((initial) => {
        if (mounted && initial) {
          setUpdateState(initial);
        }
      })
      .catch(() => {});

    const unsub = window.cbsHubAPI?.onUpdateStatus?.((next) => {
      if (mounted) {
        setUpdateState(next);
      }
    });

    return () => {
      mounted = false;
      unsub?.();
    };
  }, []);

  const isError = updateState.status === "error";
  const isInstalling =
    updateState.status === "downloaded" || updateState.status === "installing";
  const percent = isInstalling
    ? 100
    : Math.min(100, Math.max(0, Math.round(updateState.percent ?? 0)));

  const statusLabel = isError
    ? "Não foi possível atualizar"
    : isInstalling
      ? "Instalando e reiniciando..."
      : updateState.status === "downloading" &&
          ((updateState.transferred ?? 0) > 0 || percent > 0)
        ? "Baixando atualização..."
        : "Preparando download...";

  const hasTotal =
    typeof updateState.total === "number" &&
    Number.isFinite(updateState.total) &&
    updateState.total > 0;
  const speedText = formatSpeed(updateState.bytesPerSecond);

  return (
    <div
      style={dragStyle}
      className="h-screen w-screen bg-[#09090b] text-zinc-100 border border-zinc-800/90 flex flex-col items-center justify-between px-6 py-7 select-none overflow-hidden"
    >
      {/* Topo discreto + Logo */}
      <div className="flex flex-col items-center justify-center flex-1 w-full gap-5">
        <div className="relative flex items-center justify-center">
          <div
            aria-hidden="true"
            className="absolute inset-0 rounded-full blur-2xl opacity-30"
            style={{
              background:
                "radial-gradient(circle, rgba(18,201,189,0.55) 0%, rgba(41,37,107,0.35) 60%, transparent 100%)",
            }}
          />
          <AnimatedLogo size={88} className="relative z-10" />
        </div>

        <div className="text-center space-y-1.5">
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-sm font-semibold tracking-tight text-zinc-100">
              Atualizando cbsHUB
            </h1>
            {updateState.version && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-medium bg-zinc-900 border border-zinc-800 text-[#12C9BD]">
                v{updateState.version}
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-400">{statusLabel}</p>
        </div>
      </div>

      {/* Progresso ou Erro */}
      {!isError ? (
        <div className="w-full space-y-2.5">
          <div className="h-1.5 w-full rounded-full bg-zinc-800/90 overflow-hidden">
            <div
              className="h-full rounded-full transition-[width] duration-300 ease-out"
              style={{
                width: `${percent}%`,
                background:
                  "linear-gradient(90deg, #29256B 0%, #12C9BD 100%)",
              }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
            <span className="text-zinc-200 font-semibold">{percent}%</span>
            <span className="truncate mx-2">
              {hasTotal
                ? `${formatBytes(updateState.transferred)} / ${formatBytes(updateState.total)}`
                : ""}
            </span>
            <span className="min-w-[56px] text-right">{speedText}</span>
          </div>
        </div>
      ) : (
        <div style={noDragStyle} className="w-full space-y-3">
          <div className="rounded-lg border border-red-900/60 bg-red-950/30 px-3 py-2.5 flex items-start gap-2">
            <AlertCircle className="size-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed text-red-200 break-words">
              {updateState.message ||
                "Ocorreu um erro durante o download da atualização."}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.cbsHubAPI?.cancelUpdateWindow?.()}
              className="flex-1 h-8 px-2.5 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-xs font-medium text-zinc-200 inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowLeft className="size-3.5" />
              <span>Voltar ao cbsHUB</span>
            </button>
            <button
              type="button"
              onClick={() => void window.cbsHubAPI?.startUpdateFlow?.()}
              className="flex-1 h-8 px-2.5 rounded-lg bg-[#12C9BD] hover:bg-[#12C9BD]/90 text-xs font-semibold text-zinc-950 inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <RotateCw className="size-3.5" />
              <span>Tentar novamente</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UpdaterWindow;
