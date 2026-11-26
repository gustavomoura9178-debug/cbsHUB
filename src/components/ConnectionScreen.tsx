import React, { useState } from "react";
import { AnimatedLogo } from "./AnimatedLogo";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { supabase, type DbOnlineStatus } from "../lib/supabase";
import { useHubStore } from "../store/useHubStore";
import {
  ACTIVE_AUTH_USER_KEY,
  purgeLegacyAccountStorage,
} from "../profiles/repository";
import { LogIn, UserPlus, Loader2 } from "lucide-react";

const AVATAR_PRESETS = [
  "#6eddbd",
  "#5865f2",
  "#eb459e",
  "#f0b232",
  "#23a55a",
  "#f23f43",
  "#00a8fc",
];

export function BootSplash({
  message = "Preparando seu espaço…",
}: {
  message?: string;
}) {
  return (
    <div
      className="brand-loading-screen"
      role="status"
      aria-label="Inicializando cbsHUB"
    >
      <AnimatedLogo size={96} />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

export async function hydrateAuthenticatedUser(user: {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
}) {
  const store = useHubStore.getState();

  try {
    const prevUserId = localStorage.getItem(ACTIVE_AUTH_USER_KEY);
    if (prevUserId !== user.id) {
      purgeLegacyAccountStorage(user.id);
      store.setFriends([]);
      store.setPendingRequests([]);
      store.setMessages([]);
      store.setActiveContext(null);
    } else {
      localStorage.setItem(ACTIVE_AUTH_USER_KEY, user.id);
    }
  } catch {
    /* ignore */
  }

  store.setAuthUser(user.id, user.email || null);

  let { data: profile, error } = await supabase
    .from("profiles")
    .select(
      "id, nickname, avatar_color, online_status, custom_status, custom_avatar_url, banner_url",
    )
    .eq("id", user.id)
    .maybeSingle();

  if (!profile && !error) {
    const metaNick =
      typeof user.user_metadata?.nickname === "string" &&
      user.user_metadata.nickname.trim()
        ? user.user_metadata.nickname.trim()
        : user.email?.split("@")[0] || "Usuário";
    const metaColor =
      typeof user.user_metadata?.avatar_color === "string"
        ? user.user_metadata.avatar_color
        : "#6eddbd";

    const { data: created } = await supabase
      .from("profiles")
      .upsert(
        {
          id: user.id,
          nickname: metaNick,
          avatar_color: metaColor,
          online_status: "online",
        },
        { onConflict: "id" },
      )
      .select(
        "id, nickname, avatar_color, online_status, custom_status, custom_avatar_url, banner_url",
      )
      .maybeSingle();

    profile = created;
  }

  if (profile) {
    const normalizedStatus: DbOnlineStatus =
      profile.online_status === "idle" || profile.online_status === "invisible"
        ? profile.online_status
        : "online";
    store.setNickname(profile.nickname || "Usuário");
    store.setAvatarColor(profile.avatar_color || "#6eddbd");
    store.setOnlineStatus(normalizedStatus);
    store.setCustomStatus(profile.custom_status);
    store.setProfileMediaUrls(
      profile.custom_avatar_url ?? null,
      profile.banner_url ?? null,
    );
  }
}

export function ConnectionScreen() {
  const authUserId = useHubStore((s) => s.authUserId);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [avatarColor, setAvatarColor] = useState(AVATAR_PRESETS[0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  if (authUserId) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setNotice("");

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setError("Preencha seu e-mail e senha.");
      return;
    }

    if (mode === "register") {
      const cleanNick = nickname.trim();
      if (cleanNick.length < 2 || cleanNick.length > 32) {
        setError("Escolha um nickname entre 2 e 32 caracteres.");
        return;
      }
      if (password.length < 6) {
        setError("A senha precisa ter pelo menos 6 caracteres.");
        return;
      }

      setLoading(true);
      try {
        const { data, error: signUpErr } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              nickname: cleanNick,
              avatar_color: avatarColor,
            },
          },
        });
        if (signUpErr) throw signUpErr;

        if (data.session && data.user) {
          await hydrateAuthenticatedUser(data.user);
        } else {
          setNotice(
            "Conta criada! Se a confirmação por e-mail estiver ativa, verifique sua caixa de entrada ou faça login.",
          );
          setMode("login");
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Erro ao criar sua conta.",
        );
      } finally {
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    try {
      const { data, error: signInErr } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });
      if (signInErr) throw signInErr;
      if (data.user) {
        await hydrateAuthenticatedUser(data.user);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message === "Invalid login credentials"
            ? "E-mail ou senha incorretos."
            : err.message
          : "Não foi possível entrar.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <section
      className="brand-loading-screen px-4"
      aria-label="Autenticação cbsHUB"
    >
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-2xl space-y-5">
        <div className="flex flex-col items-center gap-2 text-center">
          <AnimatedLogo size={88} />
          <h1 className="text-base font-semibold tracking-tight text-foreground">
            {mode === "login" ? "Entrar no cbsHUB" : "Criar conta na nuvem"}
          </h1>
          <p className="text-xs text-muted-foreground">
            {mode === "login"
              ? "Conecte-se com seus amigos para DMs, arquivos e chamadas diretas."
              : "Seu perfil, amigos e preferências sincronizados automaticamente."}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-1 rounded-lg bg-background/70 p-1 border border-border/60">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setError("");
            }}
            className={`rounded-md py-1.5 text-xs font-medium transition-colors ${
              mode === "login"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Entrar
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("register");
              setError("");
            }}
            className={`rounded-md py-1.5 text-xs font-medium transition-colors ${
              mode === "register"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Criar Conta
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === "register" && (
            <div className="space-y-1.5">
              <label className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
                Nickname
              </label>
              <Input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Ex: Gustavo"
                maxLength={32}
                required
                className="bg-background/70"
              />
              <div className="flex items-center gap-1.5 pt-1">
                <span className="text-2xs text-muted-foreground mr-1">
                  Cor do avatar:
                </span>
                {AVATAR_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`Selecionar cor ${c}`}
                    onClick={() => setAvatarColor(c)}
                    className={`size-4 rounded-full transition-transform ${
                      avatarColor === c
                        ? "ring-2 ring-foreground scale-110"
                        : "opacity-75 hover:opacity-100"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
              E-mail
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@exemplo.com"
              autoComplete="email"
              required
              className="bg-background/70"
            />
          </div>

          <div className="space-y-1">
            <label className="text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
              Senha
            </label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              required
              className="bg-background/70"
            />
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
            >
              {error}
            </p>
          )}

          {notice && (
            <p
              role="status"
              className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-xs text-primary"
            >
              {notice}
            </p>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="w-full gap-2 font-semibold"
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : mode === "login" ? (
              <LogIn className="size-4" />
            ) : (
              <UserPlus className="size-4" />
            )}
            <span>
              {loading
                ? "Conectando..."
                : mode === "login"
                  ? "Entrar"
                  : "Criar Conta"}
            </span>
          </Button>
        </form>
      </div>
    </section>
  );
}
