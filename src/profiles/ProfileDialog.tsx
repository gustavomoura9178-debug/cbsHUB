import { useSettingsDrafts } from "../lib/settingsDrafts";
import { AvatarCrop } from "./AvatarCrop";
import {
  Children,
  isValidElement,
  useEffect,
  useState,
  type ReactNode,
  type CSSProperties,
} from "react";
import {
  CalendarDays,
  Crop,
  ExternalLink,
  ImagePlus,
  Pencil,
  Shield,
  Trash2,
  UserRound,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import { Switch } from "../components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "../components/ui/dropdown-menu";
import { contrast } from "../studio/theme";
import { useProfiles } from "./ProfileProvider";
import { useHubStore } from "../store/useHubStore";
import { webrtcEngine } from "../lib/webrtcEngine";
import {
  publicProfile,
  PRESENCES,
  type UserProfile,
  type PublicProfile,
  type Presence,
} from "./model";
import { profileImage } from "./repository";

function ProfileSelect({
  children,
  value,
  onChange,
  ...props
}: {
  children: ReactNode;
  value: string;
  onChange: (event: { target: { value: string } }) => void;
  "aria-label": string;
}) {
  const options = Children.toArray(children).filter(
    isValidElement<{ value: string; children: string }>,
  );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-between"
          aria-label={props["aria-label"]}
        >
          {options.find((o) => o.props.value === value)?.props.children}{" "}
          <span aria-hidden="true">⌄</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(v) => onChange({ target: { value: v } })}
        >
          {options.map((o) => (
            <DropdownMenuRadioItem key={o.props.value} value={o.props.value}>
              {o.props.children}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
export function ProfileCard({
  profile: p,
  full = false,
}: {
  profile: PublicProfile;
  full?: boolean;
}) {
  const safeLinks = p.links.filter((link) => {
    try {
      const url = new URL(link);
      return url.protocol === "https:" && !url.username && !url.password;
    } catch {
      return false;
    }
  });
  const style: CSSProperties = {
    "--profile-color": p.appearance.color,
    background:
      p.appearance.theme === "light"
        ? "#f8fafc"
        : p.appearance.theme === "dark"
          ? "#171b21"
          : p.appearance.background,
    color:
      p.appearance.theme === "light"
        ? "#182331"
        : p.appearance.theme === "dark"
          ? "#edf1f5"
          : contrast("#ffffff", p.appearance.background) >=
              contrast("#111111", p.appearance.background)
            ? "#ffffff"
            : "#111111",
    borderColor: p.appearance.color,
  } as CSSProperties;
  return (
    <article
      className={`profile-card profile-card-${p.appearance.card}`}
      style={style}
    >
      <div
        className="profile-banner"
        style={{
          background: p.appearance.useGradient
            ? `linear-gradient(135deg,${p.appearance.color},${p.appearance.gradient})`
            : p.appearance.color,
        }}
      >
        {p.banner && <img src={p.banner} alt="Banner do perfil" />}
      </div>
      <div className="profile-card-content">
        <div
          className={`profile-picture profile-border-${p.appearance.border}`}
          style={{ borderColor: p.appearance.color }}
        >
          {p.avatar ? (
            <img src={p.avatar} alt={`Avatar de ${p.displayName}`} />
          ) : (
            <UserRound aria-hidden="true" />
          )}
        </div>
        <h2>{p.displayName}</h2>
        <p className="profile-handle">@{p.username}</p>
        <p className="profile-presence" data-presence={p.presence}>
          <span />
          {PRESENCES[p.presence]}
        </p>
        {(p.status || p.emoji) && (
          <p className="profile-status">
            {p.emoji} {p.status}
          </p>
        )}
        {p.bio && (
          <section>
            <h3>Sobre mim</h3>
            <p className={full ? "" : "profile-bio-short"}>{p.bio}</p>
          </section>
        )}
        {safeLinks.length > 0 && (
          <section>
            <h3>Links</h3>
            {safeLinks.map((link) => (
              <a
                key={link}
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="profile-link"
              >
                <ExternalLink className="size-3.5" />
                {new URL(link).hostname}
              </a>
            ))}
          </section>
        )}
        {p.createdAt !== null && (
          <p className="profile-date">
            <CalendarDays className="size-3.5" />
            Perfil local criado em{" "}
            {new Date(p.createdAt).toLocaleDateString("pt-BR")}
          </p>
        )}
      </div>
    </article>
  );
}
const privacyLabels = {
  showBio: "Compartilhar biografia",
  showLinks: "Compartilhar links",
  showCreatedAt: "Compartilhar data de criação do perfil",
  shareImages: "Compartilhar avatar e banner",
  allowCalls: "Permitir chamadas de participantes",
  allowReactions: "Permitir reações às minhas mensagens",
} as const;
export function ProfileDialog({ embedded = false }: { embedded?: boolean }) {
  const profiles = useProfiles();
  const participants = useHubStore((s) => s.participants);
  const friends = useHubStore((s) => s.friends);
  const pendingRequests = useHubStore((s) => s.pendingRequests);
  const authUserId = useHubStore((s) => s.authUserId);
  const selected = Object.values(participants).find(
    (p) => p.clientId === profiles.selected,
  );
  const targetUserId = selected?.clientId || profiles.selected || "";
  const self =
    embedded ||
    profiles.selected === "self" ||
    profiles.selected === profiles.own.ownerId ||
    (Boolean(authUserId) && profiles.selected === authUserId);
  const acceptedFriend = !self
    ? friends.find((f) => f.id === targetUserId)
    : undefined;
  const pendingFriendReq = !self
    ? pendingRequests.find((r) => r.id === targetUserId)
    : undefined;
  const [friendBusy, setFriendBusy] = useState(false);
  const [friendFeedback, setFriendFeedback] = useState<string | null>(null);
  const [draft, setDraft] = useState<UserProfile>(
      structuredClone(profiles.own),
    ),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (embedded || profiles.editing) {
      setDraft(structuredClone(profiles.own));
      setError("");
    }
  }, [embedded || profiles.editing, profiles.own]);
  const patch = (p: Partial<UserProfile>) =>
    setDraft((current) => ({ ...current, ...p }));
  const blocked = !!selected && profiles.blocked.includes(selected.clientId);
  const displayed = self
    ? publicProfile({
        ...profiles.own,
        privacy: {
          ...profiles.own.privacy,
          visibility: "room",
          showBio: true,
          showLinks: true,
          showCreatedAt: true,
          shareImages: true,
        },
      })
    : blocked
      ? null
      : selected?.profile;
  const preview = publicProfile({
    ...draft,
    privacy: {
      ...draft.privacy,
      visibility: "room",
      showBio: true,
      showLinks: true,
      showCreatedAt: true,
      shareImages: true,
    },
  })!;
  const [cropTask, setCropTask] = useState<{
    file?: File | null;
    sourceDataUrl?: string | null;
    kind: "avatar" | "banner";
  } | null>(null);
  const [bannerSourceFile, setBannerSourceFile] = useState<File | null>(null);
  useEffect(() => {
    if (!embedded) return;
    useSettingsDrafts.setState({
      profile:
        JSON.stringify(draft) !== JSON.stringify(profiles.own) || !!cropTask,
    });
    return () => useSettingsDrafts.setState({ profile: false });
  }, [embedded, draft, profiles.own, cropTask]);

  async function upload(file: File | undefined, kind: "avatar" | "banner") {
    if (!file) return;
    if (kind === "avatar") {
      setError("");
      setCropTask({ file, kind: "avatar" });
      return;
    }
    setBannerSourceFile(file);
    setBusy(true);
    setError("");
    try {
      const image = await profileImage(file, "banner");
      setDraft((current) => ({ ...current, banner: image }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const content = (
    <>
      {embedded ? (
        <>
          <h3 className="font-semibold">Editar perfil</h3>
          <p className="text-xs text-muted-foreground">
            As alterações só são aplicadas ao salvar.
          </p>
        </>
      ) : (
        <>
          {" "}
          <DialogTitle>
            {embedded || profiles.editing
              ? "Editar perfil"
              : profiles.full
                ? "Perfil completo"
                : "Perfil"}
          </DialogTitle>
          <DialogDescription>
            {embedded || profiles.editing
              ? "Personalize sua identidade. As alterações só são aplicadas ao salvar."
              : "Identidade compartilhada com participantes desta sala."}
          </DialogDescription>
        </>
      )}{" "}
      {embedded || profiles.editing ? (
        <>
          <div className="profile-editor-grid">
            <div>
              <Tabs defaultValue="identity">
                <TabsList
                  aria-label="Seções do perfil"
                  className="w-full grid grid-cols-3"
                >
                  <TabsTrigger value="identity">Identidade</TabsTrigger>
                  <TabsTrigger value="style">Aparência</TabsTrigger>
                  <TabsTrigger value="privacy">Privacidade</TabsTrigger>
                </TabsList>
                <TabsContent value="identity" className="profile-fields">
                  <label>
                    Nome de exibição
                    <Input
                      aria-label="Nome de exibição"
                      value={draft.displayName}
                      maxLength={40}
                      onChange={(e) => patch({ displayName: e.target.value })}
                    />
                  </label>
                  <label>
                    Nome de usuário
                    <Input
                      aria-label="Nome de usuário"
                      value={draft.username}
                      maxLength={24}
                      onChange={(e) =>
                        patch({ username: e.target.value.toLowerCase() })
                      }
                    />
                  </label>
                  <p className="profile-help">
                    Disponibilidade verificada entre participantes conhecidos
                    nesta sala. Reserva global depende de um servidor de contas.
                  </p>
                  <label>
                    Biografia
                    <textarea
                      aria-label="Biografia"
                      value={draft.bio}
                      maxLength={500}
                      onChange={(e) => patch({ bio: e.target.value })}
                    />
                  </label>
                  <label>
                    Status personalizado
                    <Input
                      aria-label="Status personalizado"
                      value={draft.status}
                      maxLength={100}
                      onChange={(e) => patch({ status: e.target.value })}
                    />
                  </label>
                  <label>
                    Emoji de status
                    <Input
                      aria-label="Emoji de status"
                      value={draft.emoji}
                      maxLength={16}
                      onChange={(e) => patch({ emoji: e.target.value })}
                    />
                  </label>
                  <label>
                    Presença
                    <ProfileSelect
                      aria-label="Presença"
                      value={draft.presence}
                      onChange={(e) =>
                        patch({ presence: e.target.value as Presence })
                      }
                    >
                      {Object.entries(PRESENCES).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </ProfileSelect>
                  </label>
                  <p className="profile-help">
                    Invisível exibe Offline no perfil. Participar de uma sala
                    ainda revela sua presença na conexão P2P.
                  </p>
                  <label>
                    Links HTTPS (até 3, um por linha)
                    <textarea
                      aria-label="Links do perfil"
                      value={draft.links.join("\n")}
                      onChange={(e) =>
                        patch({
                          links: e.target.value.split("\n").filter(Boolean),
                        })
                      }
                    />
                  </label>
                  <div className="profile-upload space-y-3">
                    {/* Editor de Avatar */}
                    <div className="rounded-xl border border-border bg-background/45 p-3 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-foreground">
                          Foto de Perfil (Avatar)
                        </span>
                        {draft.avatar && (
                          <span className="text-micro font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                            {Math.max(
                              1,
                              Math.round(
                                ((draft.avatar.split(",")[1]?.length || 0) * 0.75) /
                                  1024,
                              ),
                            )}{" "}
                            KB · WebP
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <div
                          className="size-14 rounded-full overflow-hidden border border-border bg-secondary flex items-center justify-center shrink-0 text-sm font-bold text-white"
                          style={{ backgroundColor: draft.appearance.color }}
                        >
                          {draft.avatar ? (
                            <img
                              src={draft.avatar}
                              alt="Avatar atual"
                              className="size-full object-cover"
                            />
                          ) : (
                            draft.displayName.slice(0, 2).toUpperCase() || "?"
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 flex-1">
                          <input
                            id="profile-avatar-upload"
                            type="file"
                            className="hidden"
                            aria-label="Upload de avatar"
                            accept="image/png,image/jpeg,image/webp"
                            disabled={busy}
                            onChange={(e) => {
                              void upload(e.target.files?.[0], "avatar");
                              e.target.value = "";
                            }}
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={busy}
                            onClick={() =>
                              document
                                .getElementById("profile-avatar-upload")
                                ?.click()
                            }
                            className="h-7 px-2.5 text-xs gap-1.5"
                          >
                            <ImagePlus className="size-3.5" />
                            <span>
                              {draft.avatar ? "Alterar foto" : "Escolher foto"}
                            </span>
                          </Button>
                          {draft.avatar && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              onClick={() =>
                                setCropTask({
                                  sourceDataUrl: draft.avatar,
                                  kind: "avatar",
                                })
                              }
                              className="h-7 px-2 text-xs gap-1"
                            >
                              <Crop className="size-3.5" />
                              <span>Recortar</span>
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={!draft.avatar}
                            onClick={() => patch({ avatar: "" })}
                            className="h-7 px-2 text-xs gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="size-3.5" />
                            <span>Remover avatar</span>
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Editor de Banner */}
                    <div className="rounded-xl border border-border bg-background/45 p-3 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-foreground">
                          Banner de Capa (3:1)
                        </span>
                        {draft.banner && (
                          <span className="text-micro font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                            {Math.max(
                              1,
                              Math.round(
                                ((draft.banner.split(",")[1]?.length || 0) * 0.75) /
                                  1024,
                              ),
                            )}{" "}
                            KB · WebP
                          </span>
                        )}
                      </div>
                      <div
                        className="h-14 w-full rounded-lg overflow-hidden border border-border bg-secondary flex items-center justify-center text-micro text-muted-foreground"
                        style={{
                          background: draft.appearance.useGradient
                            ? `linear-gradient(135deg,${draft.appearance.color},${draft.appearance.gradient})`
                            : draft.appearance.color,
                        }}
                      >
                        {draft.banner ? (
                          <img
                            src={draft.banner}
                            alt="Banner atual"
                            className="size-full object-cover"
                          />
                        ) : (
                          <span className="bg-black/40 text-white/90 px-2 py-0.5 rounded">
                            Sem imagem de capa
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <input
                          id="profile-banner-upload"
                          type="file"
                          className="hidden"
                          aria-label="Upload de banner"
                          accept="image/png,image/jpeg,image/webp"
                          disabled={busy}
                          onChange={(e) => {
                            void upload(e.target.files?.[0], "banner");
                            e.target.value = "";
                          }}
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={busy}
                          onClick={() =>
                            document
                              .getElementById("profile-banner-upload")
                              ?.click()
                          }
                          className="h-7 px-2.5 text-xs gap-1.5"
                        >
                          <ImagePlus className="size-3.5" />
                          <span>
                            {draft.banner
                              ? "Alterar banner"
                              : "Escolher banner"}
                          </span>
                        </Button>
                        {(bannerSourceFile || draft.banner) && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() =>
                              setCropTask(
                                bannerSourceFile
                                  ? { file: bannerSourceFile, kind: "banner" }
                                  : {
                                      sourceDataUrl: draft.banner,
                                      kind: "banner",
                                    },
                              )
                            }
                            className="h-7 px-2.5 text-xs gap-1"
                          >
                            <Crop className="size-3.5" />
                            <span>Recortar</span>
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={!draft.banner}
                          onClick={() => {
                            setBannerSourceFile(null);
                            patch({ banner: "" });
                          }}
                          className="h-7 px-2 text-xs gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="size-3.5" />
                          <span>Remover banner</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                  <p className="profile-help">
                    PNG, JPEG ou WebP (até 25 MB na entrada). Fotos são
                    recortadas e comprimidas automaticamente para WebP leve sem
                    sobrecarregar o banco.
                  </p>
                </TabsContent>
                <TabsContent value="style" className="profile-fields">
                  {(["color", "background", "gradient"] as const).map(
                    (key, i) => (
                      <label key={key}>
                        {
                          [
                            "Cor principal",
                            "Fundo do cartão",
                            "Segunda cor do gradiente",
                          ][i]
                        }
                        <div className="flex gap-2">
                          <input
                            aria-label={`Seletor ${key}`}
                            type="color"
                            value={draft.appearance[key]}
                            onChange={(e) =>
                              patch({
                                appearance: {
                                  ...draft.appearance,
                                  [key]: e.target.value,
                                },
                              })
                            }
                          />
                          <Input
                            aria-label={`HEX ${key}`}
                            value={draft.appearance[key]}
                            maxLength={7}
                            onChange={(e) => {
                              if (/^#[a-f0-9]{6}$/i.test(e.target.value))
                                patch({
                                  appearance: {
                                    ...draft.appearance,
                                    [key]: e.target.value,
                                  },
                                });
                            }}
                          />
                        </div>
                      </label>
                    ),
                  )}
                  <label className="profile-switch">
                    Usar gradiente
                    <Switch
                      aria-label="Usar gradiente"
                      checked={draft.appearance.useGradient}
                      onCheckedChange={(useGradient) =>
                        patch({
                          appearance: { ...draft.appearance, useGradient },
                        })
                      }
                    />
                  </label>
                  <label>
                    Borda do avatar
                    <ProfileSelect
                      aria-label="Borda do avatar"
                      value={draft.appearance.border}
                      onChange={(e) =>
                        patch({
                          appearance: {
                            ...draft.appearance,
                            border: e.target
                              .value as UserProfile["appearance"]["border"],
                          },
                        })
                      }
                    >
                      <option value="none">Sem borda</option>
                      <option value="ring">Anel</option>
                      <option value="double">Dupla</option>
                    </ProfileSelect>
                  </label>
                  <label>
                    Estilo do cartão
                    <ProfileSelect
                      aria-label="Estilo do cartão"
                      value={draft.appearance.card}
                      onChange={(e) =>
                        patch({
                          appearance: {
                            ...draft.appearance,
                            card: e.target
                              .value as UserProfile["appearance"]["card"],
                          },
                        })
                      }
                    >
                      <option value="soft">Suave</option>
                      <option value="outlined">Contornado</option>
                      <option value="glass">Translúcido</option>
                    </ProfileSelect>
                  </label>
                  <label>
                    Tema do perfil
                    <ProfileSelect
                      aria-label="Tema do perfil"
                      value={draft.appearance.theme}
                      onChange={(e) =>
                        patch({
                          appearance: {
                            ...draft.appearance,
                            theme: e.target
                              .value as UserProfile["appearance"]["theme"],
                          },
                        })
                      }
                    >
                      <option value="inherit">Tema do aplicativo</option>
                      <option value="dark">Escuro</option>
                      <option value="light">Claro</option>
                    </ProfileSelect>
                  </label>
                </TabsContent>
                <TabsContent value="privacy" className="profile-fields">
                  <label>
                    Visibilidade do perfil
                    <ProfileSelect
                      aria-label="Visibilidade do perfil"
                      value={draft.privacy.visibility}
                      onChange={(e) =>
                        patch({
                          privacy: {
                            ...draft.privacy,
                            visibility: e.target.value as "room" | "private",
                          },
                        })
                      }
                    >
                      <option value="room">Participantes da sala</option>
                      <option value="private">Somente eu</option>
                    </ProfileSelect>
                  </label>
                  {Object.entries(privacyLabels).map(([key, label]) => (
                    <label className="profile-switch" key={key}>
                      {label}
                      <Switch
                        aria-label={label}
                        checked={
                          draft.privacy[key as keyof typeof privacyLabels]
                        }
                        onCheckedChange={(v) =>
                          patch({ privacy: { ...draft.privacy, [key]: v } })
                        }
                      />
                    </label>
                  ))}
                  <p className="profile-help">
                    Nome de exibição, mensagens e mídia de uma sala não são
                    privados. Dados já compartilhados não podem ser apagados de
                    outros dispositivos. Permissões e bloqueios são locais; sem
                    conta autenticada, identidades podem ser recriadas.
                  </p>
                  <h3 className="text-sm font-semibold">
                    Bloqueados neste dispositivo
                  </h3>
                  {profiles.blocked.length === 0 ? (
                    <p className="profile-help">
                      Nenhuma identidade bloqueada.
                    </p>
                  ) : (
                    profiles.blocked.map((id) => (
                      <div className="flex gap-2 items-center" key={id}>
                        <span className="truncate text-xs">
                          {Object.values(participants).find(
                            (p) => p.clientId === id,
                          )?.nickname || `Identidade ${id.slice(0, 8)}`}
                        </span>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => profiles.block(id, false)}
                        >
                          Desbloquear
                        </Button>
                      </div>
                    ))
                  )}
                </TabsContent>
              </Tabs>
            </div>
            <aside className="lg:sticky lg:top-0 self-start">
              <h3 className="text-sm font-medium mb-3">Pré-visualização</h3>
              <ProfileCard profile={preview} full />
              <p className="profile-help">
                A prévia mostra seus campos completos. A aba Privacidade
                controla o que é enviado.
              </p>
            </aside>
          </div>
          <div role="alert" className="profile-error">
            {error || profiles.error}
          </div>
          <footer className="profile-actions">
            <Button
              variant="ghost"
              onClick={() =>
                embedded
                  ? setDraft(structuredClone(profiles.own))
                  : profiles.close()
              }
            >
              Cancelar
            </Button>
            <Button disabled={busy} onClick={() => profiles.save(draft)}>
              Salvar perfil
            </Button>
          </footer>
        </>
      ) : (
        <>
          {displayed ? (
            <ProfileCard profile={displayed} full={profiles.full} />
          ) : (
            <div className="profile-private">
              <Shield className="size-8" />
              <h2>
                {blocked
                  ? "Perfil bloqueado"
                  : selected?.nickname || "Perfil indisponível"}
              </h2>
              <p>
                {blocked
                  ? "Você ocultou esta identidade neste dispositivo."
                  : "Este participante não compartilhou um perfil ou está desconectado."}
              </p>
            </div>
          )}
          <div role="alert" className="profile-error">
            {profiles.error}
          </div>
          {!self && (friendFeedback || selected) && (
            <div className="space-y-1 text-center pt-1">
              {friendFeedback && (
                <p role="status" className="text-xs text-primary">
                  {friendFeedback}
                </p>
              )}
            </div>
          )}
          <footer className="profile-actions">
            {self ? (
              <Button onClick={profiles.edit}>
                <Pencil className="size-4 mr-2" />
                Editar perfil
              </Button>
            ) : (
              selected && (
                <>
                  {acceptedFriend ? (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        profiles.close();
                        void webrtcEngine.openDirectMessage(acceptedFriend);
                      }}
                    >
                      Enviar Mensagem (DM)
                    </Button>
                  ) : pendingFriendReq?.direction === "incoming" ? (
                    <>
                      <Button
                        disabled={friendBusy}
                        onClick={async () => {
                          setFriendBusy(true);
                          try {
                            await webrtcEngine.respondFriendRequest(
                              pendingFriendReq.friendshipId,
                              true,
                            );
                          } finally {
                            setFriendBusy(false);
                          }
                        }}
                      >
                        Aceitar amizade
                      </Button>
                      <Button
                        variant="outline"
                        disabled={friendBusy}
                        onClick={async () => {
                          setFriendBusy(true);
                          try {
                            await webrtcEngine.respondFriendRequest(
                              pendingFriendReq.friendshipId,
                              false,
                            );
                          } finally {
                            setFriendBusy(false);
                          }
                        }}
                      >
                        Recusar
                      </Button>
                    </>
                  ) : pendingFriendReq?.direction === "outgoing" ? (
                    <Button variant="secondary" disabled>
                      Convite enviado
                    </Button>
                  ) : (
                    <Button
                      disabled={friendBusy}
                      onClick={async () => {
                        setFriendBusy(true);
                        setFriendFeedback(null);
                        try {
                          await webrtcEngine.sendFriendRequestByUserId(
                            selected.clientId,
                            selected.nickname,
                          );
                          setFriendFeedback("Convite enviado!");
                        } catch (err) {
                          setFriendFeedback(
                            err instanceof Error
                              ? err.message
                              : "Erro ao enviar solicitação.",
                          );
                        } finally {
                          setFriendBusy(false);
                        }
                      }}
                    >
                      Adicionar Amigo
                    </Button>
                  )}
                  <Button
                    variant={blocked ? "secondary" : "destructive"}
                    onClick={() => profiles.block(selected.clientId, !blocked)}
                  >
                    {blocked ? "Desbloquear" : "Bloquear usuário"}
                  </Button>
                </>
              )
            )}
            {!profiles.full && displayed && (
              <Button variant="outline" onClick={profiles.expand}>
                Ver perfil completo
              </Button>
            )}
          </footer>
        </>
      )}
      <AvatarCrop
        file={cropTask?.file ?? null}
        sourceDataUrl={cropTask?.sourceDataUrl ?? null}
        kind={cropTask?.kind ?? "avatar"}
        onClose={() => setCropTask(null)}
        onSave={(image) => {
          if (!cropTask) return;
          const field = cropTask.kind;
          setDraft((current) => ({ ...current, [field]: image }));
        }}
      />
    </>
  );
  return embedded ? (
    <section className="profile-embedded" aria-label="Editor de perfil">
      {content}
    </section>
  ) : (
    <Dialog
      open={profiles.selected !== null}
      onOpenChange={(open) => {
        if (!open) profiles.close();
      }}
    >
      <DialogContent
        className={`profile-window ${profiles.full ? "profile-full" : ""}`}
      >
        {content}
      </DialogContent>
    </Dialog>
  );
}
