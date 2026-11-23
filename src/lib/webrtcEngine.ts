import type { RealtimeChannel } from "@supabase/supabase-js";
import Peer, { type MediaConnection, type DataConnection } from "peerjs";
import {
  supabase,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  type DbMessageRow,
  type DbRoomMessageRow,
  type DbSignalingCallRow,
  type DbOnlineStatus,
} from "./supabase";
import { loadCloudSettings } from "./cloudSettings";
import { notifyNative } from "./nativeNotifications";
import { applySafeSinkId } from "../hooks/useMediaOutput";
import type {
  StreamTelemetry,
  VideoQualityConfig,
  AudioProcessingConfig,
  Participant,
  ChatMessage,
  SoundboardClip,
  SignalingPacket,
  FriendItem,
  FriendPresenceState,
  SignalingCallData,
  ActiveContext,
} from "../types/cbshub";
import { useVoicePreferences } from "./voicePreferences";
import {
  callEvent,
  beginCallDiagnostics,
  endCallDiagnostics,
} from "./callDiagnostics";
import { peerState } from "./signalingValidation";
import { soundActivity } from "../chat/activities";
import { chatLedger } from "../chat/ledger";
import {
  validateOperation,
  type ChatOperation,
} from "../chat/model";
import { publicProfile, validatePublicProfile } from "../profiles/model";
import { readOwnProfile, isBlocked } from "../profiles/repository";
import { useHubStore } from "../store/useHubStore";
import { sounds } from "./sounds";
import { VoiceAudioPipeline } from "./audioPipeline";
import { soundboardEngine } from "./soundboardEngine";
import { storageDb } from "./storageDb";
import { enhanceOpusSdp, configureVideoSender } from "./sdpMunger";
import { useMediaState, mediaError } from "./mediaState";

const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024; // 50 MB estrito

export type ResolvedAttachmentResult =
  | { status: "ready"; url: string; fromLocal: boolean }
  | { status: "missing" }
  | { status: "offline" };

function buildPeerIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:global.stun.twilio.com:3478" },
  ];

  const username = import.meta.env.VITE_METERED_USERNAME;
  const credential = import.meta.env.VITE_METERED_CREDENTIAL;
  const turnUrl =
    import.meta.env.VITE_METERED_TURN_URL ||
    "turn:standard.relay.metered.ca:80";
  const turnsUrl =
    import.meta.env.VITE_METERED_TURNS_URL ||
    "turns:standard.relay.metered.ca:443?transport=tcp";

  if (username && credential) {
    servers.push(
      { urls: turnUrl, username, credential },
      { urls: turnsUrl, username, credential },
    );
  }

  return servers;
}

const PEER_CONFIG = {
  config: {
    iceServers: buildPeerIceServers(),
    iceCandidatePoolSize: 10,
  },
  debug: 1,
};

interface PeerMediaSession {
  peerId: string;
  clientId: string;
  nickname: string;
  dataConn: DataConnection;
  voiceCall: MediaConnection | null;
  webcamCall: MediaConnection | null;
  screenCall: MediaConnection | null;
  outgoingScreen?: MediaConnection | null;
  outgoingWebcam?: MediaConnection | null;
  qualityTimer?: number;
  mediaFlowVerified?: boolean;
  recoveryRxBase?: number;
  recoveryTxBase?: number;
  recoveryMediaAt?: number;
  voiceRetryTimer?: number;
  voiceRetryAttempts?: number;
  dataGraceTimer?: number;
  dataConnectTimer?: number;
  dataConnecting?: boolean;

  // Reprodução direta (0–100%); WebAudio separado apenas para detecção de fala.
  voiceAudioCtx: AudioContext | null;
  voiceSourceNode: MediaStreamAudioSourceNode | null;
  voiceGainNode: GainNode | null;
  voiceDestNode: MediaStreamAudioDestinationNode | null;
  voiceAudioEl: HTMLAudioElement | null;
  remoteSpeakingInterval: number | null;
}

interface RoomMeshPresencePayload {
  userId: string;
  peerId: string;
  nickname: string;
  avatarColor: string;
  inVoiceCall: boolean;
  isMuted: boolean;
  isDeafened: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
}

class WebRTCEngine {
  private chatClock = 0;
  private roomGeneration = 0;
  private micGeneration = 0;
  /* Recuperação do microfone: tentativas com espera crescente, limitadas e
     canceladas ao sair da voz/chamada ou quando o usuário troca o microfone. */
  private micRecoveryDelaysMs = [0, 1000, 2500, 5000, 10000, 20000];
  private micRecoveryAttempt = 0;
  private micRecoveryTimer: number | null = null;
  private lastMicRecoveredAt = -Infinity;
  private micMuteWatchdog: number | null = null;
  private micMuteWatchdogMs = 6000;
  private cameraGeneration = 0;
  private screenGeneration = 0;
  private joiningVoice = false;
  private recoveryTimer: number | null = null;
  private recoveryAttempts = 0;
  private recoveryCancelled = false;

  private localPeer: Peer | null = null;
  private currentRoomSlug = "";
  private directRemotePeerId: string | null = null;
  private directRemoteUserId: string | null = null;
  private pendingOutgoingVideo = false;
  private incomingCallTimer: number | null = null;

  // Canais Supabase Realtime
  private presenceChannel: RealtimeChannel | null = null;
  private friendshipsChannel: RealtimeChannel | null = null;
  private callsChannelIn: RealtimeChannel | null = null;
  private callsChannelOut: RealtimeChannel | null = null;
  private dmRealtimeChannel: RealtimeChannel | null = null;
  private roomMeshChannel: RealtimeChannel | null = null;
  private roomMessagesChannel: RealtimeChannel | null = null;
  private activeRoomMeta: { roomId: string; slug: string; name: string } | null = null;
  private roomSenderProfiles: Map<string, { nickname: string; avatarColor: string }> = new Map();
  private attachmentResolveLocks: Map<string, Promise<void>> = new Map();
  private pendingRoomRelayPurges: Map<string, number> = new Map();
  private presenceStateMap: Record<string, { online_status?: DbOnlineStatus; in_call?: boolean }> = {};
  private cloudSessionUserId: string | null = null;
  private seenIncomingRequestIds = new Set<string>();
  private firstFriendLoadDone = false;
  private isNetworkOffline = false;
  private wasInCallContext: {
    context: ActiveContext;
    inVoiceCall: boolean;
    withVideo: boolean;
  } | null = null;

  // Heartbeat P2P para detecção de queda real em menos de 12 segundos.
  private heartbeatInterval: number | null = null;

  // Sessões ativas (chave: peerId)
  private sessions: Map<string, PeerMediaSession> = new Map();

  // Pipeline e mídia local
  private audioPipeline: VoiceAudioPipeline | null = null;
  private rawMicStream: MediaStream | null = null;
  private localScreenStream: MediaStream | null = null;
  private localWebcamStream: MediaStream | null = null;

  // ABR & Telemetria
  private abrIntervalId: number | null = null;
  private receiverStatsIntervalId: number | null = null;
  private currentMaxBitrate = 6_000_000;
  private targetMaxBitrate = 6_000_000;
  private consecutiveBadCycles = 0;
  private consecutiveGoodCycles = 0;
  private prevSenderBytes = 0;
  private prevSenderTimestamp = 0;
  private prevReceiverBytes = 0;
  private prevReceiverTimestamp = 0;

  private recoveryEpoch = 0;
  private recoveryActive = false;
  private waitingForMedia = new Set<string>();
  private signalingPendingAt = 0;

  private generateShortId(clientId: string): string {
    const clean = clientId.replace(/[^a-z0-9]/gi, "").toLowerCase();
    return clean.substring(0, 8) || Math.random().toString(36).substring(2, 10);
  }

  /* ========================================================================= */
  /* FASE 1 & 2: SESSÃO CLOUD, PRESENÇA E AMIGOS (SUPABASE)                    */
  /* ========================================================================= */

  public async initializeCloudSession(userId: string): Promise<void> {
    if (this.cloudSessionUserId === userId) return;
    this.teardownCloudSubscriptions();
    this.cloudSessionUserId = userId;

    await Promise.allSettled([
      this.refreshFriends(),
      loadCloudSettings(userId),
      soundboardEngine.loadAllClips(),
    ]);

    this.subscribePresence(userId);
    this.subscribeFriendships(userId);
    this.subscribeSignalingCalls(userId);

    // Reabre o último amigo ativo se ainda estiver na lista de amigos
    const state = useHubStore.getState();
    if (state.activeFriend) {
      const stillFriend = useHubStore
        .getState()
        .friends.find((f) => f.id === state.activeFriend?.id);
      if (stillFriend) {
        await this.openDirectMessage(stillFriend);
      } else {
        useHubStore.getState().setActiveFriend(null);
        useHubStore.getState().setActiveChannelId(null);
      }
    }
  }

  public teardownRoomChannels(): void {
    this.activeRoomMeta = null;
    if (this.roomMeshChannel) {
      void supabase.removeChannel(this.roomMeshChannel);
      this.roomMeshChannel = null;
    }
    if (this.roomMessagesChannel) {
      void supabase.removeChannel(this.roomMessagesChannel);
      this.roomMessagesChannel = null;
    }
  }

  public teardownCloudSubscriptions(): void {
    this.cloudSessionUserId = null;
    this.seenIncomingRequestIds.clear();
    this.firstFriendLoadDone = false;
    this.teardownRoomChannels();
    if (this.presenceChannel) {
      void supabase.removeChannel(this.presenceChannel);
      this.presenceChannel = null;
    }
    if (this.friendshipsChannel) {
      void supabase.removeChannel(this.friendshipsChannel);
      this.friendshipsChannel = null;
    }
    if (this.callsChannelIn) {
      void supabase.removeChannel(this.callsChannelIn);
      this.callsChannelIn = null;
    }
    if (this.callsChannelOut) {
      void supabase.removeChannel(this.callsChannelOut);
      this.callsChannelOut = null;
    }
    if (this.dmRealtimeChannel) {
      void supabase.removeChannel(this.dmRealtimeChannel);
      this.dmRealtimeChannel = null;
    }
    this.presenceStateMap = {};
  }

  private subscribePresence(userId: string): void {
    if (this.presenceChannel) {
      void supabase.removeChannel(this.presenceChannel);
    }

    const channel = supabase.channel("presence:cbshub", {
      config: { presence: { key: userId } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const raw = channel.presenceState<{
          user_id?: string;
          online_status?: DbOnlineStatus;
          in_call?: boolean;
        }>();
        const nextMap: Record<string, { online_status?: DbOnlineStatus; in_call?: boolean }> = {};
        for (const [key, entries] of Object.entries(raw)) {
          const latest = entries[entries.length - 1];
          if (latest) {
            nextMap[key] = {
              online_status: latest.online_status,
              in_call: latest.in_call,
            };
          }
        }
        this.presenceStateMap = nextMap;
        this.applyPresenceToFriends();
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await this.trackPresence();
        }
      });

    this.presenceChannel = channel;
  }

  public async trackPresence(): Promise<void> {
    if (!this.presenceChannel || !this.cloudSessionUserId) return;
    const state = useHubStore.getState();
    try {
      await this.presenceChannel.track({
        user_id: this.cloudSessionUserId,
        online_status: state.onlineStatus,
        in_call: state.inVoiceCall,
      });
    } catch {
      /* ignore presence errors during reconnect */
    }
  }

  private resolveFriendPresence(
    friendId: string,
    fallbackStatus: DbOnlineStatus,
  ): FriendPresenceState {
    const tracked = this.presenceStateMap[friendId];
    if (!tracked) return "offline";
    if (tracked.online_status === "invisible") return "offline";
    if (tracked.in_call) return "in_call";
    if (tracked.online_status === "idle") return "idle";
    if (fallbackStatus === "invisible") return "offline";
    return "online";
  }

  private applyPresenceToFriends(): void {
    const state = useHubStore.getState();
    const updated = state.friends.map((f) => ({
      ...f,
      presence: this.resolveFriendPresence(f.id, f.onlineStatus),
    }));
    state.setFriends(updated);

    if (state.activeFriend) {
      const refreshedActive = updated.find((f) => f.id === state.activeFriend?.id);
      if (refreshedActive) {
        state.setActiveFriend(refreshedActive);
      }
    }
  }

  private subscribeFriendships(userId: string): void {
    if (this.friendshipsChannel) {
      void supabase.removeChannel(this.friendshipsChannel);
    }

    this.friendshipsChannel = supabase
      .channel(`friendships:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friendships" },
        () => {
          void this.refreshFriends();
        },
      )
      .subscribe();
  }

  public async refreshFriends(): Promise<void> {
    const userId = useHubStore.getState().authUserId;
    if (!userId) return;

    const { data: rows, error } = await supabase
      .from("friendships")
      .select("id, user_id, friend_id, status, created_at, updated_at")
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`);

    if (error || !rows) {
      console.warn("[Cloud] Erro ao carregar amizades:", error?.message);
      return;
    }

    const otherIds = Array.from(
      new Set(
        rows
          .filter((r) => r.status !== "rejected")
          .map((r) => (r.user_id === userId ? r.friend_id : r.user_id)),
      ),
    );

    if (otherIds.length === 0) {
      this.firstFriendLoadDone = true;
      useHubStore.getState().setFriends([]);
      useHubStore.getState().setPendingRequests([]);
      return;
    }

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, nickname, avatar_color, online_status, custom_status")
      .in("id", otherIds);

    const profileMap = new Map(
      (profiles || []).map((p) => [p.id, p]),
    );

    const accepted: FriendItem[] = [];
    const pending: FriendItem[] = [];

    for (const row of rows) {
      if (row.status === "rejected") continue;
      const otherId = row.user_id === userId ? row.friend_id : row.user_id;
      const profile = profileMap.get(otherId);
      if (!profile) continue;

      const isPending =
        row.status === "pending" ||
        row.status === "pending_sent" ||
        row.status === "pending_received";

      const direction: "incoming" | "outgoing" =
        row.status === "pending_received" && row.user_id === userId
          ? "incoming"
          : row.status === "pending_sent" && row.user_id === userId
            ? "outgoing"
            : row.user_id === userId
              ? "outgoing"
              : "incoming";

      const item: FriendItem = {
        friendshipId: row.id,
        id: profile.id,
        nickname: profile.nickname,
        avatarColor: profile.avatar_color || "#6eddbd",
        onlineStatus: (profile.online_status as DbOnlineStatus) || "online",
        customStatus: profile.custom_status,
        presence: this.resolveFriendPresence(
          profile.id,
          (profile.online_status as DbOnlineStatus) || "online",
        ),
        status: row.status === "accepted" ? "accepted" : "pending",
        direction,
      };

      if (row.status === "accepted") {
        if (!accepted.some((f) => f.id === item.id)) {
          accepted.push(item);
        }
      } else if (isPending) {
        if (!accepted.some((f) => f.id === item.id) && !pending.some((f) => f.id === item.id)) {
          pending.push(item);
        }
        if (item.direction === "incoming") {
          const alreadySeen = this.seenIncomingRequestIds.has(item.friendshipId);
          this.seenIncomingRequestIds.add(item.friendshipId);
          if (this.firstFriendLoadDone && !alreadySeen) {
            notifyNative({
              id: `friend-${item.friendshipId}`,
              kind: "friend",
              title: "Novo pedido de amizade",
              body: `${item.nickname} quer adicionar você no cbsHUB.`,
            });
          }
        }
      }
    }

    this.firstFriendLoadDone = true;
    accepted.sort((a, b) => a.nickname.localeCompare(b.nickname));
    useHubStore.getState().setFriends(accepted);
    useHubStore.getState().setPendingRequests(pending);
  }

  public async sendFriendRequestByUserId(
    targetUserId: string,
    targetNickname?: string,
  ): Promise<void> {
    const userId = useHubStore.getState().authUserId;
    if (!userId) throw new Error("Faça login para adicionar amigos.");
    if (!targetUserId) throw new Error("Usuário de destino inválido.");
    if (targetUserId === userId) throw new Error("Você não pode adicionar a si mesmo.");

    const displayLabel = targetNickname?.trim() || "este usuário";

    const { data: existingRows, error: checkError } = await supabase
      .from("friendships")
      .select("id, user_id, friend_id, status")
      .or(
        `and(user_id.eq.${userId},friend_id.eq.${targetUserId}),and(user_id.eq.${targetUserId},friend_id.eq.${userId})`,
      );

    if (checkError) throw new Error(checkError.message);

    const rows = existingRows || [];
    if (rows.some((r) => r.status === "accepted")) {
      throw new Error(`${displayLabel} já está na sua lista de amigos.`);
    }
    if (
      rows.some(
        (r) =>
          r.status === "pending" ||
          r.status === "pending_sent" ||
          r.status === "pending_received",
      )
    ) {
      throw new Error(`Já existe uma solicitação pendente com ${displayLabel}.`);
    }

    const rejectedRow = rows.find((r) => r.status === "rejected");
    if (rejectedRow) {
      const { error: updateError } = await supabase
        .from("friendships")
        .update({
          user_id: userId,
          friend_id: targetUserId,
          status: "pending",
          updated_at: new Date().toISOString(),
        })
        .eq("id", rejectedRow.id);
      if (updateError) throw new Error(updateError.message);
    } else {
      const { error: insertError } = await supabase.from("friendships").insert({
        user_id: userId,
        friend_id: targetUserId,
        status: "pending",
      });
      if (insertError) throw new Error(insertError.message);
    }

    await this.refreshFriends();
  }

  public async sendFriendRequest(nicknameQuery: string): Promise<void> {
    const userId = useHubStore.getState().authUserId;
    if (!userId) throw new Error("Faça login para adicionar amigos.");

    const clean = nicknameQuery.trim();
    if (!clean) throw new Error("Informe o nickname do amigo.");

    const { data: target, error: findError } = await supabase
      .from("profiles")
      .select("id, nickname")
      .ilike("nickname", clean)
      .limit(1)
      .maybeSingle();

    if (findError) throw new Error(findError.message);
    if (!target) throw new Error(`Usuário "${clean}" não encontrado.`);

    await this.sendFriendRequestByUserId(target.id, target.nickname);
  }

  public async respondFriendRequest(
    friendshipId: string,
    accept: boolean,
  ): Promise<void> {
    const { error } = await supabase
      .from("friendships")
      .update({ status: accept ? "accepted" : "rejected" })
      .eq("id", friendshipId);
    if (error) throw new Error(error.message);
    await this.refreshFriends();
  }

  public async updateCloudProfile(partial: {
    nickname?: string;
    online_status?: DbOnlineStatus;
    custom_status?: string | null;
    avatar_color?: string;
  }): Promise<void> {
    const state = useHubStore.getState();
    const userId = state.authUserId;
    if (!userId) return;

    const { error } = await supabase
      .from("profiles")
      .update({
        ...partial,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (error) throw new Error(error.message);

    if (partial.nickname) state.setNickname(partial.nickname);
    if (partial.avatar_color) state.setAvatarColor(partial.avatar_color);
    if (partial.online_status) state.setOnlineStatus(partial.online_status);
    if (partial.custom_status !== undefined) {
      state.setCustomStatus(partial.custom_status);
    }
    await Promise.allSettled([
      this.trackPresence(),
      this.trackRoomMeshPresence(),
    ]);
  }

  /* ========================================================================= */
  /* FASE 2 & 3: CANAIS DM, SALAS FULL-MESH, HISTÓRICO & ANEXOS (50MB MAX)     */
  /* ========================================================================= */

  private resolveMessageSender(
    senderId: string,
    friend: FriendItem | null,
  ): { nickname: string; avatarColor: string } {
    const state = useHubStore.getState();
    if (senderId === state.authUserId) {
      return { nickname: state.nickname, avatarColor: state.avatarColor };
    }
    if (friend && friend.id === senderId) {
      return { nickname: friend.nickname, avatarColor: friend.avatarColor };
    }
    const knownFriend = state.friends.find((f) => f.id === senderId);
    if (knownFriend) {
      return {
        nickname: knownFriend.nickname,
        avatarColor: knownFriend.avatarColor,
      };
    }
    const cachedRoomProfile = this.roomSenderProfiles.get(senderId);
    if (cachedRoomProfile) {
      return cachedRoomProfile;
    }
    const participant = Object.values(state.participants).find(
      (p) => p.clientId === senderId,
    );
    if (participant) {
      return {
        nickname: participant.nickname,
        avatarColor: participant.avatarColor,
      };
    }
    return {
      nickname: friend ? "Amigo" : "Participante",
      avatarColor: "#6eddbd",
    };
  }

  private mapDbMessageToChat(
    row: DbMessageRow | DbRoomMessageRow,
    friend: FriendItem | null,
  ): ChatMessage {
    const targetId = "channel_id" in row ? row.channel_id : row.room_id;
    const senderProfile = this.resolveMessageSender(row.sender_id, friend);

    return {
      id: row.id,
      roomId: targetId,
      channelId: targetId,
      type: "user",
      delivery: "received",
      authorClientId: row.sender_id,
      authorNickname: senderProfile.nickname,
      authorAvatarColor: senderProfile.avatarColor,
      content: row.content || "",
      createdAt: new Date(row.created_at).getTime(),
      reactions: {},
      fileUrl: row.file_url,
      fileName: row.file_name,
      fileType: row.file_type,
      fileSize: row.file_size,
    };
  }

  public async openDirectMessage(friend: FriendItem): Promise<string> {
    const state = useHubStore.getState();
    if (!state.authUserId) throw new Error("Usuário não autenticado.");

    if (state.activeContext?.type === "room") {
      this.leaveRoom();
    }

    state.setActiveFriend(friend);
    state.setRemoteNickname(friend.nickname);

    const { data: channelId, error } = await supabase.rpc(
      "get_or_create_dm_channel",
      { target_user_id: friend.id },
    );

    if (error || !channelId) {
      throw new Error(
        error?.message || "Não foi possível abrir o canal de DM.",
      );
    }

    this.currentRoomSlug = channelId;
    useHubStore
      .getState()
      .setActiveContext({ type: "dm", channelId, friend });
    useHubStore.getState().setMessages([]);
    useHubStore
      .getState()
      .setStatusText(`Conversando com ${friend.nickname}`);

    await this.loadChannelMessages(channelId, friend);
    this.subscribeDmChannel(channelId, friend);

    return channelId;
  }

  public normalizeRoomSlug(input: string): string {
    return input
      .trim()
      .replace(/^convite:\/\/sala\//i, "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48);
  }

  public async createOrJoinRoom(
    nameOrSlug: string,
    autoJoinVoice = false,
  ): Promise<{ roomId: string; slug: string; name: string }> {
    const state = useHubStore.getState();
    const userId = state.authUserId;
    if (!userId) throw new Error("Faça login para entrar em uma sala.");

    const rawClean = nameOrSlug
      .trim()
      .replace(/^convite:\/\/sala\//i, "")
      .slice(0, 48);
    const slug = this.normalizeRoomSlug(nameOrSlug);
    if (!slug) {
      throw new Error("Informe um nome ou código válido para a sala.");
    }

    if (
      this.activeRoomMeta?.slug === slug &&
      useHubStore.getState().activeContext?.type === "room"
    ) {
      if (autoJoinVoice && !useHubStore.getState().inVoiceCall) {
        await this.joinRoomVoiceCall(false);
      }
      return this.activeRoomMeta;
    }

    // Encerra ligação 1:1 ou sala anterior para evitar conflito de microfone/tela
    if (state.activeContext?.type === "room") {
      this.leaveRoom();
    } else if (state.inVoiceCall || state.outgoingCall) {
      this.leaveVoiceCall("manual_leave");
    }

    if (this.dmRealtimeChannel) {
      void supabase.removeChannel(this.dmRealtimeChannel);
      this.dmRealtimeChannel = null;
    }
    this.teardownRoomChannels();

    let roomId = `room:${slug}`;
    let roomName = rawClean || slug;

    try {
      const { data: existingRoom, error: fetchError } = await supabase
        .from("rooms")
        .select("id, slug, name")
        .eq("slug", slug)
        .maybeSingle();

      if (existingRoom) {
        roomId = existingRoom.id;
        roomName = existingRoom.name || roomName;
      } else if (!fetchError) {
        const { data: createdRoom, error: insertError } = await supabase
          .from("rooms")
          .insert({
            slug,
            name: roomName,
            created_by: userId,
          })
          .select("id, slug, name")
          .single();

        if (createdRoom) {
          roomId = createdRoom.id;
          roomName = createdRoom.name || roomName;
        } else if (insertError) {
          const { data: retryRoom } = await supabase
            .from("rooms")
            .select("id, slug, name")
            .eq("slug", slug)
            .maybeSingle();
          if (retryRoom) {
            roomId = retryRoom.id;
            roomName = retryRoom.name || roomName;
          }
        }
      }
    } catch {
      /* Fallback determinístico se a tabela public.rooms não existir ainda */
    }

    this.roomGeneration++;
    this.activeRoomMeta = { roomId, slug, name: roomName };
    this.currentRoomSlug = slug;

    const currentStore = useHubStore.getState();
    currentStore.addRecentRoom(slug);
    currentStore.setActiveContext({
      type: "room",
      roomId,
      slug,
      name: roomName,
    });
    currentStore.setMessages([]);
    currentStore.setStatusText(`Na sala #${slug}`);
    this.roomSenderProfiles.set(userId, {
      nickname: currentStore.nickname,
      avatarColor: currentStore.avatarColor,
    });

    // Inicializa PeerJS local para fechar malha DataConnection/MediaConnection da sala
    try {
      await this.ensureLocalPeer(userId);
    } catch (err) {
      console.warn("[Room] PeerJS indisponível no momento:", err);
    }

    await this.loadRoomMessages(roomId);
    this.subscribeRoomMessages(roomId, slug);
    this.subscribeRoomMesh(slug, userId);

    if (autoJoinVoice) {
      await this.joinRoomVoiceCall(false);
    }

    return { roomId, slug, name: roomName };
  }

  public async joinRoomVoiceCall(withVideo = false): Promise<void> {
    const state = useHubStore.getState();
    const userId = state.authUserId;
    if (!userId || !this.activeRoomMeta || state.activeContext?.type !== "room") {
      throw new Error("Entre em uma sala antes de ativar a voz.");
    }
    if (state.inVoiceCall || this.joiningVoice) return;

    this.joiningVoice = true;
    this.clearMicRecovery();

    try {
      await this.setupLocalMicrophone();
      const peerId = await this.ensureLocalPeer(userId);

      this.recoveryCancelled = false;
      beginCallDiagnostics();
      useHubStore.getState().setInVoiceCall(true);
      useHubStore.getState().setCallStageMode("grid");
      useHubStore.getState().updateParticipant(peerId, {
        inVoiceCall: true,
        isMuted: useHubStore.getState().isMuted,
        isDeafened: useHubStore.getState().isDeafened,
      });

      await Promise.allSettled([
        this.trackPresence(),
        this.trackRoomMeshPresence(),
      ]);
      this.broadcastLocalState();
      this.syncRoomMeshState(this.activeRoomMeta.slug);
      sounds.playJoin();

      if (withVideo && !useHubStore.getState().isWebcamActive) {
        await this.toggleWebcam();
      }
    } catch (err) {
      mediaError("Voz na sala", err);
    } finally {
      this.joiningVoice = false;
    }
  }

  public async sendRoomInviteToFriend(
    friend: FriendItem,
    slugArg?: string,
    roomNameArg?: string,
  ): Promise<void> {
    const state = useHubStore.getState();
    const userId = state.authUserId;
    if (!userId) throw new Error("Usuário não autenticado.");

    const slug =
      slugArg ||
      (state.activeContext?.type === "room" ? state.activeContext.slug : "");
    if (!slug) throw new Error("Nenhuma sala ativa para convidar.");

    const roomName =
      roomNameArg ||
      (state.activeContext?.type === "room" ? state.activeContext.name : slug);

    const { data: channelId, error: rpcErr } = await supabase.rpc(
      "get_or_create_dm_channel",
      { target_user_id: friend.id },
    );
    if (rpcErr || !channelId) {
      throw new Error(
        rpcErr?.message || "Não foi possível abrir o canal de DM.",
      );
    }

    const content = `Convite para a sala **${roomName}**: convite://sala/${slug}`;
    const { error: msgErr } = await supabase.from("messages").insert({
      id: crypto.randomUUID(),
      channel_id: channelId,
      sender_id: userId,
      content,
    });
    if (msgErr) throw new Error(msgErr.message);
  }

  private subscribeRoomMesh(slug: string, userId: string): void {
    if (this.roomMeshChannel) {
      void supabase.removeChannel(this.roomMeshChannel);
      this.roomMeshChannel = null;
    }

    const channel = supabase.channel(`room-mesh:${slug}`, {
      config: { presence: { key: userId } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        this.syncRoomMeshState(slug);
      })
      .on("presence", { event: "join" }, () => {
        this.syncRoomMeshState(slug);
      })
      .on("presence", { event: "leave" }, () => {
        this.syncRoomMeshState(slug);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED" && this.activeRoomMeta?.slug === slug) {
          await this.trackRoomMeshPresence();
          this.syncRoomMeshState(slug);
        }
      });

    this.roomMeshChannel = channel;
  }

  public async trackRoomMeshPresence(): Promise<void> {
    if (!this.roomMeshChannel || !this.activeRoomMeta || !this.cloudSessionUserId) {
      return;
    }
    const state = useHubStore.getState();
    const payload: RoomMeshPresencePayload = {
      userId: this.cloudSessionUserId,
      peerId: this.localPeer?.id || "",
      nickname: state.nickname,
      avatarColor: state.avatarColor,
      inVoiceCall: state.inVoiceCall,
      isMuted: state.isMuted,
      isDeafened: state.isDeafened,
      isVideoEnabled: state.isWebcamActive,
      isScreenSharing: state.isScreenSharing,
    };
    try {
      await this.roomMeshChannel.track(payload);
    } catch {
      /* ignore during reconnect */
    }
  }

  private syncRoomMeshState(slug: string): void {
    if (!this.roomMeshChannel || this.activeRoomMeta?.slug !== slug) return;
    const state = useHubStore.getState();
    const userId = state.authUserId;
    if (!userId || state.activeContext?.type !== "room") return;

    const raw =
      this.roomMeshChannel.presenceState<RoomMeshPresencePayload>();
    const byUserId = new Map<string, RoomMeshPresencePayload>();

    for (const [key, entries] of Object.entries(raw)) {
      const latest = entries[entries.length - 1];
      if (!latest) continue;
      const uid = latest.userId || key;
      if (!uid || uid === userId) continue;
      byUserId.set(uid, { ...latest, userId: uid });
      this.roomSenderProfiles.set(uid, {
        nickname: latest.nickname || "Participante",
        avatarColor: latest.avatarColor || "#6eddbd",
      });
    }

    // Remove sessões antigas de quem saiu da sala ou mudou de peerId
    for (const session of [...this.sessions.values()]) {
      const remoteEntry = session.clientId
        ? byUserId.get(session.clientId)
        : undefined;
      if (
        !remoteEntry ||
        (remoteEntry.peerId && session.peerId !== remoteEntry.peerId)
      ) {
        this.finalizePeerDisconnected(session);
      }
    }

    // Monta mapa de participantes deduplicado estritamente por userId
    const nextParticipants: Record<string, Participant> = {};
    const existingByUser = new Map<string, Participant>();
    for (const p of Object.values(useHubStore.getState().participants)) {
      if (p.clientId) existingByUser.set(p.clientId, p);
    }

    const localKey = this.localPeer?.id || `local:${userId}`;
    const existingLocal = existingByUser.get(userId);
    nextParticipants[localKey] = {
      profile: existingLocal?.profile ?? null,
      peerId: localKey,
      clientId: userId,
      nickname: state.nickname,
      avatarColor: state.avatarColor,
      isLocal: true,
      inVoiceCall: state.inVoiceCall,
      isMuted: state.isMuted,
      isDeafened: state.isDeafened,
      isSpeaking: state.isLocalSpeaking,
      isWebcamActive: state.isWebcamActive,
      isScreenSharing: state.isScreenSharing,
      screenQualityLabel: existingLocal?.screenQualityLabel,
      activeSoundEffect: existingLocal?.activeSoundEffect ?? null,
    };

    let remoteJoinedVoice = false;
    let remoteLeftVoice = false;

    if (state.inVoiceCall) {
      for (const [uid, prev] of existingByUser.entries()) {
        if (uid === userId) continue;
        const next = byUserId.get(uid);
        if (prev.inVoiceCall && (!next || !next.inVoiceCall)) {
          remoteLeftVoice = true;
        }
      }
    }

    for (const [uid, entry] of byUserId.entries()) {
      const activeSession = [...this.sessions.values()].find(
        (s) => s.clientId === uid,
      );
      const prev = existingByUser.get(uid);
      const participantKey =
        entry.peerId ||
        activeSession?.peerId ||
        (prev?.peerId && !prev.peerId.startsWith("presence:")
          ? prev.peerId
          : `presence:${uid}`);
      const hasActiveVoice = Boolean(
        activeSession?.voiceCall || state.remoteStreams[participantKey]?.voice,
      );
      const nextInVoice = Boolean(entry.inVoiceCall) || hasActiveVoice;
      if (state.inVoiceCall && !prev?.inVoiceCall && nextInVoice) {
        remoteJoinedVoice = true;
      }
      nextParticipants[participantKey] = {
        profile: prev?.profile ?? null,
        peerId: participantKey,
        clientId: uid,
        nickname: entry.nickname || prev?.nickname || "Participante",
        avatarColor: entry.avatarColor || prev?.avatarColor || "#6eddbd",
        isLocal: false,
        inVoiceCall: nextInVoice,
        isMuted: Boolean(entry.isMuted),
        isDeafened: Boolean(entry.isDeafened),
        isSpeaking: prev?.isSpeaking ?? false,
        isWebcamActive: Boolean(entry.isVideoEnabled),
        isScreenSharing: Boolean(entry.isScreenSharing),
        screenQualityLabel: prev?.screenQualityLabel,
        rttMs: prev?.rttMs,
        activeSoundEffect: prev?.activeSoundEffect ?? null,
      };
    }

    useHubStore.getState().setParticipants(nextParticipants);
    if (remoteJoinedVoice) sounds.playJoin();
    if (remoteLeftVoice) sounds.playLeave();

    // Conecta PeerJS em malha completa (Full-Mesh) para dados e mídia ativa
    if (this.localPeer && !this.localPeer.destroyed && this.localPeer.open) {
      for (const entry of byUserId.values()) {
        if (!entry.peerId || entry.peerId === this.localPeer.id) continue;
        this.connectToPeer(entry.peerId, entry.userId, entry.nickname);

        const session = this.sessions.get(entry.peerId);
        if (session && state.inVoiceCall && entry.inVoiceCall) {
          if (!session.voiceCall) {
            if ((this.localPeer.id || "") < session.peerId) {
              this.initiateVoiceCallWithPeer(session);
            } else {
              const targetSession = session;
              window.setTimeout(() => {
                if (
                  useHubStore.getState().inVoiceCall &&
                  this.sessions.get(targetSession.peerId) === targetSession &&
                  !targetSession.voiceCall
                ) {
                  this.initiateVoiceCallWithPeer(targetSession);
                }
              }, 700);
            }
          }
          if (this.localWebcamStream && !session.outgoingWebcam) {
            this.initiateWebcamCallWithPeer(session);
          }
          if (
            state.isScreenSharing &&
            this.localScreenStream &&
            !session.outgoingScreen
          ) {
            this.initiateScreenCallWithPeer(session);
          }
        }
      }
    }
  }

  private async loadRoomMessages(roomId: string): Promise<void> {
    if (roomId.startsWith("room:")) {
      try {
        const localSaved = await chatLedger.refresh(roomId);
        if (useHubStore.getState().activeContext?.type === "room") {
          useHubStore.getState().setMessages(localSaved);
        }
      } catch {
        /* ignore */
      }
      return;
    }

    const { data, error } = await supabase
      .from("room_messages")
      .select(
        "id, room_id, sender_id, content, file_url, file_name, file_type, file_size, created_at",
      )
      .eq("room_id", roomId)
      .order("created_at", { ascending: true })
      .limit(200);

    if (error) {
      console.warn("[Room] Erro ao carregar mensagens:", error.message);
      try {
        const localSaved = await chatLedger.refresh(roomId);
        if (this.activeRoomMeta?.roomId === roomId) {
          useHubStore.getState().setMessages(localSaved);
        }
      } catch {
        /* ignore */
      }
      return;
    }

    const rows = data || [];
    const missingSenderIds = Array.from(
      new Set(
        rows
          .map((r) => r.sender_id)
          .filter(
            (id) =>
              id !== useHubStore.getState().authUserId &&
              !this.roomSenderProfiles.has(id) &&
              !useHubStore.getState().friends.some((f) => f.id === id),
          ),
      ),
    );

    if (missingSenderIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, nickname, avatar_color")
        .in("id", missingSenderIds);
      for (const p of profiles || []) {
        this.roomSenderProfiles.set(p.id, {
          nickname: p.nickname,
          avatarColor: p.avatar_color || "#6eddbd",
        });
      }
    }

    if (this.activeRoomMeta?.roomId !== roomId) return;
    const mapped = rows.map((row) => this.mapDbMessageToChat(row, null));
    useHubStore.getState().setMessages(mapped);
  }

  private processIncomingInviteText(
    msgId: string,
    content: string | undefined,
    senderId: string,
    senderNickname: string,
    createdAtMs?: number,
  ): void {
    if (!content || senderId === useHubStore.getState().authUserId) return;
    const match = content.match(/convite:\/\/sala\/([a-z0-9-]{1,48})/i);
    if (!match?.[1]) return;
    useHubStore.getState().addRoomInvite({
      id: `invite-${msgId}`,
      slug: match[1].toLowerCase(),
      senderId,
      senderNickname: senderNickname || "Alguém",
      createdAt: createdAtMs ?? Date.now(),
    });
  }

  private subscribeRoomMessages(roomId: string, slug: string): void {
    if (this.roomMessagesChannel) {
      void supabase.removeChannel(this.roomMessagesChannel);
      this.roomMessagesChannel = null;
    }

    let channel = supabase.channel(`room-chat:${slug}`);

    if (!roomId.startsWith("room:")) {
      channel = channel
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "room_messages",
            filter: `room_id=eq.${roomId}`,
          },
          async (payload) => {
            const row = payload.new as DbRoomMessageRow;
            if (!row || this.activeRoomMeta?.roomId !== roomId) return;
            if (
              row.sender_id !== useHubStore.getState().authUserId &&
              !this.roomSenderProfiles.has(row.sender_id) &&
              !useHubStore.getState().friends.some((f) => f.id === row.sender_id)
            ) {
              const summary = await this.resolvePeerProfileSummary(
                row.sender_id,
              );
              this.roomSenderProfiles.set(row.sender_id, summary);
            }
            if (this.activeRoomMeta?.roomId !== roomId) return;
            const mapped = this.mapDbMessageToChat(row, null);
            const state = useHubStore.getState();
            const alreadyExists = state.messages.some((m) => m.id === mapped.id);
            state.addMessage(mapped);
            if (!alreadyExists && row.sender_id !== state.authUserId) {
              state.setUnreadCount((n) => n + 1);
              this.processIncomingInviteText(
                mapped.id,
                mapped.content,
                row.sender_id,
                mapped.authorNickname,
                Date.parse(row.created_at) || Date.now(),
              );
              notifyNative({
                id: mapped.id,
                kind: "message",
                title: `#${slug} · ${mapped.authorNickname}`.slice(0, 100),
                body: (mapped.content || mapped.fileName || "Novo anexo").slice(0, 240),
              });
            }
          },
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "room_messages",
            filter: `room_id=eq.${roomId}`,
          },
          (payload) => {
            const row = payload.new as DbRoomMessageRow;
            if (!row || this.activeRoomMeta?.roomId !== roomId) return;
            const mapped = this.mapDbMessageToChat(row, null);
            useHubStore.setState((s) => ({
              messages: s.messages.map((m) => (m.id === mapped.id ? mapped : m)),
            }));
          },
        )
        .on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table: "room_messages",
            filter: `room_id=eq.${roomId}`,
          },
          (payload) => {
            const oldRow = payload.old as { id?: string };
            if (!oldRow?.id || this.activeRoomMeta?.roomId !== roomId) return;
            useHubStore.setState((s) => ({
              messages: s.messages.filter((m) => m.id !== oldRow.id),
            }));
          },
        );
    }

    channel
      .on("broadcast", { event: "room_chat_message" }, ({ payload }) => {
        const msg = payload as ChatMessage | undefined;
        if (
          !msg?.id ||
          this.activeRoomMeta?.roomId !== roomId ||
          msg.authorClientId === useHubStore.getState().authUserId
        ) {
          return;
        }
        const state = useHubStore.getState();
        const exists = state.messages.some((m) => m.id === msg.id);
        state.addMessage({ ...msg, delivery: "received" });
        if (!exists) {
          state.setUnreadCount((n) => n + 1);
          this.processIncomingInviteText(
            msg.id,
            msg.content,
            msg.authorClientId,
            msg.authorNickname,
            msg.createdAt || Date.now(),
          );
          notifyNative({
            id: msg.id,
            kind: "message",
            title: `#${slug} · ${msg.authorNickname}`.slice(0, 100),
            body: (msg.content || msg.fileName || "Novo anexo").slice(0, 240),
          });
        }
      })
      .on("broadcast", { event: "attachment_cached" }, ({ payload }) => {
        const p = payload as {
          messageId?: string;
          storagePath?: string | null;
          isRoom?: boolean;
        };
        if (p?.messageId) {
          this.handleRemoteAttachmentCached(
            p.messageId,
            p.storagePath || null,
            Boolean(p.isRoom),
          );
        }
      })
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const p = payload as {
          clientId?: string;
          nickname?: string;
          isTyping?: boolean;
        };
        if (!p?.clientId || p.clientId === useHubStore.getState().authUserId)
          return;
        useHubStore
          .getState()
          .setTypingUser(p.clientId, p.nickname || "Participante", Boolean(p.isTyping));
      })
      .subscribe();

    this.roomMessagesChannel = channel;
  }

  private async loadChannelMessages(
    channelId: string,
    friend: FriendItem,
  ): Promise<void> {
    const { data, error } = await supabase
      .from("messages")
      .select(
        "id, channel_id, sender_id, content, file_url, file_name, file_type, file_size, created_at, updated_at",
      )
      .eq("channel_id", channelId)
      .order("created_at", { ascending: true })
      .limit(200);

    if (error) {
      console.warn("[DM] Erro ao carregar mensagens:", error.message);
      try {
        const localSaved = await chatLedger.refresh(channelId);
        if (useHubStore.getState().activeChannelId === channelId) {
          useHubStore.getState().setMessages(localSaved);
        }
      } catch {
        /* ignore */
      }
      return;
    }

    if (useHubStore.getState().activeChannelId !== channelId) return;
    const mapped = (data || []).map((row) => this.mapDbMessageToChat(row, friend));
    useHubStore.getState().setMessages(mapped);
  }

  private subscribeDmChannel(channelId: string, friend: FriendItem): void {
    if (this.dmRealtimeChannel) {
      void supabase.removeChannel(this.dmRealtimeChannel);
      this.dmRealtimeChannel = null;
    }

    const channel = supabase
      .channel(`dm:${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          const row = payload.new as DbMessageRow;
          if (!row || useHubStore.getState().activeChannelId !== channelId) return;
          const mapped = this.mapDbMessageToChat(row, friend);
          const state = useHubStore.getState();
          const alreadyExists = state.messages.some((m) => m.id === mapped.id);
          state.addMessage(mapped);
          if (!alreadyExists && row.sender_id !== state.authUserId) {
            state.setUnreadCount((n) => n + 1);
            this.processIncomingInviteText(
              mapped.id,
              mapped.content,
              row.sender_id,
              mapped.authorNickname,
              Date.parse(row.created_at) || Date.now(),
            );
            notifyNative({
              id: mapped.id,
              kind: "message",
              title: mapped.authorNickname.slice(0, 100),
              body: (mapped.content || mapped.fileName || "Novo anexo").slice(0, 240),
            });
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          const row = payload.new as DbMessageRow;
          if (!row || useHubStore.getState().activeChannelId !== channelId) return;
          const mapped = this.mapDbMessageToChat(row, friend);
          useHubStore.setState((s) => ({
            messages: s.messages.map((m) => (m.id === mapped.id ? mapped : m)),
          }));
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "messages",
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          const oldRow = payload.old as { id?: string };
          if (!oldRow?.id || useHubStore.getState().activeChannelId !== channelId)
            return;
          useHubStore.setState((s) => ({
            messages: s.messages.filter((m) => m.id !== oldRow.id),
          }));
        },
      )
      .on("broadcast", { event: "attachment_cached" }, ({ payload }) => {
        const p = payload as {
          messageId?: string;
          storagePath?: string | null;
          isRoom?: boolean;
        };
        if (p?.messageId) {
          this.handleRemoteAttachmentCached(
            p.messageId,
            p.storagePath || null,
            Boolean(p.isRoom),
          );
        }
      })
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const p = payload as {
          clientId?: string;
          nickname?: string;
          isTyping?: boolean;
        };
        if (!p?.clientId || p.clientId === useHubStore.getState().authUserId)
          return;
        useHubStore
          .getState()
          .setTypingUser(p.clientId, p.nickname || friend.nickname, Boolean(p.isTyping));
      })
      .subscribe();

    this.dmRealtimeChannel = channel;
  }

  private async deliverRoomFallbackMessage(
    roomId: string,
    sentMsg: ChatMessage,
  ): Promise<void> {
    await chatLedger.mergeMessages(roomId, [sentMsg]).catch(() => {});
    if (this.roomMessagesChannel) {
      void this.roomMessagesChannel.send({
        type: "broadcast",
        event: "room_chat_message",
        payload: sentMsg,
      });
    }
    this.broadcast({ type: "chat_message", message: sentMsg });
  }

  public async sendChatMessage(
    content: string,
    _replyTo?: string,
  ): Promise<ChatMessage | null> {
    const state = useHubStore.getState();
    const isRoom = state.activeContext?.type === "room";
    const targetId =
      state.activeContext?.type === "room"
        ? state.activeContext.roomId
        : state.activeChannelId;
    const userId = state.authUserId;
    if (!targetId || !userId) {
      throw new Error(
        isRoom
          ? "Entre em uma sala para enviar mensagens."
          : "Selecione um amigo para enviar mensagens.",
      );
    }
    const trimmed = content.trim();
    if (!trimmed) return null;
    if (trimmed.length > 8000) {
      throw new Error("Limite de 8000 caracteres por mensagem.");
    }

    const id = crypto.randomUUID();
    const optimistic: ChatMessage = {
      id,
      roomId: targetId,
      channelId: targetId,
      type: "user",
      delivery: "queued",
      authorClientId: userId,
      authorNickname: state.nickname,
      authorAvatarColor: state.avatarColor,
      content: trimmed,
      createdAt: Date.now(),
      reactions: {},
    };
    state.addMessage(optimistic);

    if (isRoom) {
      if (!targetId.startsWith("room:")) {
        const { data, error } = await supabase
          .from("room_messages")
          .insert({
            id,
            room_id: targetId,
            sender_id: userId,
            content: trimmed,
          })
          .select()
          .single();

        if (!error && data) {
          const saved = this.mapDbMessageToChat(data, null);
          state.updateMessageUploadProgress(id, undefined, {
            ...saved,
            delivery: "sent",
          });
          return saved;
        }
      }

      // Fallback Realtime Broadcast + Malha P2P se room_messages não existir no DB
      const sentMsg: ChatMessage = { ...optimistic, delivery: "sent" };
      state.updateMessageUploadProgress(id, undefined, { delivery: "sent" });
      await this.deliverRoomFallbackMessage(targetId, sentMsg);
      return sentMsg;
    }

    const { data, error } = await supabase
      .from("messages")
      .insert({
        id,
        channel_id: targetId,
        sender_id: userId,
        content: trimmed,
      })
      .select()
      .single();

    if (error) {
      state.updateMessageUploadProgress(id, undefined, { delivery: "error" });
      throw new Error(error.message);
    }

    const saved = this.mapDbMessageToChat(data, state.activeFriend);
    state.updateMessageUploadProgress(id, undefined, {
      ...saved,
      delivery: "sent",
    });
    return saved;
  }

  public async sendFileMessage(
    file: File,
    caption = "",
  ): Promise<ChatMessage | null> {
    const state = useHubStore.getState();
    const isRoom = state.activeContext?.type === "room";
    const targetId =
      state.activeContext?.type === "room"
        ? state.activeContext.roomId
        : state.activeChannelId;
    const userId = state.authUserId;
    if (!targetId || !userId) {
      throw new Error(
        isRoom
          ? "Entre em uma sala antes de enviar arquivos."
          : "Selecione um amigo antes de enviar arquivos.",
      );
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      throw new Error(
        `O arquivo "${file.name}" excede o limite estrito de 50 MB (${(file.size / (1024 * 1024)).toFixed(1)} MB).`,
      );
    }

    const msgId = crypto.randomUUID();
    const safeName = file.name.replace(/[^\w.\-()+ ]/g, "_");
    const folderPrefix = isRoom ? `rooms/${targetId}` : `dm_channels/${targetId}`;
    const storagePath = `${folderPrefix}/${crypto.randomUUID()}-${safeName}`;

    const optimistic: ChatMessage = {
      id: msgId,
      roomId: targetId,
      channelId: targetId,
      type: "user",
      delivery: "queued",
      authorClientId: userId,
      authorNickname: state.nickname,
      authorAvatarColor: state.avatarColor,
      content: caption.trim() || file.name,
      createdAt: Date.now(),
      reactions: {},
      fileName: file.name,
      fileType: file.type || "application/octet-stream",
      fileSize: file.size,
      uploadProgress: { percent: 0, bytesPerSecond: 0 },
    };
    state.addMessage(optimistic);

    // Salva cópia local imediata na memória/IndexedDB do remetente antes de enviar pelo relay
    await storageDb.saveLocalAttachment({
      messageId: msgId,
      roomId: targetId,
      fileName: file.name,
      fileType: file.type || "application/octet-stream",
      fileSize: file.size,
      blob: file,
      savedAt: Date.now(),
    });

    try {
      await this.uploadAttachmentWithProgress(
        storagePath,
        file,
        (percent, bytesPerSecond) => {
          useHubStore
            .getState()
            .updateMessageUploadProgress(msgId, { percent, bytesPerSecond });
        },
      );

      const { data: urlData } = supabase.storage
        .from("cbs-attachments")
        .getPublicUrl(storagePath);
      const fileUrl = urlData.publicUrl;

      if (isRoom) {
        if (!targetId.startsWith("room:")) {
          const { data, error } = await supabase
            .from("room_messages")
            .insert({
              id: msgId,
              room_id: targetId,
              sender_id: userId,
              content: caption.trim() || file.name,
              file_url: fileUrl,
              file_name: file.name,
              file_type: file.type || "application/octet-stream",
              file_size: file.size,
            })
            .select()
            .single();

          if (!error && data) {
            const saved = this.mapDbMessageToChat(data, null);
            useHubStore.getState().updateMessageUploadProgress(msgId, undefined, {
              ...saved,
              delivery: "sent",
            });
            return saved;
          }
        }

        const sentMsg: ChatMessage = {
          ...optimistic,
          fileUrl,
          uploadProgress: undefined,
          delivery: "sent",
        };
        useHubStore.getState().updateMessageUploadProgress(msgId, undefined, {
          fileUrl,
          delivery: "sent",
        });
        await this.deliverRoomFallbackMessage(targetId, sentMsg);
        return sentMsg;
      }

      const { data, error } = await supabase
        .from("messages")
        .insert({
          id: msgId,
          channel_id: targetId,
          sender_id: userId,
          content: caption.trim() || file.name,
          file_url: fileUrl,
          file_name: file.name,
          file_type: file.type || "application/octet-stream",
          file_size: file.size,
        })
        .select()
        .single();

      if (error) throw new Error(error.message);

      const saved = this.mapDbMessageToChat(data, state.activeFriend);
      useHubStore.getState().updateMessageUploadProgress(msgId, undefined, {
        ...saved,
        delivery: "sent",
      });
      return saved;
    } catch (err) {
      useHubStore
        .getState()
        .updateMessageUploadProgress(msgId, undefined, { delivery: "error" });
      throw err;
    }
  }

  private extractStorageObjectPath(fileUrl?: string | null): string | null {
    if (!fileUrl || fileUrl.startsWith("local://")) return null;
    try {
      const url = new URL(fileUrl);
      const marker = "/storage/v1/object/";
      const idx = url.pathname.indexOf(marker);
      if (idx < 0) return null;
      const rest = url.pathname.slice(idx + marker.length);
      const bucketMarker = "cbs-attachments/";
      const bIdx = rest.indexOf(bucketMarker);
      if (bIdx < 0) return null;
      return rest
        .slice(bIdx + bucketMarker.length)
        .split("/")
        .map((seg) => decodeURIComponent(seg))
        .join("/");
    } catch {
      return null;
    }
  }

  private handleRemoteAttachmentCached(
    messageId: string,
    storagePath: string | null,
    isRoom: boolean,
  ): void {
    const state = useHubStore.getState();
    const msg = state.messages.find((m) => m.id === messageId);
    const resolvedPath =
      storagePath || this.extractStorageObjectPath(msg?.fileUrl);

    // Somente o remetente (ou quem originou o upload) confirma a limpeza no relay
    if (msg && msg.authorClientId !== state.authUserId) {
      return;
    }

    if (isRoom) {
      if (this.pendingRoomRelayPurges.has(messageId)) return;
      const timer = window.setTimeout(() => {
        this.pendingRoomRelayPurges.delete(messageId);
        void this.purgeTransientCloudAttachment(
          messageId,
          resolvedPath,
          true,
          "stored",
        );
      }, 60_000);
      this.pendingRoomRelayPurges.set(messageId, timer);
      return;
    }

    void this.purgeTransientCloudAttachment(
      messageId,
      resolvedPath,
      false,
      "stored",
    );
  }

  private async purgeTransientCloudAttachment(
    messageId: string,
    storagePath: string | null,
    isRoom: boolean,
    statusTag: "stored" | "purged",
  ): Promise<void> {
    if (storagePath) {
      await supabase.storage
        .from("cbs-attachments")
        .remove([storagePath])
        .catch(() => {});
    }

    const markerUrl = `local://${statusTag}/${messageId}`;
    const userId = useHubStore.getState().authUserId;
    if (!userId) return;

    const table = isRoom ? "room_messages" : "messages";
    if (!(isRoom && this.activeRoomMeta?.roomId.startsWith("room:"))) {
      await supabase
        .from(table)
        .update({ file_url: markerUrl })
        .eq("id", messageId)
        .then(() => {}, () => {});
    }

    useHubStore.setState((s) => ({
      messages: s.messages.map((m) =>
        m.id === messageId ? { ...m, fileUrl: markerUrl } : m,
      ),
    }));
  }

  public async resolveAttachmentBlobUrl(
    message: ChatMessage,
  ): Promise<ResolvedAttachmentResult> {
    if (!message?.id) return { status: "missing" };

    // 1. Verifica memória local (IndexedDB + cache de sessão)
    const cached = await storageDb.getLocalAttachment(message.id);
    if (cached && cached.blob && cached.blob.size > 0) {
      return {
        status: "ready",
        url: URL.createObjectURL(cached.blob),
        fromLocal: true,
      };
    }

    // 2. Se o registro já aponta para armazenamento apenas local e não está no dispositivo
    if (!message.fileUrl || message.fileUrl.startsWith("local://")) {
      return { status: "missing" };
    }

    // 3. Deduplica download concorrente (ex: StrictMode double-mount) para evitar corridas
    let inflight = this.attachmentResolveLocks.get(message.id);
    if (!inflight) {
      inflight = (async () => {
        const storagePath = this.extractStorageObjectPath(message.fileUrl);
        let downloadedBlob: Blob | null = null;

        for (let attempt = 0; attempt < 2; attempt++) {
          if (attempt > 0) {
            await new Promise((r) => window.setTimeout(r, 900));
          }

          if (storagePath) {
            const { data, error } = await supabase.storage
              .from("cbs-attachments")
              .download(storagePath);
            if (!error && data && data.size > 0) {
              downloadedBlob = data;
              break;
            }
          }

          try {
            const res = await fetch(message.fileUrl!);
            if (res.status === 404 || res.status === 410) {
              break;
            }
            if (res.ok) {
              const b = await res.blob();
              if (b.size > 0) {
                downloadedBlob = b;
                break;
              }
            }
          } catch {
            /* retry transient network error once */
          }
        }

        if (downloadedBlob && downloadedBlob.size > 0) {
          await storageDb.saveLocalAttachment({
            messageId: message.id,
            roomId: message.roomId,
            fileName: message.fileName || "arquivo",
            fileType: message.fileType || downloadedBlob.type || "application/octet-stream",
            fileSize: message.fileSize || downloadedBlob.size,
            blob: downloadedBlob,
            savedAt: Date.now(),
          });

          const state = useHubStore.getState();
          const isRoom = state.activeContext?.type === "room";
          if (message.authorClientId !== state.authUserId) {
            const activeCh = isRoom
              ? this.roomMessagesChannel
              : this.dmRealtimeChannel;
            if (activeCh) {
              void activeCh.send({
                type: "broadcast",
                event: "attachment_cached",
                payload: {
                  messageId: message.id,
                  storagePath,
                  isRoom,
                },
              });
            }
            if (!isRoom) {
              void this.purgeTransientCloudAttachment(
                message.id,
                storagePath,
                false,
                "stored",
              );
            }
          }
        }
      })().finally(() => {
        this.attachmentResolveLocks.delete(message.id);
      });
      this.attachmentResolveLocks.set(message.id, inflight);
    }

    await inflight;

    const storedAfterFetch = await storageDb.getLocalAttachment(message.id);
    if (storedAfterFetch && storedAfterFetch.blob.size > 0) {
      return {
        status: "ready",
        url: URL.createObjectURL(storedAfterFetch.blob),
        fromLocal: true,
      };
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return { status: "offline" };
    }
    return { status: "missing" };
  }

  public async readAttachmentText(message: ChatMessage): Promise<string> {
    let record = await storageDb.getLocalAttachment(message.id);
    if (!record) {
      const resolved = await this.resolveAttachmentBlobUrl(message);
      if (resolved.status === "ready") {
        URL.revokeObjectURL(resolved.url);
      }
      record = await storageDb.getLocalAttachment(message.id);
    }
    if (!record) {
      throw new Error(
        "Esse item não foi encontrado na memoria, peça para o usuario enviar novamente",
      );
    }
    const text = await record.blob.text();
    return text.slice(0, 200_000);
  }

  public async deleteAttachmentFromLocalMemory(
    message: ChatMessage,
  ): Promise<void> {
    await storageDb.deleteLocalAttachment(message.id);
    const pendingTimer = this.pendingRoomRelayPurges.get(message.id);
    if (pendingTimer !== undefined) {
      window.clearTimeout(pendingTimer);
      this.pendingRoomRelayPurges.delete(message.id);
    }
    const storagePath = this.extractStorageObjectPath(message.fileUrl);
    const isRoom = useHubStore.getState().activeContext?.type === "room";
    await this.purgeTransientCloudAttachment(
      message.id,
      storagePath,
      isRoom,
      "purged",
    );
  }

  private async uploadAttachmentWithProgress(
    storagePath: string,
    file: File,
    onProgress: (percent: number, bytesPerSecond: number) => void,
  ): Promise<void> {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    if (!token) {
      const { error } = await supabase.storage
        .from("cbs-attachments")
        .upload(storagePath, file, { upsert: false });
      if (error) throw new Error(error.message);
      onProgress(100, file.size);
      return;
    }

    const encodedPath = storagePath
      .split("/")
      .map((seg) => encodeURIComponent(seg))
      .join("/");
    const endpoint = `${SUPABASE_URL}/storage/v1/object/cbs-attachments/${encodedPath}`;
    const startedAt = performance.now();

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", endpoint, true);
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.setRequestHeader("apikey", SUPABASE_ANON_KEY);
      xhr.setRequestHeader("x-upsert", "false");
      if (file.type) {
        xhr.setRequestHeader("Content-Type", file.type);
      }

      xhr.upload.onprogress = (ev) => {
        if (!ev.lengthComputable) return;
        const elapsedSec = Math.max(0.05, (performance.now() - startedAt) / 1000);
        const percent = Math.min(99, Math.round((ev.loaded / ev.total) * 100));
        const bps = Math.round(ev.loaded / elapsedSec);
        onProgress(percent, bps);
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const elapsedSec = Math.max(0.05, (performance.now() - startedAt) / 1000);
          onProgress(100, Math.round(file.size / elapsedSec));
          resolve();
        } else {
          let message = `Erro no upload (${xhr.status})`;
          try {
            const parsed = JSON.parse(xhr.responseText);
            if (parsed?.message || parsed?.error) {
              message = parsed.message || parsed.error;
            }
          } catch {
            /* ignore */
          }
          reject(new Error(message));
        }
      };

      xhr.onerror = () => reject(new Error("Falha de rede durante o upload."));
      xhr.send(file);
    });
  }

  public async mutateChat(
    messageId: string,
    kind: ChatOperation["kind"],
    data: { content?: string; emoji?: string; active?: boolean } = {},
  ): Promise<void> {
    const state = useHubStore.getState();
    const isRoom = state.activeContext?.type === "room";
    const message = state.messages.find((m) => m.id === messageId);
    if (!message || message.deleted) throw new Error("Mensagem indisponível.");

    if (kind === "edit" && data.content !== undefined) {
      const trimmed = data.content.trim();
      if (!trimmed) throw new Error("Mensagem vazia.");
      if (!(isRoom && this.activeRoomMeta?.roomId.startsWith("room:"))) {
        const table = isRoom ? "room_messages" : "messages";
        const { error } = await supabase
          .from(table)
          .update({ content: trimmed, updated_at: new Date().toISOString() })
          .eq("id", messageId)
          .eq("sender_id", state.authUserId || "");
        if (error) throw new Error(error.message);
      }
      useHubStore.setState((s) => ({
        messages: s.messages.map((m) =>
          m.id === messageId
            ? { ...m, content: trimmed, editedAt: Date.now() }
            : m,
        ),
      }));
      return;
    }

    if (kind === "delete") {
      if (!(isRoom && this.activeRoomMeta?.roomId.startsWith("room:"))) {
        const table = isRoom ? "room_messages" : "messages";
        const { error } = await supabase
          .from(table)
          .delete()
          .eq("id", messageId)
          .eq("sender_id", state.authUserId || "");
        if (error) throw new Error(error.message);
      }
      useHubStore.setState((s) => ({
        messages: s.messages.filter((m) => m.id !== messageId),
      }));
      return;
    }

    if (kind === "reaction" && data.emoji) {
      state.updateMessageReaction(
        messageId,
        data.emoji,
        state.clientId,
        state.nickname,
      );
      return;
    }

    if (kind === "pin") {
      useHubStore.setState((s) => ({
        messages: s.messages.map((m) =>
          m.id === messageId ? { ...m, pinned: data.active } : m,
        ),
      }));
    }
  }

  public async toggleMessageReaction(
    messageId: string,
    emoji: string,
  ): Promise<void> {
    const state = useHubStore.getState();
    const msg = state.messages.find((m) => m.id === messageId);
    await this.mutateChat(messageId, "reaction", {
      emoji,
      active: !msg?.reactions[emoji]?.reactorClientIds.includes(state.clientId),
    });
  }

  public sendTypingState(isTyping: boolean): void {
    const state = useHubStore.getState();
    const targetChannel =
      state.activeContext?.type === "room"
        ? this.roomMessagesChannel
        : this.dmRealtimeChannel;
    if (targetChannel && state.authUserId) {
      void targetChannel.send({
        type: "broadcast",
        event: "typing",
        payload: {
          clientId: state.authUserId,
          nickname: state.nickname,
          isTyping,
        },
      });
    }
    this.broadcast({
      type: "chat_typing",
      clientId: state.clientId,
      nickname: state.nickname,
      isTyping,
    });
  }

  /* ========================================================================= */
  /* FASE 4: LIGAÇÃO DIRETA 1:1 (SIGNALLING CALLS + PEERJS DIRETO)             */
  /* ========================================================================= */

  private subscribeSignalingCalls(userId: string): void {
    if (this.callsChannelIn) void supabase.removeChannel(this.callsChannelIn);
    if (this.callsChannelOut) void supabase.removeChannel(this.callsChannelOut);

    this.callsChannelIn = supabase
      .channel(`calls-in:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "signaling_calls",
          filter: `receiver_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as DbSignalingCallRow | undefined;
          if (!row?.id) return;
          void this.handleIncomingSignalingCallEvent(row);
        },
      )
      .subscribe();

    this.callsChannelOut = supabase
      .channel(`calls-out:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "signaling_calls",
          filter: `caller_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as DbSignalingCallRow | undefined;
          if (!row?.id) return;
          void this.handleOutgoingSignalingCallEvent(row);
        },
      )
      .subscribe();
  }

  private async resolvePeerProfileSummary(
    peerUserId: string,
  ): Promise<{ nickname: string; avatarColor: string }> {
    const cached = useHubStore.getState().friends.find((f) => f.id === peerUserId);
    if (cached) {
      return { nickname: cached.nickname, avatarColor: cached.avatarColor };
    }
    const { data } = await supabase
      .from("profiles")
      .select("nickname, avatar_color")
      .eq("id", peerUserId)
      .maybeSingle();
    return {
      nickname: data?.nickname || "Amigo",
      avatarColor: data?.avatar_color || "#6eddbd",
    };
  }

  private async handleIncomingSignalingCallEvent(
    row: DbSignalingCallRow,
  ): Promise<void> {
    const state = useHubStore.getState();

    if (row.status === "calling") {
      // Se já está em ligação ou tocando outra, rejeita por ocupado
      if (
        state.inVoiceCall ||
        state.outgoingCall ||
        (state.incomingCall && state.incomingCall.id !== row.id)
      ) {
        await supabase
          .from("signaling_calls")
          .update({ status: "rejected", updated_at: new Date().toISOString() })
          .eq("id", row.id);
        return;
      }

      if (state.incomingCall?.id === row.id) return;

      const summary = await this.resolvePeerProfileSummary(row.caller_id);
      const callData: SignalingCallData = {
        ...row,
        peerNickname: summary.nickname,
        peerAvatarColor: summary.avatarColor,
      };
      useHubStore.getState().setIncomingCall(callData);
      sounds.startRingtone();

      if (this.incomingCallTimer !== null) {
        window.clearTimeout(this.incomingCallTimer);
      }
      this.incomingCallTimer = window.setTimeout(() => {
        const current = useHubStore.getState().incomingCall;
        if (current?.id === row.id) {
          void this.rejectIncomingCall();
        }
      }, 45_000);

      notifyNative(
        {
          id: row.id,
          kind: "call",
          title: "Chamada recebida no cbsHUB",
          body: `${summary.nickname.slice(0, 80)} está ligando para você. Clique para atender.`,
        },
        () => {
          if (useHubStore.getState().incomingCall?.id === row.id) {
            void this.acceptIncomingCall().catch((err) =>
              mediaError("Atender chamada", err),
            );
          }
        },
      );
      return;
    }

    if (row.status === "ended" || row.status === "rejected") {
      if (state.incomingCall?.id === row.id) {
        this.clearIncomingCallTimer();
        sounds.stopRingtone();
        useHubStore.getState().setIncomingCall(null);
      }
      if (state.activeCallId === row.id) {
        this.cleanupDirectCallLocalState();
      }
    }
  }

  private async handleOutgoingSignalingCallEvent(
    row: DbSignalingCallRow,
  ): Promise<void> {
    const state = useHubStore.getState();

    if (row.status === "accepted" && row.receiver_peer_id) {
      if (
        state.outgoingCall?.id !== row.id &&
        state.activeCallId !== row.id
      ) {
        return;
      }
      const wasOutgoing = state.outgoingCall?.id === row.id;
      sounds.stopRingtone();
      if (wasOutgoing) sounds.playJoin();
      const withVideo = state.outgoingCall?.withVideo ?? this.pendingOutgoingVideo;
      const friendMatch = state.friends.find((f) => f.id === row.receiver_id);
      const placeholder = state.participants[`calling:${row.receiver_id}`];
      const remoteNickname =
        state.outgoingCall?.peerNickname ||
        friendMatch?.nickname ||
        placeholder?.nickname ||
        "Amigo";
      const remoteAvatarColor =
        state.outgoingCall?.peerAvatarColor ||
        friendMatch?.avatarColor ||
        placeholder?.avatarColor ||
        "#6eddbd";

      this.pendingOutgoingVideo = false;
      state.setOutgoingCall(null);
      state.setActiveCallId(row.id);
      state.setCallStageMode("grid");

      this.directRemotePeerId = row.receiver_peer_id;
      this.directRemoteUserId = row.receiver_id;

      const nextParticipants = { ...useHubStore.getState().participants };
      delete nextParticipants[`calling:${row.receiver_id}`];
      delete nextParticipants[`presence:${row.receiver_id}`];
      const localPid = this.localParticipantId();
      if (localPid && nextParticipants[localPid]) {
        nextParticipants[localPid] = {
          ...nextParticipants[localPid],
          inVoiceCall: true,
          isMuted: useHubStore.getState().isMuted,
          isDeafened: useHubStore.getState().isDeafened,
        };
      }
      const prevRemote = nextParticipants[row.receiver_peer_id];
      nextParticipants[row.receiver_peer_id] = {
        profile: prevRemote?.profile ?? null,
        peerId: row.receiver_peer_id,
        clientId: row.receiver_id,
        nickname: remoteNickname,
        avatarColor: remoteAvatarColor,
        isLocal: false,
        inVoiceCall: true,
        isMuted: prevRemote?.isMuted ?? false,
        isDeafened: prevRemote?.isDeafened ?? false,
        isSpeaking: prevRemote?.isSpeaking ?? false,
        isWebcamActive: prevRemote?.isWebcamActive ?? false,
        isScreenSharing: prevRemote?.isScreenSharing ?? false,
        activeSoundEffect: prevRemote?.activeSoundEffect ?? null,
      };
      useHubStore.getState().setParticipants(nextParticipants);

      // Garante que estamos na DM do amigo e estabelece enlace direto 1:1
      if (this.localPeer && !this.localPeer.destroyed) {
        this.connectToPeer(row.receiver_peer_id, row.receiver_id, remoteNickname);
        this.broadcastLocalState();
        const directSession = this.sessions.get(row.receiver_peer_id);
        if (directSession && !directSession.voiceCall) {
          this.initiateVoiceCallWithPeer(directSession);
        }
        if (withVideo && !useHubStore.getState().isWebcamActive) {
          void this.toggleWebcam().catch(() => {});
        }
      }
      return;
    }

    if (row.status === "rejected" || row.status === "ended") {
      if (state.outgoingCall?.id === row.id) {
        sounds.stopRingtone();
        this.pendingOutgoingVideo = false;
        state.setOutgoingCall(null);
        state.setStatusText(
          row.status === "rejected" ? "Chamada recusada" : "Chamada encerrada",
        );
        this.cleanupDirectCallLocalState();
      } else if (state.activeCallId === row.id) {
        this.cleanupDirectCallLocalState();
      }
    }
  }

  private clearIncomingCallTimer(): void {
    if (this.incomingCallTimer !== null) {
      window.clearTimeout(this.incomingCallTimer);
      this.incomingCallTimer = null;
    }
  }

  private async ensureLocalPeer(userId: string): Promise<string> {
    if (this.localPeer && !this.localPeer.destroyed && this.localPeer.open) {
      const state = useHubStore.getState();
      const existing = state.participants[this.localPeer.id];
      const nextParticipants = { ...state.participants };
      nextParticipants[this.localPeer.id] = {
        profile: existing?.profile ?? null,
        peerId: this.localPeer.id,
        clientId: userId,
        nickname: state.nickname,
        avatarColor: state.avatarColor,
        isLocal: true,
        inVoiceCall: state.inVoiceCall,
        isMuted: state.isMuted,
        isDeafened: state.isDeafened,
        isSpeaking: existing?.isSpeaking ?? false,
        isWebcamActive: state.isWebcamActive,
        isScreenSharing: state.isScreenSharing,
        screenQualityLabel: existing?.screenQualityLabel,
        activeSoundEffect: existing?.activeSoundEffect ?? null,
      };
      state.setParticipants(nextParticipants);
      return this.localPeer.id;
    }

    if (this.localPeer && !this.localPeer.destroyed) {
      try {
        this.localPeer.destroy();
      } catch {
        /* ignore */
      }
      this.localPeer = null;
    }

    const state = useHubStore.getState();
    const shortId = this.generateShortId(userId);
    const nonce = Math.random().toString(36).substring(2, 6);
    const localPeerId = `cbshub-u-${shortId}-${nonce}`;

    const localParticipant: Participant = {
      peerId: localPeerId,
      clientId: userId,
      nickname: state.nickname,
      avatarColor: state.avatarColor,
      isLocal: true,
      inVoiceCall: state.inVoiceCall,
      isMuted: state.isMuted,
      isDeafened: state.isDeafened,
      isSpeaking: false,
      isWebcamActive: state.isWebcamActive,
      isScreenSharing: state.isScreenSharing,
      activeSoundEffect: null,
    };

    if (state.activeContext?.type === "room") {
      const nextParticipants: Record<string, Participant> = {
        [localPeerId]: localParticipant,
      };
      for (const [key, p] of Object.entries(state.participants)) {
        if (!p.isLocal && p.clientId !== userId) {
          nextParticipants[key] = p;
        }
      }
      state.setParticipants(nextParticipants);
    } else {
      state.setParticipants({ [localPeerId]: localParticipant });
    }

    useMediaState.setState({ signaling: "connecting" });
    this.signalingPendingAt = Date.now();
    const peer = new Peer(localPeerId, PEER_CONFIG);
    this.localPeer = peer;
    this.setupLocalPeerListeners();

    return new Promise<string>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        reject(new Error("Tempo esgotado ao conectar ao servidor PeerJS."));
      }, 15_000);

      peer.on("open", (id) => {
        window.clearTimeout(timeout);
        if (this.localPeer !== peer) return;
        callEvent("signaling_open");
        this.signalingPendingAt = 0;
        useMediaState.setState({ signaling: "online" });
        useHubStore
          .getState()
          .setConnectionStatus(true, true, id, this.directRemotePeerId, "Conectado");
        if (this.activeRoomMeta) {
          const slug = this.activeRoomMeta.slug;
          void this.trackRoomMeshPresence().then(() =>
            this.syncRoomMeshState(slug),
          );
        }
        resolve(id);
      });

      peer.on("error", (err: { type?: string }) => {
        callEvent("signaling_error", {
          reason:
            err.type === "network" ||
            err.type === "socket-error" ||
            err.type === "server-error"
              ? err.type
              : "unknown",
        });
        console.warn("[WebRTC Engine] Erro no localPeer:", err);
        if (
          err.type === "network" ||
          err.type === "socket-error" ||
          err.type === "server-error"
        ) {
          this.scheduleSilentDirectReconnect();
        }
      });

      peer.on("disconnected", () => {
        if (this.localPeer !== peer) return;
        useMediaState.setState({ signaling: "offline" });
        callEvent("signaling_disconnected");
        // Reconexão silenciosa sem derrubar estado da chamada nem flash de overlay
        try {
          peer.reconnect();
        } catch {
          this.scheduleSilentDirectReconnect();
        }
      });

      peer.on("close", () => {
        const s = useHubStore.getState();
        if (
          this.localPeer === peer &&
          (s.inVoiceCall || s.activeContext?.type === "room")
        ) {
          this.localPeer = null;
          this.scheduleSilentDirectReconnect();
        }
      });
    });
  }

  public async startDirectCall(
    friend: FriendItem,
    withVideo = false,
  ): Promise<void> {
    const initialState = useHubStore.getState();
    const userId = initialState.authUserId;
    if (!userId) throw new Error("Usuário não autenticado.");

    if (initialState.activeContext?.type === "room") {
      this.leaveRoom();
    }

    const state = useHubStore.getState();
    if (state.inVoiceCall || state.outgoingCall || this.joiningVoice) return;

    this.joiningVoice = true;
    this.clearMicRecovery();
    this.pendingOutgoingVideo = withVideo;

    try {
      await this.openDirectMessage(friend);
      await this.setupLocalMicrophone();
      const callerPeerId = await this.ensureLocalPeer(userId);

      this.recoveryCancelled = false;
      this.directRemoteUserId = friend.id;
      this.directRemotePeerId = null;

      beginCallDiagnostics();
      useHubStore.getState().setInVoiceCall(true);
      const latest = useHubStore.getState();
      latest.setCallStageMode("grid");
      const nextParticipants = { ...latest.participants };
      const existingLocal = nextParticipants[callerPeerId];
      nextParticipants[callerPeerId] = {
        profile: existingLocal?.profile ?? null,
        peerId: callerPeerId,
        clientId: userId,
        nickname: latest.nickname,
        avatarColor: latest.avatarColor,
        isLocal: true,
        inVoiceCall: true,
        isMuted: latest.isMuted,
        isDeafened: latest.isDeafened,
        isSpeaking: existingLocal?.isSpeaking ?? false,
        isWebcamActive: latest.isWebcamActive,
        isScreenSharing: latest.isScreenSharing,
        activeSoundEffect: existingLocal?.activeSoundEffect ?? null,
      };
      nextParticipants[`calling:${friend.id}`] = {
        profile: null,
        peerId: `calling:${friend.id}`,
        clientId: friend.id,
        nickname: friend.nickname,
        avatarColor: friend.avatarColor,
        isLocal: false,
        inVoiceCall: true,
        isMuted: false,
        isDeafened: false,
        isSpeaking: false,
        isWebcamActive: false,
        isScreenSharing: false,
        activeSoundEffect: null,
      };
      latest.setParticipants(nextParticipants);
      await this.trackPresence();

      const { data: callRow, error } = await supabase
        .from("signaling_calls")
        .insert({
          caller_id: userId,
          receiver_id: friend.id,
          caller_peer_id: callerPeerId,
          status: "calling",
        })
        .select()
        .single();

      if (error || !callRow) {
        throw new Error(error?.message || "Erro ao iniciar sinalização de chamada.");
      }

      const outgoing: SignalingCallData = {
        ...callRow,
        peerNickname: friend.nickname,
        peerAvatarColor: friend.avatarColor,
        withVideo,
      };
      useHubStore.getState().setOutgoingCall(outgoing);
      useHubStore.getState().setActiveCallId(callRow.id);
      sounds.startDialTone();
    } catch (err) {
      this.cleanupDirectCallLocalState();
      mediaError("Chamada direta", err);
    } finally {
      this.joiningVoice = false;
    }
  }

  public async acceptIncomingCall(): Promise<void> {
    const initialState = useHubStore.getState();
    const call = initialState.incomingCall;
    const userId = initialState.authUserId;
    if (!call || !userId || this.joiningVoice) return;

    this.clearIncomingCallTimer();
    sounds.stopRingtone();
    if (initialState.activeContext?.type === "room") {
      this.leaveRoom();
    } else if (initialState.inVoiceCall) {
      this.leaveVoiceCall("manual_leave");
    }

    const state = useHubStore.getState();
    this.joiningVoice = true;
    this.clearMicRecovery();

    try {
      useHubStore.getState().setIncomingCall(null);
      useHubStore.getState().setActiveCallId(call.id);

      const friend = state.friends.find((f) => f.id === call.caller_id);
      if (friend) {
        await this.openDirectMessage(friend);
      }

      await this.setupLocalMicrophone();
      const receiverPeerId = await this.ensureLocalPeer(userId);

      this.recoveryCancelled = false;
      this.directRemoteUserId = call.caller_id;
      this.directRemotePeerId = call.caller_peer_id;

      beginCallDiagnostics();
      useHubStore.getState().setInVoiceCall(true);
      const latest = useHubStore.getState();
      latest.setCallStageMode("grid");
      const nextParticipants = { ...latest.participants };
      const existingLocal = nextParticipants[receiverPeerId];
      nextParticipants[receiverPeerId] = {
        profile: existingLocal?.profile ?? null,
        peerId: receiverPeerId,
        clientId: userId,
        nickname: latest.nickname,
        avatarColor: latest.avatarColor,
        isLocal: true,
        inVoiceCall: true,
        isMuted: latest.isMuted,
        isDeafened: latest.isDeafened,
        isSpeaking: existingLocal?.isSpeaking ?? false,
        isWebcamActive: latest.isWebcamActive,
        isScreenSharing: latest.isScreenSharing,
        activeSoundEffect: existingLocal?.activeSoundEffect ?? null,
      };
      if (call.caller_peer_id) {
        delete nextParticipants[`calling:${call.caller_id}`];
        delete nextParticipants[`presence:${call.caller_id}`];
        nextParticipants[call.caller_peer_id] = {
          profile: nextParticipants[call.caller_peer_id]?.profile ?? null,
          peerId: call.caller_peer_id,
          clientId: call.caller_id,
          nickname: call.peerNickname || friend?.nickname || "Amigo",
          avatarColor:
            call.peerAvatarColor || friend?.avatarColor || "#6eddbd",
          isLocal: false,
          inVoiceCall: true,
          isMuted: false,
          isDeafened: false,
          isSpeaking: false,
          isWebcamActive: false,
          isScreenSharing: false,
          activeSoundEffect: null,
        };
      }
      latest.setParticipants(nextParticipants);
      await this.trackPresence();

      const { error } = await supabase
        .from("signaling_calls")
        .update({
          status: "accepted",
          receiver_peer_id: receiverPeerId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", call.id);

      if (error) throw new Error(error.message);

      sounds.playJoin();

      if (call.caller_peer_id) {
        const callerPeerId = call.caller_peer_id;
        this.connectToPeer(callerPeerId, call.caller_id, call.peerNickname);
        window.setTimeout(() => {
          const currentSession = this.sessions.get(callerPeerId);
          if (
            currentSession &&
            useHubStore.getState().inVoiceCall &&
            !currentSession.voiceCall
          ) {
            this.initiateVoiceCallWithPeer(currentSession);
          }
        }, 450);
      }
    } catch (err) {
      this.cleanupDirectCallLocalState();
      mediaError("Atender chamada", err);
    } finally {
      this.joiningVoice = false;
    }
  }

  public async rejectIncomingCall(): Promise<void> {
    const call = useHubStore.getState().incomingCall;
    this.clearIncomingCallTimer();
    sounds.stopRingtone();
    useHubStore.getState().setIncomingCall(null);
    if (!call) return;

    await supabase
      .from("signaling_calls")
      .update({
        status: "rejected",
        updated_at: new Date().toISOString(),
      })
      .eq("id", call.id);
  }

  public async joinVoiceCall(): Promise<void> {
    const state = useHubStore.getState();
    if (state.activeContext?.type === "room") {
      await this.joinRoomVoiceCall(false);
      return;
    }
    const friend = state.activeFriend;
    if (friend) {
      await this.startDirectCall(friend, false);
    } else {
      mediaError("Ligação", "Selecione um amigo ou entre em uma sala para iniciar uma chamada.");
    }
  }

  public leaveVoiceCall(
    reason: "manual_leave" | "microphone_ended" = "manual_leave",
  ): void {
    endCallDiagnostics(reason);
    const state = useHubStore.getState();

    if (state.activeContext?.type === "room") {
      this.cleanupRoomVoiceOnly();
      return;
    }

    const callId = state.activeCallId || state.outgoingCall?.id;

    sounds.stopRingtone();
    this.pendingOutgoingVideo = false;

    if (callId) {
      const nextStatus = state.outgoingCall ? "rejected" : "ended";
      void supabase
        .from("signaling_calls")
        .update({
          status: nextStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", callId);
    }

    this.cleanupDirectCallLocalState();
  }

  private cleanupRoomVoiceOnly(): void {
    const state = useHubStore.getState();
    this.micGeneration++;
    this.clearMicRecovery();
    this.joiningVoice = false;
    this.cameraGeneration++;
    this.screenGeneration++;
    this.pushToTalkHeld = false;
    this.waitingForMedia.clear();

    soundboardEngine.stopAll();
    this.audioPipeline?.destroy();
    this.audioPipeline = null;
    this.rawMicStream?.getTracks().forEach((t) => t.stop());
    this.rawMicStream = null;

    state.setLocalVoiceStream(null);
    state.setIsLocalSpeaking(false, 0);

    if (state.isScreenSharing) {
      this.stopScreenShare();
    }
    if (state.isWebcamActive && this.localWebcamStream) {
      this.localWebcamStream.getTracks().forEach((t) => t.stop());
      this.localWebcamStream = null;
      state.setLocalWebcamStream(null);
      state.setWebcamActive(false);
    }

    const wasInVoice = state.inVoiceCall;
    state.setInVoiceCall(false);
    state.setRemoteVoiceStream(null);
    state.setRemoteScreenStream(null);
    useMediaState.setState({
      microphoneBusy: false,
      cameraBusy: false,
      screenBusy: false,
      quality: {},
    });
    if (wasInVoice) sounds.playLeave();

    for (const session of this.sessions.values()) {
      this.closeBlockedMedia(session);
    }

    if (this.localPeer) {
      useHubStore.getState().updateParticipant(this.localParticipantId(), {
        inVoiceCall: false,
        isWebcamActive: false,
        isScreenSharing: false,
        isSpeaking: false,
      });
    }

    this.broadcastLocalState();
    void Promise.allSettled([
      this.trackPresence(),
      this.trackRoomMeshPresence(),
    ]);
  }

  private cleanupDirectCallLocalState(): void {
    sounds.stopRingtone();
    this.clearIncomingCallTimer();
    this.waitingForMedia.clear();
    this.pushToTalkHeld = false;
    const state = useHubStore.getState();
    this.micGeneration++;
    this.clearMicRecovery();
    this.joiningVoice = false;
    this.cameraGeneration++;
    this.screenGeneration++;
    this.directRemotePeerId = null;
    this.directRemoteUserId = null;

    if (this.recoveryTimer !== null) {
      clearTimeout(this.recoveryTimer);
      this.recoveryTimer = null;
    }

    useMediaState.setState({
      microphoneBusy: false,
      cameraBusy: false,
      screenBusy: false,
      reconnecting: false,
      recoveryPhase: "idle",
      quality: {},
    });

    soundboardEngine.stopAll();
    this.audioPipeline?.destroy();
    this.audioPipeline = null;
    this.rawMicStream?.getTracks().forEach((t) => t.stop());
    this.rawMicStream = null;

    state.setLocalVoiceStream(null);
    state.setIsLocalSpeaking(false, 0);
    state.setOutgoingCall(null);
    state.setActiveCallId(null);

    if (state.isScreenSharing) {
      this.stopScreenShare();
    }
    if (state.isWebcamActive && this.localWebcamStream) {
      this.localWebcamStream.getTracks().forEach((t) => t.stop());
      this.localWebcamStream = null;
      state.setLocalWebcamStream(null);
      state.setWebcamActive(false);
    }

    const wasInVoice = state.inVoiceCall;
    state.setInVoiceCall(false);
    state.setRemoteVoiceStream(null);
    state.setRemoteScreenStream(null);
    if (wasInVoice) sounds.playLeave();

    for (const session of this.sessions.values()) {
      this.closeBlockedMedia(session);
      try {
        session.dataConn.close();
      } catch {
        /* ignore */
      }
      this.teardownPeerVoiceAudio(session);
    }
    this.sessions.clear();
    this.stopHeartbeat();
    this.stopReceiverStats();

    if (this.localPeer) {
      try {
        this.localPeer.destroy();
      } catch {
        /* ignore */
      }
      this.localPeer = null;
    }

    useHubStore.getState().setParticipants({});
    void this.trackPresence();
  }

  /* ========================================================================= */
  /* RECONEXÃO SILENCIOSA 1:1                                                  */
  /* ========================================================================= */

  private scheduleSilentDirectReconnect(): void {
    const state = useHubStore.getState();
    const isRoom = state.activeContext?.type === "room";
    if (
      (!state.inVoiceCall && !isRoom) ||
      !state.authUserId ||
      (!isRoom && !this.directRemotePeerId) ||
      this.recoveryCancelled ||
      this.recoveryTimer !== null
    ) {
      return;
    }

    const attempt = ++this.recoveryAttempts;
    if (attempt > 6) {
      return;
    }

    const delayMs = Math.round(Math.min(10000, 1000 * 2 ** (attempt - 1)));
    const userId = state.authUserId;
    const callId = state.activeCallId;

    this.recoveryTimer = window.setTimeout(async () => {
      this.recoveryTimer = null;
      const current = useHubStore.getState();
      const currentlyInRoom = current.activeContext?.type === "room";
      if ((!current.inVoiceCall && !currentlyInRoom) || this.recoveryCancelled)
        return;
      if (!navigator.onLine) {
        this.scheduleSilentDirectReconnect();
        return;
      }

      try {
        if (currentlyInRoom && this.activeRoomMeta) {
          await this.ensureLocalPeer(userId);
          this.recoveryAttempts = 0;
          await this.trackRoomMeshPresence();
          this.syncRoomMeshState(this.activeRoomMeta.slug);
          return;
        }

        // Verifica se a chamada 1:1 ainda está ativa no banco
        let isCaller = false;
        if (callId) {
          const { data: latestCall } = await supabase
            .from("signaling_calls")
            .select("status, caller_id, receiver_id, caller_peer_id, receiver_peer_id")
            .eq("id", callId)
            .maybeSingle();

          if (!latestCall || latestCall.status !== "accepted") {
            this.cleanupDirectCallLocalState();
            return;
          }

          isCaller = latestCall.caller_id === userId;
          const latestRemotePeer = isCaller
            ? latestCall.receiver_peer_id
            : latestCall.caller_peer_id;
          if (latestRemotePeer) {
            this.directRemotePeerId = latestRemotePeer;
          }
        }

        const peerId = await this.ensureLocalPeer(userId);
        // Atualiza o peer_id no banco para que o amigo possa nos alcançar também
        if (callId) {
          const nowIso = new Date().toISOString();
          await supabase
            .from("signaling_calls")
            .update(
              isCaller
                ? { caller_peer_id: peerId, updated_at: nowIso }
                : { receiver_peer_id: peerId, updated_at: nowIso },
            )
            .eq("id", callId);
        }

        if (this.directRemotePeerId && this.localPeer?.open) {
          this.recoveryAttempts = 0;
          this.connectToPeer(
            this.directRemotePeerId,
            this.directRemoteUserId || undefined,
          );
        }
      } catch {
        this.scheduleSilentDirectReconnect();
      }
    }, delayMs);
  }

  public retryConnection(): void {
    this.recoveryCancelled = false;
    this.recoveryAttempts = 0;
    if (this.recoveryTimer !== null) {
      clearTimeout(this.recoveryTimer);
      this.recoveryTimer = null;
    }
    useMediaState.setState({ error: null });
    if (useHubStore.getState().inVoiceCall) {
      this.scheduleSilentDirectReconnect();
    } else if (this.cloudSessionUserId) {
      void this.refreshFriends();
    }
  }

  public notifyNetwork(online: boolean): void {
    callEvent(online ? "network_online" : "network_offline");
    if (!online) {
      this.handleNetworkOffline();
    } else {
      void this.handleNetworkOnline();
    }
  }

  private handleNetworkOffline(): void {
    if (this.isNetworkOffline) return;
    this.isNetworkOffline = true;
    const state = useHubStore.getState();
    if (!this.wasInCallContext && (state.activeContext || state.inVoiceCall)) {
      this.wasInCallContext = {
        context: state.activeContext,
        inVoiceCall: state.inVoiceCall,
        withVideo: state.isWebcamActive,
      };
    }
    this.cancelRecovery();
    if (state.inVoiceCall) {
      this.leaveVoiceCall("manual_leave");
    }
  }

  private async handleNetworkOnline(): Promise<void> {
    if (!this.isNetworkOffline) {
      if (useHubStore.getState().inVoiceCall && !this.recoveryCancelled) {
        this.retryConnection();
      }
      return;
    }

    this.isNetworkOffline = false;
    const saved = this.wasInCallContext;
    this.wasInCallContext = null;

    try {
      const { data } = await supabase.auth.getSession();
      const user = data?.session?.user;
      if (!user) return;

      this.teardownCloudSubscriptions();
      await this.initializeCloudSession(user.id);

      if (saved?.context?.type === "room") {
        await this.createOrJoinRoom(saved.context.slug, saved.inVoiceCall);
        if (
          saved.inVoiceCall &&
          saved.withVideo &&
          !useHubStore.getState().isWebcamActive
        ) {
          await this.toggleWebcam().catch(() => {});
        }
      } else if (saved?.context?.type === "dm") {
        const dmFriend = saved.context.friend;
        const storeFriend =
          useHubStore
            .getState()
            .friends.find((f) => f.id === dmFriend.id) ?? dmFriend;
        await this.openDirectMessage(storeFriend);
        if (saved.inVoiceCall) {
          await this.startDirectCall(storeFriend, saved.withVideo);
        }
      }
    } catch (err) {
      console.warn("[Network] Falha ao reconectar sessão:", err);
    }
  }

  public cancelRecovery(): void {
    this.recoveryCancelled = true;
    this.recoveryActive = false;
    this.waitingForMedia.clear();
    this.stopHeartbeat();
    useMediaState.setState({
      recoveryPhase: "idle",
      recoveryMissingMedia: 0,
      reconnecting: false,
      error: null,
    });
    if (this.recoveryTimer !== null) clearTimeout(this.recoveryTimer);
    this.recoveryTimer = null;
    for (const session of this.sessions.values()) {
      if (session.voiceRetryTimer) clearTimeout(session.voiceRetryTimer);
      session.voiceRetryTimer = undefined;
    }
  }

  private scheduleRecovery(): void {
    if (useHubStore.getState().inVoiceCall) {
      this.scheduleSilentDirectReconnect();
    }
  }

  private refreshRecoveryState(): boolean {
    const hasOpenData = [...this.sessions.values()].some((s) => s.dataConn.open);
    if (hasOpenData && !this.recoveryCancelled) {
      this.startHeartbeat();
    } else {
      this.stopHeartbeat();
    }
    return true;
  }

  private scheduleVoiceRetry(session: PeerMediaSession): void {
    if (
      this.recoveryCancelled ||
      session.voiceRetryTimer ||
      this.sessions.get(session.peerId) !== session ||
      !this.canCallSession(session)
    )
      return;
    const attempt = (session.voiceRetryAttempts || 0) + 1;
    if (attempt > 6) {
      session.voiceRetryAttempts = 7;
      callEvent(
        "retry_exhausted",
        { attempt: 6, reason: "retry_limit" },
        session.peerId,
      );
      return;
    }
    session.voiceRetryAttempts = attempt;
    const base = (this.localPeer?.id || "") < session.peerId ? 500 : 1200;
    const delayMs = Math.round(
      Math.min(10000, base * 2 ** (attempt - 1)) * (0.8 + Math.random() * 0.4),
    );
    callEvent("retry_scheduled", { attempt, delayMs }, session.peerId);
    const generation = this.roomGeneration;
    session.voiceRetryTimer = window.setTimeout(() => {
      session.voiceRetryTimer = undefined;
      if (
        generation === this.roomGeneration &&
        !this.recoveryCancelled &&
        this.sessions.get(session.peerId) === session &&
        !session.voiceCall &&
        this.canCallSession(session)
      )
        this.initiateVoiceCallWithPeer(session);
    }, delayMs);
  }

  private startHeartbeat(): void {
    if (this.heartbeatInterval !== null || this.recoveryCancelled) return;
    this.heartbeatInterval = window.setInterval(() => {
      this.sendHeartbeat();
    }, 10_000);
    this.sendHeartbeat();
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval !== null) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private sendHeartbeat(): void {
    const now = Date.now();
    for (const session of this.sessions.values()) {
      if (!session.dataConn.open) continue;
      try {
        session.dataConn.send({ type: "ping", at: now } as SignalingPacket);
      } catch {
        /* ignore */
      }
    }
  }

  /* ========================================================================= */
  /* GESTÃO DE SESSÕES P2P DIRETAS (DATACONNECTION & MEDIACONNECTION)          */
  /* ========================================================================= */

  private setupLocalPeerListeners(): void {
    if (!this.localPeer) return;

    this.localPeer.on("connection", (conn) => {
      this.handleIncomingDataConnection(conn);
    });

    this.localPeer.on("call", (call) => {
      this.handleIncomingMediaCall(call);
    });
  }

  private connectToPeer(
    remotePeerId: string,
    clientId?: string,
    nickname?: string,
  ): void {
    if (
      !this.localPeer ||
      this.localPeer.destroyed ||
      remotePeerId === this.localPeer.id
    )
      return;
    const existing = this.sessions.get(remotePeerId);
    if (existing && (existing.dataConn.open || existing.dataConnecting)) return;

    const conn = this.localPeer.connect(remotePeerId, {
      reliable: true,
      metadata: { initiator: this.localPeer.id },
    });
    this.setupDataConnection(conn, clientId, nickname);
  }

  private handleIncomingDataConnection(conn: DataConnection): void {
    if (this.sessions.has(conn.peer)) {
      const existing = this.sessions.get(conn.peer);
      if (
        existing &&
        (existing.dataConn.open ||
          (existing.dataConnecting && (this.localPeer?.id || "") < conn.peer))
      ) {
        conn.close();
        return;
      }
    }
    this.setupDataConnection(conn);
  }

  private setupDataConnection(
    conn: DataConnection,
    initialClientId?: string,
    initialNickname?: string,
  ): void {
    const remotePeerId = conn.peer;

    const previous = this.sessions.get(remotePeerId);
    const knownParticipant = useHubStore.getState().participants[remotePeerId];
    const session: PeerMediaSession = previous || {
      peerId: remotePeerId,
      clientId:
        initialClientId ||
        knownParticipant?.clientId ||
        this.directRemoteUserId ||
        "",
      nickname:
        initialNickname ||
        knownParticipant?.nickname ||
        useHubStore.getState().activeFriend?.nickname ||
        "Participante",
      dataConn: conn,
      voiceCall: null,
      webcamCall: null,
      screenCall: null,
      voiceAudioCtx: null,
      voiceSourceNode: null,
      voiceGainNode: null,
      voiceDestNode: null,
      voiceAudioEl: null,
      remoteSpeakingInterval: null,
    };

    const replaced = previous?.dataConn;
    if (session.dataGraceTimer) clearTimeout(session.dataGraceTimer);
    session.dataGraceTimer = undefined;
    if (session.dataConnectTimer) clearTimeout(session.dataConnectTimer);
    session.dataConn = conn;
    session.dataConnecting = !conn.open;

    if (initialClientId) {
      for (const [pid, other] of this.sessions.entries()) {
        if (pid === remotePeerId) continue;
        if (other.clientId === initialClientId) {
          this.finalizePeerDisconnected(other);
        }
      }
    }

    this.sessions.set(remotePeerId, session);
    if (replaced && replaced !== conn) {
      callEvent("data_replaced", {}, remotePeerId);
      try {
        replaced.close();
      } catch {}
    }

    const generation = this.roomGeneration;
    session.dataConnectTimer = window.setTimeout(() => {
      if (
        generation === this.roomGeneration &&
        session.dataConn === conn &&
        !conn.open
      ) {
        session.dataConnecting = false;
        try {
          conn.close();
        } catch {}
        this.handlePeerDisconnected(session);
      }
    }, 10000);

    conn.on("open", () => {
      if (
        this.sessions.get(remotePeerId) !== session ||
        session.dataConn !== conn
      )
        return;
      session.dataConnecting = false;
      if (session.dataConnectTimer) clearTimeout(session.dataConnectTimer);
      session.dataConnectTimer = undefined;
      callEvent("data_open", {}, remotePeerId);
      this.refreshRecoveryState();
      const state = useHubStore.getState();
      const localParticipant = state.participants[this.localPeer?.id || ""];

      if (localParticipant) {
        const { isLocal, profile: _profile, ...myState } = localParticipant;
        conn.send({
          type: "peer_state_sync",
          state: {
            ...myState,
            inVoiceCall: state.inVoiceCall,
            isMuted: state.isMuted,
            isDeafened: state.isDeafened,
            isWebcamActive: state.isWebcamActive,
            isScreenSharing: state.isScreenSharing,
          },
        } as SignalingPacket);
      }

      this.sendProfileToSession(session);
    });

    conn.on("data", (data) => {
      if (
        this.sessions.get(remotePeerId) !== session ||
        session.dataConn !== conn
      )
        return;
      this.handleIncomingSignalingPacket(session, data as SignalingPacket);
    });

    conn.on("close", () => {
      if (session.dataConn !== conn) return;
      session.dataConnecting = false;
      this.handlePeerDisconnected(session);
    });

    conn.on("error", (err) => {
      console.warn(
        `[WebRTC Engine] Erro no dataConn com ${remotePeerId}:`,
        err,
      );
    });
  }

  private handlePeerDisconnected(session: PeerMediaSession): void {
    if (this.sessions.get(session.peerId) !== session) return;
    session.dataConnecting = false;
    const pc = session.voiceCall?.peerConnection;
    callEvent(
      "data_closed",
      {
        connection: pc?.connectionState,
        reason:
          pc?.connectionState === "connected"
            ? "preserve_media"
            : "remote_or_unknown",
      },
      session.peerId,
    );
    if (
      useHubStore.getState().inVoiceCall &&
      session.voiceCall &&
      pc?.connectionState !== "failed" &&
      pc?.connectionState !== "closed"
    ) {
      this.scheduleSilentDirectReconnect();
      return;
    }
    this.finalizePeerDisconnected(session);
  }

  private finalizePeerDisconnected(session: PeerMediaSession): void {
    if (this.sessions.get(session.peerId) !== session) return;
    this.sessions.delete(session.peerId);
    if (session.dataConnectTimer) clearTimeout(session.dataConnectTimer);
    session.dataConnectTimer = undefined;
    this.closeBlockedMedia(session);
    this.waitingForMedia.delete(session.clientId);
    this.teardownPeerVoiceAudio(session);

    for (const call of [
      session.voiceCall,
      session.webcamCall,
      session.screenCall,
    ]) {
      try {
        call?.close();
      } catch {
        /* ignore */
      }
    }

    const state = useHubStore.getState();
    if (state.activeContext?.type !== "room") {
      state.removeParticipant(session.peerId);
      if (state.inVoiceCall) {
        this.scheduleSilentDirectReconnect();
      }
    }
    state.removeRemoteStreams(session.peerId);
  }

  private handleIncomingSignalingPacket(
    session: PeerMediaSession,
    packet: SignalingPacket,
  ): void {
    if (!packet || !packet.type) return;
    if (packet.type !== "peer_state_sync" && isBlocked(session.clientId))
      return;

    switch (packet.type) {
      case "profile_update": {
        if (
          !session.clientId ||
          !useHubStore.getState().participants[session.peerId]
        )
          return;
        try {
          const profile =
            packet.profile === null
              ? null
              : validatePublicProfile(packet.profile);
          useHubStore.getState().updateParticipant(session.peerId, { profile });
        } catch {
          /* ignore */
        }
        break;
      }
      case "ping": {
        try {
          session.dataConn.send({ type: "pong", at: packet.at } as SignalingPacket);
        } catch {
          /* ignore */
        }
        break;
      }
      case "pong":
        break;

      case "chat_message": {
        const msg = packet.message;
        if (!msg?.id || !msg?.roomId) break;
        const currentCtx = useHubStore.getState().activeContext;
        if (
          currentCtx?.type === "room" &&
          msg.roomId === currentCtx.roomId &&
          msg.authorClientId !== useHubStore.getState().authUserId
        ) {
          useHubStore.getState().addMessage({
            ...msg,
            delivery: "received",
          });
        }
        break;
      }

      case "peer_state_sync": {
        const remote = peerState(
          packet.state,
          session.peerId,
          session.clientId,
        );
        if (!remote) return;
        session.clientId = remote.clientId;
        session.nickname = remote.nickname;

        for (const [pid, other] of this.sessions.entries()) {
          if (pid === session.peerId) continue;
          if (other.clientId === remote.clientId) {
            this.finalizePeerDisconnected(other);
          }
        }

        // Remove qualquer entrada duplicada ou placeholder presence: com o mesmo userId
        const currentParticipants = { ...useHubStore.getState().participants };
        const prevParticipant =
          currentParticipants[session.peerId] ??
          Object.values(currentParticipants).find(
            (p) => p.clientId === remote.clientId,
          );
        for (const [key, p] of Object.entries(currentParticipants)) {
          if (key !== session.peerId && p.clientId === remote.clientId) {
            delete currentParticipants[key];
          }
        }
        currentParticipants[session.peerId] = { ...remote, isLocal: false };
        useHubStore.getState().setParticipants(currentParticipants);

        const preState = useHubStore.getState();
        if (preState.activeContext?.type === "room" && preState.inVoiceCall) {
          if (!prevParticipant?.inVoiceCall && remote.inVoiceCall) {
            sounds.playJoin();
          } else if (prevParticipant?.inVoiceCall && !remote.inVoiceCall) {
            sounds.playLeave();
          }
        }

        if (isBlocked(remote.clientId)) {
          this.closeBlockedMedia(session);
          return;
        }
        this.sendProfileToSession(session);
        useHubStore.getState().setRemoteNickname(remote.nickname);

        const localState = useHubStore.getState();
        if (
          localState.inVoiceCall &&
          remote.inVoiceCall &&
          !session.voiceCall
        ) {
          const delayMs =
            (this.localPeer?.id || "") < session.peerId ? 150 : 750;
          window.setTimeout(() => {
            const currentSession = this.sessions.get(session.peerId);
            const stillInVoice = useHubStore.getState().inVoiceCall;
            if (
              stillInVoice &&
              currentSession === session &&
              !currentSession.voiceCall
            ) {
              this.initiateVoiceCallWithPeer(currentSession);
            }
          }, delayMs);
        }

        if (!remote.inVoiceCall) {
          this.waitingForMedia.delete(remote.clientId);
          this.closeBlockedMedia(session);
        }
        if (
          localState.inVoiceCall &&
          remote.inVoiceCall &&
          this.localWebcamStream &&
          !session.outgoingWebcam
        ) {
          this.initiateWebcamCallWithPeer(session);
        }
        if (
          localState.isScreenSharing &&
          this.localScreenStream &&
          remote.inVoiceCall &&
          !session.outgoingScreen
        ) {
          this.initiateScreenCallWithPeer(session);
        }
        break;
      }

      case "speaking": {
        if (
          packet.peerId !== session.peerId ||
          typeof packet.isSpeaking !== "boolean"
        )
          return;
        useHubStore
          .getState()
          .updateParticipant(packet.peerId, { isSpeaking: packet.isSpeaking });
        useHubStore.getState().setIsRemoteSpeaking(packet.isSpeaking);
        break;
      }

      case "screen_stopped": {
        if (packet.peerId !== session.peerId) return;
        useHubStore.getState().updateParticipant(packet.peerId, {
          isScreenSharing: false,
          screenQualityLabel: undefined,
        });
        useHubStore.getState().setRemoteStream(packet.peerId, "screen", null);
        useHubStore.getState().setRemoteScreenStream(null);
        if (useHubStore.getState().telemetry.sourcePeerId === session.peerId)
          useHubStore.getState().setTelemetry({ active: false });
        this.stopReceiverStats(session.peerId);
        sounds.playStreamStop();
        break;
      }

      case "soundboard_triggered": {
        if (
          packet.peerId !== session.peerId ||
          packet.clientId !== session.clientId ||
          typeof packet.emoji !== "string" ||
          packet.emoji.length > 24 ||
          typeof packet.soundName !== "string" ||
          packet.soundName.length > 80
        )
          return;
        soundActivity(
          useHubStore.getState().activeChannelId || "dm",
          session.clientId,
          session.nickname,
          packet.emoji,
          packet.soundName,
        );
        useHubStore.getState().updateParticipant(packet.peerId, {
          activeSoundEffect: {
            emoji: packet.emoji,
            name: packet.soundName,
            expiresAt: Date.now() + 3500,
          },
        });
        window.setTimeout(() => {
          const current = useHubStore.getState().participants[packet.peerId];
          if (current?.activeSoundEffect?.name === packet.soundName) {
            useHubStore
              .getState()
              .updateParticipant(packet.peerId, { activeSoundEffect: null });
          }
        }, 3600);
        break;
      }
    }
  }

  /* ========================================================================= */
  /* CHAMADAS DE MÍDIA ENTRANTES & SAÍDAS (1:1 DIRETO)                         */
  /* ========================================================================= */

  private markPeerVoiceConnected(session: PeerMediaSession): void {
    const store = useHubStore.getState();
    const nextParticipants = { ...store.participants };
    let prev = nextParticipants[session.peerId];

    if (session.clientId) {
      for (const [key, p] of Object.entries(nextParticipants)) {
        if (
          key !== session.peerId &&
          (p.clientId === session.clientId ||
            key === `presence:${session.clientId}` ||
            key === `calling:${session.clientId}`)
        ) {
          if (!prev) prev = p;
          delete nextParticipants[key];
        }
      }
    }

    nextParticipants[session.peerId] = {
      profile: prev?.profile ?? null,
      peerId: session.peerId,
      clientId: session.clientId || prev?.clientId || "",
      nickname: prev?.nickname || session.nickname || "Participante",
      avatarColor: prev?.avatarColor || "#6eddbd",
      isLocal: false,
      inVoiceCall: true,
      isMuted: prev?.isMuted ?? false,
      isDeafened: prev?.isDeafened ?? false,
      isSpeaking: prev?.isSpeaking ?? false,
      isWebcamActive: prev?.isWebcamActive ?? false,
      isScreenSharing: prev?.isScreenSharing ?? false,
      screenQualityLabel: prev?.screenQualityLabel,
      rttMs: prev?.rttMs,
      activeSoundEffect: prev?.activeSoundEffect ?? null,
    };
    store.setParticipants(nextParticipants);

    useMediaState.setState((s) => {
      const existing = s.quality[session.peerId];
      return {
        quality: {
          ...s.quality,
          [session.peerId]: {
            state: "connected",
            rttMs: existing?.rttMs ?? null,
            loss: existing?.loss ?? null,
            jitterMs: existing?.jitterMs ?? null,
            flowing: true,
          },
        },
      };
    });
  }

  private handleIncomingMediaCall(call: MediaConnection): void {
    const channel = call.metadata?.channel || "voice";
    const remotePeerId = call.peer;
    let session = this.sessions.get(remotePeerId);
    const ownState = useHubStore.getState();

    if (!session && ownState.inVoiceCall && this.localPeer) {
      const roomParticipant =
        ownState.activeContext?.type === "room"
          ? ownState.participants[remotePeerId]
          : undefined;
      if (remotePeerId === this.directRemotePeerId) {
        this.connectToPeer(remotePeerId, this.directRemoteUserId || undefined);
        session = this.sessions.get(remotePeerId);
      } else if (roomParticipant) {
        this.connectToPeer(
          remotePeerId,
          roomParticipant.clientId,
          roomParticipant.nickname,
        );
        session = this.sessions.get(remotePeerId);
      }
    }

    if (
      !session ||
      !ownState.inVoiceCall ||
      !["voice", "screen", "webcam"].includes(channel) ||
      isBlocked(session.clientId)
    ) {
      call.close();
      return;
    }

    if (channel === "voice") {
      if (session.voiceCall) {
        if ((this.localPeer?.id || "") < session.peerId) {
          call.close();
          return;
        }
        session.voiceCall.close();
      }
      const localVoiceStream =
        this.audioPipeline?.getProcessedStream() || this.rawMicStream;
      call.answer(localVoiceStream || undefined);
      session.voiceCall = call;
      this.markPeerVoiceConnected(session);

      this.patchCallSdp(call, false);
      this.monitorVoiceCall(session, call);

      call.on("stream", (stream) => {
        if (session!.voiceCall !== call) return;
        this.markPeerVoiceConnected(session!);
        this.setupPeerVoiceAudio(session!, stream);
        useHubStore.getState().setRemoteStream(remotePeerId, "voice", stream);
        useHubStore.getState().setRemoteVoiceStream(stream);
      });

      call.on("close", () => {
        if (session!.voiceCall !== call) return;
        this.teardownPeerVoiceAudio(session!);
        session!.voiceCall = null;
        useHubStore.getState().setRemoteStream(remotePeerId, "voice", null);
      });
    } else if (channel === "screen") {
      session.screenCall?.close();
      call.answer();
      session.screenCall = call;

      this.patchCallSdp(call, true);

      call.on("stream", (stream) => {
        if (session!.screenCall !== call) return;
        sounds.playStreamStart();
        useHubStore.getState().setRemoteStream(remotePeerId, "screen", stream);
        useHubStore.getState().setRemoteScreenStream(stream);
        useHubStore
          .getState()
          .updateParticipant(remotePeerId, { isScreenSharing: true });
        this.startReceiverStats(call.peerConnection, stream, remotePeerId);
      });

      call.on("close", () => {
        if (session!.screenCall !== call) return;
        session!.screenCall = null;
        useHubStore.getState().setRemoteStream(remotePeerId, "screen", null);
        useHubStore.getState().setRemoteScreenStream(null);
        useHubStore
          .getState()
          .updateParticipant(remotePeerId, { isScreenSharing: false });
        if (useHubStore.getState().telemetry.sourcePeerId === session!.peerId)
          useHubStore.getState().setTelemetry({ active: false });
        this.stopReceiverStats(session!.peerId);
        sounds.playStreamStop();
      });
    } else if (channel === "webcam") {
      session.webcamCall?.close();
      call.answer();
      session.webcamCall = call;

      call.on("stream", (stream) => {
        if (session!.webcamCall !== call) return;
        useHubStore.getState().setRemoteStream(remotePeerId, "webcam", stream);
        useHubStore
          .getState()
          .updateParticipant(remotePeerId, { isWebcamActive: true });
      });

      call.on("close", () => {
        if (session!.webcamCall !== call) return;
        session!.webcamCall = null;
        useHubStore.getState().setRemoteStream(remotePeerId, "webcam", null);
        useHubStore
          .getState()
          .updateParticipant(remotePeerId, { isWebcamActive: false });
      });
    }
  }

  private initiateVoiceCallWithPeer(session: PeerMediaSession): void {
    if (
      !this.localPeer ||
      this.localPeer.destroyed ||
      session.voiceCall ||
      (session.voiceRetryAttempts || 0) > 6 ||
      !this.canCallSession(session)
    )
      return;

    const voiceStream =
      this.audioPipeline?.getProcessedStream() || this.rawMicStream;
    if (!voiceStream) return;

    let call: MediaConnection;
    try {
      call = this.localPeer.call(session.peerId, voiceStream, {
        metadata: { channel: "voice" },
      });
      if (!call) {
        this.scheduleVoiceRetry(session);
        return;
      }
    } catch {
      callEvent("signaling_error", { reason: "unknown" }, session.peerId);
      this.scheduleVoiceRetry(session);
      return;
    }

    session.voiceCall = call;
    this.patchCallSdp(call, false);
    this.monitorVoiceCall(session, call);

    call.on("stream", (stream) => {
      if (session.voiceCall !== call) return;
      this.markPeerVoiceConnected(session);
      this.setupPeerVoiceAudio(session, stream);
      useHubStore.getState().setRemoteStream(session.peerId, "voice", stream);
      useHubStore.getState().setRemoteVoiceStream(stream);
    });

    call.on("close", () => {
      if (session.voiceCall !== call) return;
      this.teardownPeerVoiceAudio(session);
      session.voiceCall = null;
      useHubStore.getState().setRemoteStream(session.peerId, "voice", null);
    });
  }

  private monitorVoiceCall(
    session: PeerMediaSession,
    call: MediaConnection,
  ): void {
    if (session.qualityTimer) clearInterval(session.qualityTimer);
    if (session.voiceRetryTimer) clearTimeout(session.voiceRetryTimer);
    session.voiceRetryTimer = undefined;
    session.mediaFlowVerified = false;
    session.recoveryRxBase = 0;
    session.recoveryTxBase = 0;
    session.recoveryMediaAt = undefined;
    const connectingAt = Date.now();
    let lastState = "",
      lastTick = Date.now();
    let previousReceived = 0,
      previousLost = 0,
      busy = false,
      disconnectedAt = 0;

    session.qualityTimer = window.setInterval(async () => {
      if (
        this.sessions.get(session.peerId) !== session ||
        session.voiceCall !== call
      )
        return;
      const pc = call.peerConnection;
      if (!pc) return;
      const tick = Date.now();
      if (tick - lastTick > 15000)
        callEvent("timer_gap", { delayMs: tick - lastTick }, session.peerId);
      lastTick = tick;
      const signature = [
        pc.connectionState,
        pc.iceConnectionState,
        pc.signalingState,
      ].join(":");
      if (signature !== lastState) {
        lastState = signature;
        callEvent(
          "media_state",
          {
            connection: pc.connectionState,
            ice: pc.iceConnectionState,
            signaling: pc.signalingState,
          },
          session.peerId,
        );
      }
      const effectiveState: RTCPeerConnectionState =
        pc.connectionState === "connected" ||
        pc.iceConnectionState === "connected" ||
        pc.iceConnectionState === "completed"
          ? "connected"
          : pc.connectionState;
      if (effectiveState !== "connected") session.mediaFlowVerified = false;
      const previousQuality = useMediaState.getState().quality[session.peerId];
      if (previousQuality && previousQuality.state !== effectiveState)
        useMediaState.setState((s) => ({
          quality: {
            ...s.quality,
            [session.peerId]: {
              ...previousQuality,
              state: effectiveState,
              flowing: false,
            },
          },
        }));
      if (effectiveState === "connected" && session.mediaFlowVerified)
        session.voiceRetryAttempts = 0;
      if (effectiveState === "disconnected") disconnectedAt ||= Date.now();
      else disconnectedAt = 0;
      if (
        effectiveState === "failed" ||
        (disconnectedAt && Date.now() - disconnectedAt > 8000) ||
        (["new", "connecting"].includes(effectiveState) &&
          Date.now() - connectingAt > 30000)
      ) {
        callEvent(
          "media_closed",
          {
            reason:
              effectiveState === "failed"
                ? "media_failed"
                : "media_timeout",
          },
          session.peerId,
        );
        call.close();
        this.broadcastLocalState();
        return;
      }
      if (busy) return;
      busy = true;
      try {
        const epoch = this.recoveryEpoch;
        const stats = await pc.getStats();
        if (session.voiceCall !== call || epoch !== this.recoveryEpoch) return;
        let rttMs: number | null = null,
          loss: number | null = null,
          jitterMs: number | null = null;
        let receivedAudio = 0,
          sentAudio = 0;
        stats.forEach((report) => {
          if (
            report.type === "candidate-pair" &&
            report.state === "succeeded" &&
            report.nominated &&
            Number.isFinite(report.currentRoundTripTime)
          )
            rttMs = Math.round(report.currentRoundTripTime * 1000);
          if (
            report.type === "inbound-rtp" &&
            (report.kind === "audio" || report.mediaType === "audio")
          ) {
            if (Number.isFinite(report.jitter))
              jitterMs = Math.round(report.jitter * 10000) / 10;
            receivedAudio = Number.isFinite(report.packetsReceived)
              ? report.packetsReceived
              : 0;
            const received = report.packetsReceived || 0,
              lost = report.packetsLost || 0;
            const delta = Math.max(0, received - previousReceived),
              missed = Math.max(0, lost - previousLost);
            loss =
              delta + missed
                ? Math.round((1000 * missed) / (delta + missed)) / 10
                : null;
            previousReceived = received;
            previousLost = lost;
          }
          if (
            report.type === "outbound-rtp" &&
            (report.kind === "audio" || report.mediaType === "audio") &&
            report.bytesSent > 0
          )
            sentAudio = report.bytesSent;
        });
        if (
          receivedAudio > 0 &&
          sentAudio > 0 &&
          !!session.voiceAudioEl?.srcObject &&
          effectiveState === "connected"
        ) {
          session.mediaFlowVerified = true;
        }
        const flowing =
          effectiveState === "connected" &&
          session.mediaFlowVerified === true;
        useMediaState.setState((s) => ({
          quality: {
            ...s.quality,
            [session.peerId]: {
              state: effectiveState,
              rttMs,
              loss,
              jitterMs,
              flowing,
            },
          },
        }));
      } catch {
        /* ignore */
      } finally {
        busy = false;
      }
    }, 2000);

    call.on("close", () => {
      if (session.voiceCall && session.voiceCall !== call) return;
      if (session.qualityTimer) clearInterval(session.qualityTimer);
      session.qualityTimer = undefined;
      useMediaState.setState((s) => {
        const quality = { ...s.quality };
        if (this.canCallSession(session))
          quality[session.peerId] = {
            state: "closed",
            rttMs: null,
            loss: null,
            jitterMs: null,
            flowing: false,
          };
        else delete quality[session.peerId];
        return { quality };
      });
      callEvent(
        "media_closed",
        {
          connection: call.peerConnection?.connectionState,
          reason: "remote_or_unknown",
        },
        session.peerId,
      );
      this.scheduleVoiceRetry(session);
    });
  }

  private initiateWebcamCallWithPeer(session: PeerMediaSession): void {
    if (
      !this.localPeer ||
      !this.localWebcamStream ||
      session.outgoingWebcam ||
      !this.canCallSession(session)
    )
      return;
    const call = this.localPeer.call(session.peerId, this.localWebcamStream, {
      metadata: { channel: "webcam" },
    });
    session.outgoingWebcam = call;
    call.on("close", () => {
      if (session.outgoingWebcam === call) session.outgoingWebcam = null;
    });
  }

  private initiateScreenCallWithPeer(session: PeerMediaSession): void {
    if (
      !this.localPeer ||
      !this.localScreenStream ||
      session.outgoingScreen ||
      !this.canCallSession(session)
    )
      return;

    const call = this.localPeer.call(session.peerId, this.localScreenStream, {
      metadata: { channel: "screen" },
    });

    session.outgoingScreen = call;
    call.on("close", () => {
      if (session.outgoingScreen === call) session.outgoingScreen = null;
    });
    this.patchCallSdp(call, true);

    const senders = call.peerConnection.getSenders();
    const videoSender = senders.find(
      (s) => s.track && s.track.kind === "video",
    );
    if (videoSender) {
      configureVideoSender(
        videoSender,
        useHubStore.getState().videoQualityConfig.maxBitrateBps,
      );
      this.startAbrLoop(
        call.peerConnection,
        videoSender,
        useHubStore.getState().videoQualityConfig,
        session.peerId,
      );
    }
  }

  /* ========================================================================= */
  /* ÁUDIO INDIVIDUAL E SINK ID (useMediaOutput / setSinkId)                   */
  /* ========================================================================= */

  private setupPeerVoiceAudio(
    session: PeerMediaSession,
    stream: MediaStream,
  ): void {
    this.teardownPeerVoiceAudio(session);

    try {
      const pc = session.voiceCall?.peerConnection;
      if (pc && typeof pc.getReceivers === "function") {
        pc.getReceivers().forEach((receiver) => {
          if (
            receiver.track?.kind === "audio" &&
            "playoutDelayHint" in receiver
          ) {
            (
              receiver as unknown as { playoutDelayHint: number }
            ).playoutDelayHint = 0.01;
          }
        });
      }

      let audioEl = document.getElementById(
        `audio-peer-${session.peerId}`,
      ) as HTMLAudioElement | null;
      if (!audioEl) {
        audioEl = document.createElement("audio");
        audioEl.id = `audio-peer-${session.peerId}`;
        audioEl.style.display = "none";
        document.body.appendChild(audioEl);
      }

      const state = useHubStore.getState();
      const peerVol = state.peerVolumes[session.clientId] ?? 1.0;
      const effVol = state.isDeafened
        ? 0
        : Math.max(
            0,
            Math.min(1.0, peerVol * state.audioConfig.remoteStreamVolume),
          );

      audioEl.autoplay = true;
      audioEl.muted = state.isDeafened;
      audioEl.volume = effVol;
      audioEl.srcObject = stream;

      const outputId = state.audioConfig.outputDeviceId;
      void applySafeSinkId(
        audioEl as unknown as { setSinkId?: (id: string) => Promise<void> },
        outputId,
      ).finally(() => {
        if (audioEl && audioEl.paused && audioEl.srcObject) {
          audioEl.play().catch(() => {});
        }
      });

      audioEl
        .play()
        .catch((e) => console.warn("[WebRTC Audio] Falha ao iniciar play:", e));

      session.voiceAudioEl = audioEl;
      this.startRemoteVoiceDetection(session, stream);
    } catch (err) {
      console.warn(
        `[WebRTC Audio] Falha ao configurar áudio para ${session.peerId}:`,
        err,
      );
    }
  }

  private teardownPeerVoiceAudio(session: PeerMediaSession): void {
    if (session.remoteSpeakingInterval !== null) {
      clearInterval(session.remoteSpeakingInterval);
      session.remoteSpeakingInterval = null;
    }
    if (session.voiceSourceNode) {
      try {
        session.voiceSourceNode.disconnect();
      } catch {
        /* ignore */
      }
      session.voiceSourceNode = null;
    }
    if (session.voiceGainNode) {
      try {
        session.voiceGainNode.disconnect();
      } catch {
        /* ignore */
      }
      session.voiceGainNode = null;
    }
    if (session.voiceAudioEl) {
      session.voiceAudioEl.pause();
      session.voiceAudioEl.srcObject = null;
      session.voiceAudioEl.remove();
      session.voiceAudioEl = null;
    }
    if (session.voiceAudioCtx && session.voiceAudioCtx.state !== "closed") {
      session.voiceAudioCtx.close().catch(() => {});
      session.voiceAudioCtx = null;
    }
  }

  public setPeerVolume(clientId: string, volume: number): void {
    if (!Number.isFinite(volume)) return;
    useHubStore
      .getState()
      .setPeerVolume(clientId, Math.max(0, Math.min(1, volume)));
    const clamped = Math.max(0, Math.min(1.0, volume));
    const state = useHubStore.getState();

    for (const session of this.sessions.values()) {
      if (session.clientId === clientId && session.voiceAudioEl) {
        const effVol = state.isDeafened
          ? 0
          : Math.max(
              0,
              Math.min(1.0, clamped * state.audioConfig.remoteStreamVolume),
            );
        session.voiceAudioEl.volume = effVol;
      }
    }
  }

  private startRemoteVoiceDetection(
    session: PeerMediaSession,
    stream: MediaStream,
  ): void {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new AudioCtx();
      const source = ctx.createMediaStreamSource(stream);
      session.voiceAudioCtx = ctx;
      session.voiceSourceNode = source;
      let lastLoudAt = 0;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const buffer = new Float32Array(analyser.fftSize);
      session.remoteSpeakingInterval = window.setInterval(() => {
        if (!stream.active || stream.getAudioTracks().length === 0) {
          if (session.remoteSpeakingInterval !== null) {
            clearInterval(session.remoteSpeakingInterval);
            session.remoteSpeakingInterval = null;
          }
          ctx.close().catch(() => {});
          return;
        }

        if (ctx.state === "suspended") {
          ctx.resume().catch(() => {});
        }
        if (
          session.voiceAudioEl &&
          session.voiceAudioEl.paused &&
          session.voiceAudioEl.srcObject &&
          useHubStore.getState().inVoiceCall
        ) {
          session.voiceAudioEl.play().catch(() => {});
        }

        analyser.getFloatTimeDomainData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) sum += buffer[i] * buffer[i];
        const rms = Math.sqrt(sum / buffer.length);
        const db = rms > 0.0001 ? 20 * Math.log10(rms) : -100;
        if (db > -42) lastLoudAt = Date.now();
        const isSpeaking = Date.now() - lastLoudAt < 180;
        if (
          useHubStore.getState().participants[session.peerId]?.isSpeaking !==
          isSpeaking
        )
          useHubStore
            .getState()
            .updateParticipant(session.peerId, { isSpeaking });
      }, 50);
    } catch {
      /* ignore */
    }
  }

  private canCallSession(session: PeerMediaSession): boolean {
    const state = useHubStore.getState();
    return state.inVoiceCall && !isBlocked(session.clientId);
  }

  private closeBlockedMedia(session: PeerMediaSession): void {
    if (session.voiceRetryTimer) clearTimeout(session.voiceRetryTimer);
    session.voiceRetryTimer = undefined;
    if (session.dataGraceTimer) clearTimeout(session.dataGraceTimer);
    session.dataGraceTimer = undefined;
    this.teardownPeerVoiceAudio(session);
    for (const call of [
      session.voiceCall,
      session.webcamCall,
      session.screenCall,
      session.outgoingScreen,
      session.outgoingWebcam,
    ]) {
      try {
        call?.close();
      } catch {}
    }
    session.voiceCall = null;
    session.webcamCall = null;
    session.screenCall = null;
    session.outgoingScreen = null;
    session.outgoingWebcam = null;
    if (session.qualityTimer) clearInterval(session.qualityTimer);
    useHubStore.getState().removeRemoteStreams(session.peerId);
  }

  private sendProfileToSession(session: PeerMediaSession): void {
    if (!session.dataConn.open || isBlocked(session.clientId)) return;
    const state = useHubStore.getState();
    session.dataConn.send({
      type: "profile_update",
      profile: publicProfile(readOwnProfile(state.clientId, state.nickname)),
    } as SignalingPacket);
  }

  public refreshLocalProfile(): void {
    const state = useHubStore.getState();
    const profile = readOwnProfile(state.clientId, state.nickname);
    state.setNickname(profile.displayName);
    state.setAvatarColor(profile.appearance.color);
    if (this.localPeer)
      state.updateParticipant(this.localParticipantId(), {
        nickname: profile.displayName,
        avatarColor: profile.appearance.color,
      });
    this.broadcastLocalState();
    for (const session of this.sessions.values()) {
      this.sendProfileToSession(session);
    }
  }

  private broadcastLocalState(): void {
    if (this.activeRoomMeta) {
      void this.trackRoomMeshPresence();
    }
    if (!this.localPeer) return;
    const state = useHubStore.getState();
    const local = state.participants[this.localParticipantId()];
    if (!local) return;

    const { isLocal, profile: _profile, ...rest } = local;
    this.broadcast({
      type: "peer_state_sync",
      state: rest,
    });
  }

  public broadcast(packet: SignalingPacket): void {
    for (const session of this.sessions.values()) {
      if (
        !isBlocked(session.clientId) &&
        session.dataConn &&
        session.dataConn.open
      ) {
        try {
          session.dataConn.send(packet);
        } catch (err) {
          console.warn(
            `[WebRTC Broadcast] Falha ao enviar para ${session.peerId}:`,
            err,
          );
        }
      }
    }
  }

  /* ========================================================================= */
  /* CONTROLES DE MÍDIA LOCAL (MUTE, DEAFEN, WEBCAM, SCREEN SHARE)             */
  /* ========================================================================= */

  private localParticipantId(): string {
    const participants = useHubStore.getState().participants;
    const id = this.localPeer?.id;
    return id && participants[id]?.isLocal
      ? id
      : Object.values(participants).find((p) => p.isLocal)?.peerId || "";
  }
  private pushToTalkHeld = false;
  public setPushToTalkHeld(held: boolean): void {
    this.pushToTalkHeld = held && useHubStore.getState().inVoiceCall;
    this.audioPipeline?.setMicMuted(this.microphoneGated());
  }
  private microphoneGated(): boolean {
    return (
      useHubStore.getState().isMuted ||
      (useVoicePreferences.getState().pushToTalk && !this.pushToTalkHeld)
    );
  }

  public toggleMute(muted?: boolean): void {
    const state = useHubStore.getState();
    const nextMuted = muted !== undefined ? muted : !state.isMuted;
    useHubStore.getState().setMuted(nextMuted);

    this.audioPipeline?.setMicMuted(this.microphoneGated());

    if (nextMuted) {
      sounds.playMute();
    } else {
      sounds.playUnmute();
    }

    if (this.localPeer) {
      useHubStore
        .getState()
        .updateParticipant(this.localParticipantId(), { isMuted: nextMuted });
    }
    this.broadcastLocalState();
  }

  public toggleDeafen(deafened?: boolean): void {
    const state = useHubStore.getState();
    const nextDeafened = deafened !== undefined ? deafened : !state.isDeafened;
    useHubStore.getState().setDeafened(nextDeafened);

    for (const session of this.sessions.values()) {
      if (session.voiceAudioEl) {
        const peerVol = state.peerVolumes[session.clientId] ?? 1.0;
        session.voiceAudioEl.muted = nextDeafened;
        session.voiceAudioEl.volume = nextDeafened
          ? 0
          : Math.max(
              0,
              Math.min(1.0, peerVol * state.audioConfig.remoteStreamVolume),
            );
      }
    }

    if (nextDeafened && !state.isMuted) {
      this.toggleMute(true);
    }

    if (this.localPeer) {
      useHubStore.getState().updateParticipant(this.localParticipantId(), {
        isDeafened: nextDeafened,
      });
    }
    this.broadcastLocalState();
  }

  public async toggleWebcam(): Promise<void> {
    if (useMediaState.getState().cameraBusy) return;
    const generation = ++this.cameraGeneration;
    useMediaState.setState({ error: null });
    const currentState = useHubStore.getState().isWebcamActive;

    if (currentState) {
      if (this.localWebcamStream) {
        this.localWebcamStream.getTracks().forEach((track) => track.stop());
        this.localWebcamStream = null;
      }
      useHubStore.getState().setLocalWebcamStream(null);
      useHubStore.getState().setWebcamActive(false);

      for (const session of this.sessions.values()) {
        if (session.outgoingWebcam) {
          try {
            session.outgoingWebcam.close();
          } catch {
            /* ignore */
          }
          session.outgoingWebcam = null;
        }
      }

      if (this.localPeer) {
        useHubStore.getState().updateParticipant(this.localParticipantId(), {
          isWebcamActive: false,
        });
      }
      this.broadcastLocalState();
    } else {
      if (!useHubStore.getState().inVoiceCall) return;
      useMediaState.setState({ cameraBusy: true });
      try {
        const videoDeviceId = useHubStore.getState().audioConfig.videoDeviceId;
        const constraints: MediaStreamConstraints = {
          video: {
            deviceId:
              videoDeviceId && videoDeviceId !== "default"
                ? { exact: videoDeviceId }
                : undefined,
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 },
          },
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (
          generation !== this.cameraGeneration ||
          !useHubStore.getState().inVoiceCall
        ) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        this.localWebcamStream = stream;
        stream.getVideoTracks()[0].onended = () => {
          if (this.localWebcamStream === stream) void this.toggleWebcam();
        };
        useHubStore.getState().setLocalWebcamStream(stream);
        useHubStore.getState().setWebcamActive(true);

        if (this.localPeer) {
          useHubStore.getState().updateParticipant(this.localParticipantId(), {
            isWebcamActive: true,
          });
        }
        this.broadcastLocalState();

        for (const session of this.sessions.values()) {
          const p = useHubStore.getState().participants[session.peerId];
          if (
            p?.inVoiceCall &&
            this.localPeer &&
            this.canCallSession(session)
          ) {
            this.initiateWebcamCallWithPeer(session);
          }
        }
      } catch (err) {
        mediaError("Câmera indisponível", err);
      } finally {
        if (generation === this.cameraGeneration)
          useMediaState.setState({ cameraBusy: false });
      }
    }
  }

  public async startScreenShare(
    sourceId: string,
    qualityConfig: VideoQualityConfig,
  ): Promise<void> {
    if (
      !useHubStore.getState().inVoiceCall ||
      useMediaState.getState().screenBusy
    )
      return;
    const generation = ++this.screenGeneration;
    let acquired: MediaStream | null = null;
    useMediaState.setState({ screenBusy: true, error: null });
    try {
      if (window.cbsHubAPI) {
        await window.cbsHubAPI.setCaptureSource(
          sourceId,
          qualityConfig.includeSystemAudio,
        );
      }

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: qualityConfig.includeSystemAudio,
      });

      acquired = stream;
      if (
        generation !== this.screenGeneration ||
        !useHubStore.getState().inVoiceCall
      ) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        await videoTrack.applyConstraints({
          width: { ideal: qualityConfig.width, max: qualityConfig.width },
          height: { ideal: qualityConfig.height, max: qualityConfig.height },
          frameRate: { ideal: qualityConfig.fps, max: qualityConfig.fps },
        });

        if ("contentHint" in videoTrack) {
          videoTrack.contentHint =
            qualityConfig.fps >= 60 ? "motion" : "detail";
        }

        videoTrack.onended = () => {
          if (this.localScreenStream === stream) this.stopScreenShare();
        };
      }

      if (
        generation !== this.screenGeneration ||
        !useHubStore.getState().inVoiceCall
      ) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      this.localScreenStream?.getTracks().forEach((t) => t.stop());
      for (const session of this.sessions.values()) {
        session.outgoingScreen?.close();
        session.outgoingScreen = null;
      }
      this.localScreenStream = stream;
      useHubStore.getState().setLocalScreenStream(stream);
      useHubStore.getState().setScreenSharing(true);
      sounds.playStreamStart();

      if (this.localPeer) {
        useHubStore.getState().updateParticipant(this.localParticipantId(), {
          isScreenSharing: true,
          screenQualityLabel: `${qualityConfig.resolution} ${qualityConfig.fps}FPS`,
        });
      }
      this.broadcastLocalState();

      for (const session of this.sessions.values()) {
        const p = useHubStore.getState().participants[session.peerId];
        if (p?.inVoiceCall) {
          this.initiateScreenCallWithPeer(session);
        }
      }
    } catch (err) {
      console.error(
        "[WebRTC Engine] Erro ao iniciar compartilhamento de tela:",
        err,
      );
      acquired?.getTracks().forEach((t) => t.stop());
      mediaError("Compartilhamento indisponível", err);
    } finally {
      if (generation === this.screenGeneration)
        useMediaState.setState({ screenBusy: false });
    }
  }

  public stopScreenShare(): void {
    this.screenGeneration++;
    useMediaState.setState({ screenBusy: false });
    if (this.abrIntervalId !== null) {
      clearInterval(this.abrIntervalId);
      this.abrIntervalId = null;
    }

    if (this.localScreenStream) {
      this.localScreenStream.getTracks().forEach((track) => track.stop());
      this.localScreenStream = null;
    }

    for (const session of this.sessions.values()) {
      if (session.outgoingScreen) {
        try {
          session.outgoingScreen.close();
        } catch {
          /* ignore */
        }
        session.outgoingScreen = null;
      }
    }

    useHubStore.getState().setLocalScreenStream(null);
    useHubStore.getState().setScreenSharing(false);
    useHubStore.getState().setTelemetry({ active: false });

    if (this.localPeer) {
      useHubStore.getState().updateParticipant(this.localParticipantId(), {
        isScreenSharing: false,
        screenQualityLabel: undefined,
      });
      this.broadcast({
        type: "screen_stopped",
        peerId: this.localPeer.id,
      });
    }

    sounds.playStreamStop();
  }

  /* ========================================================================= */
  /* MICROFONE LOCAL, PIPELINE & RECUPERAÇÃO RESILIENTE                        */
  /* ========================================================================= */

  public async setupLocalMicrophone(
    options: { allowDefaultFallback?: boolean } = {},
  ): Promise<void> {
    const generation = ++this.micGeneration;
    let stream: MediaStream | null = null;
    let pipeline: VoiceAudioPipeline | null = null;
    useMediaState.setState({ microphoneBusy: true, error: null });
    try {
      const audioConfig = useHubStore.getState().audioConfig;
      const useSuppression = Boolean(audioConfig.neuralNoiseGate);
      const audioConstraints: MediaTrackConstraints = {
        deviceId:
          audioConfig.inputDeviceId !== "default"
            ? { exact: audioConfig.inputDeviceId }
            : undefined,
        echoCancellation: audioConfig.echoCancellation,
        autoGainControl: audioConfig.autoGainControl,
        noiseSuppression: useSuppression,
        sampleRate: 48000,
        channelCount: 1,
      };

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: audioConstraints,
        });
      } catch (error) {
        const name = (error as { name?: string } | null)?.name;
        if (
          options.allowDefaultFallback &&
          audioConfig.inputDeviceId !== "default" &&
          (name === "OverconstrainedError" || name === "NotFoundError")
        ) {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: { ...audioConstraints, deviceId: undefined },
          });
        } else {
          throw error;
        }
      }
      if (generation !== this.micGeneration) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      let previousSpeaking = false,
        lastLevel = -1;
      pipeline = new VoiceAudioPipeline(
        stream,
        audioConfig,
        (isSpeaking, level) => {
          if (
            generation !== this.micGeneration &&
            this.audioPipeline !== pipeline
          )
            return;
          if (lastLevel !== level || previousSpeaking !== isSpeaking)
            useHubStore.getState().setIsLocalSpeaking(isSpeaking, level);
          lastLevel = level;
          if (this.localPeer && previousSpeaking !== isSpeaking) {
            useHubStore
              .getState()
              .updateParticipant(this.localParticipantId(), { isSpeaking });
            if (useHubStore.getState().inVoiceCall)
              this.broadcast({
                type: "speaking",
                peerId: this.localPeer.id,
                isSpeaking,
              });
          }
          previousSpeaking = isSpeaking;
        },
      );
      pipeline.setMicMuted(this.microphoneGated());
      const processed = await pipeline.initialize();
      if (generation !== this.micGeneration) {
        pipeline.destroy();
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const newTrack = processed.getAudioTracks()[0];
      const senders = [...this.sessions.values()].flatMap((session) => {
        const pc = session.voiceCall?.peerConnection;
        if (
          !pc ||
          pc.connectionState === "closed" ||
          pc.signalingState === "closed"
        ) {
          return [];
        }
        return pc
          .getSenders()
          .filter((sender) => sender.track?.kind === "audio");
      });
      const oldTrack = this.audioPipeline
        ?.getProcessedStream()
        ?.getAudioTracks()[0];
      const replacements = await Promise.allSettled(
        senders.map((sender) => sender.replaceTrack(newTrack)),
      );
      if (
        senders.length > 0 &&
        replacements.every((result) => result.status === "rejected")
      ) {
        const firstRejected = replacements.find(
          (result): result is PromiseRejectedResult =>
            result.status === "rejected",
        );
        await Promise.allSettled(
          senders.map((sender) => sender.replaceTrack(oldTrack || null)),
        );
        throw firstRejected?.reason;
      }
      if (generation !== this.micGeneration) {
        pipeline.destroy();
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      soundboardEngine.stopAll();
      this.audioPipeline?.destroy();
      this.rawMicStream?.getTracks().forEach((t) => t.stop());
      pipeline.setMicMuted(this.microphoneGated());
      this.audioPipeline = pipeline;
      this.rawMicStream = stream;
      this.watchMicrophone(stream, pipeline);
      callEvent("microphone_ready");
      useHubStore.getState().setLocalVoiceStream(processed);
      soundboardEngine.registerPipelineHooks(
        () => this.audioPipeline?.getAudioContext() ?? null,
        () => this.audioPipeline?.getSoundboardInputNode() ?? null,
      );
    } catch (error) {
      pipeline?.destroy();
      stream?.getTracks().forEach((t) => t.stop());
      callEvent("microphone_error", { reason: "unknown" });
      mediaError("Microfone indisponível", error);
      throw error;
    } finally {
      if (generation === this.micGeneration)
        useMediaState.setState({ microphoneBusy: false });
    }
  }

  private watchMicrophone(
    stream: MediaStream,
    pipeline: VoiceAudioPipeline,
  ): void {
    this.clearMicMuteWatchdog();
    const track = stream.getAudioTracks()[0];
    if (!track) return;
    track.onended = () => this.handleMicInterruption(stream, "microphone_ended");
    track.onmute = () => {
      this.clearMicMuteWatchdog();
      this.micMuteWatchdog = window.setTimeout(() => {
        this.micMuteWatchdog = null;
        if (track.muted) this.handleMicInterruption(stream, "microphone_muted");
      }, this.micMuteWatchdogMs);
    };
    track.onunmute = () => this.clearMicMuteWatchdog();
    pipeline.setInterruptionHandler(() =>
      this.handleMicInterruption(stream, "audio_context_suspended"),
    );
  }

  private handleMicInterruption(
    stream: MediaStream,
    reason: "microphone_ended" | "microphone_muted" | "audio_context_suspended",
  ): void {
    if (
      this.rawMicStream !== stream ||
      useMediaState.getState().microphoneBusy ||
      !useHubStore.getState().inVoiceCall
    )
      return;
    callEvent("microphone_interrupted", { reason });
    if (Date.now() - this.lastMicRecoveredAt > 30000)
      this.micRecoveryAttempt = 0;
    if (this.micRecoveryAttempt > 0)
      mediaError(
        "Microfone interrompido",
        "A chamada continua. Reconectando o microfone…",
      );
    this.scheduleMicRecovery();
  }

  private scheduleMicRecovery(): void {
    if (this.micRecoveryTimer !== null) return;
    if (this.micRecoveryAttempt >= this.micRecoveryDelaysMs.length) {
      mediaError(
        "Microfone sem sinal",
        "A chamada continua, mas o microfone parou de responder. Selecione o microfone novamente.",
      );
      return;
    }
    const delay = this.micRecoveryDelaysMs[this.micRecoveryAttempt++];
    const generation = this.micGeneration;
    this.micRecoveryTimer = window.setTimeout(() => {
      this.micRecoveryTimer = null;
      if (
        generation !== this.micGeneration ||
        !useHubStore.getState().inVoiceCall
      )
        return;
      callEvent("microphone_recovery", {
        attempt: this.micRecoveryAttempt,
        delayMs: delay,
      });
      void this.setupLocalMicrophone({ allowDefaultFallback: true })
        .then(() => {
          if (this.rawMicStream?.active) this.lastMicRecoveredAt = Date.now();
        })
        .catch(() => {
          if (this.micGeneration === generation + 1) this.scheduleMicRecovery();
        });
    }, delay);
  }

  private clearMicMuteWatchdog(): void {
    if (this.micMuteWatchdog !== null) clearTimeout(this.micMuteWatchdog);
    this.micMuteWatchdog = null;
  }

  private clearMicRecovery(): void {
    if (this.micRecoveryTimer !== null) clearTimeout(this.micRecoveryTimer);
    this.micRecoveryTimer = null;
    this.clearMicMuteWatchdog();
    this.micRecoveryAttempt = 0;
    this.lastMicRecoveredAt = -Infinity;
  }

  public async selectMicrophone(deviceId: string): Promise<void> {
    if (useMediaState.getState().microphoneBusy) return;
    const previous = useHubStore.getState().audioConfig.inputDeviceId;
    this.updateAudioSettings({ inputDeviceId: deviceId });
    if (useHubStore.getState().inVoiceCall) {
      try {
        await this.setupLocalMicrophone();
      } catch {
        this.updateAudioSettings({ inputDeviceId: previous });
      }
    }
  }

  public async selectCamera(deviceId: string): Promise<void> {
    if (useMediaState.getState().cameraBusy) return;
    if (!useHubStore.getState().isWebcamActive) {
      this.updateAudioSettings({ videoDeviceId: deviceId });
      return;
    }
    const generation = ++this.cameraGeneration;
    const oldStream = this.localWebcamStream;
    let acquired: MediaStream | null = null;
    useMediaState.setState({ cameraBusy: true, error: null });
    try {
      acquired = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId:
            deviceId && deviceId !== "default"
              ? { exact: deviceId }
              : undefined,
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
      });
      if (
        generation !== this.cameraGeneration ||
        !useHubStore.getState().inVoiceCall
      ) {
        acquired.getTracks().forEach((t) => t.stop());
        return;
      }
      const track = acquired.getVideoTracks()[0];
      const senders = [...this.sessions.values()].flatMap(
        (session) =>
          session.outgoingWebcam?.peerConnection
            .getSenders()
            .filter((sender) => sender.track?.kind === "video") || [],
      );
      const results = await Promise.allSettled(
        senders.map((sender) => sender.replaceTrack(track)),
      );
      const failure = results.find((result) => result.status === "rejected");
      if (failure?.status === "rejected") {
        await Promise.allSettled(
          senders.map((sender) =>
            sender.replaceTrack(oldStream?.getVideoTracks()[0] || null),
          ),
        );
        throw failure.reason;
      }
      if (
        generation !== this.cameraGeneration ||
        !useHubStore.getState().inVoiceCall
      ) {
        acquired.getTracks().forEach((t) => t.stop());
        return;
      }
      const stream = acquired;
      this.localWebcamStream = stream;
      track.onended = () => {
        if (this.localWebcamStream === stream) void this.toggleWebcam();
      };
      useHubStore.getState().setLocalWebcamStream(stream);
      this.updateAudioSettings({ videoDeviceId: deviceId });
      oldStream?.getTracks().forEach((t) => t.stop());
    } catch (error) {
      acquired?.getTracks().forEach((t) => t.stop());
      mediaError("Não foi possível trocar a câmera", error);
    } finally {
      if (generation === this.cameraGeneration)
        useMediaState.setState({ cameraBusy: false });
    }
  }

  public updateAudioSettings(partial: Partial<AudioProcessingConfig>): void {
    useHubStore.getState().updateAudioConfig(partial);
    if (this.audioPipeline) {
      this.audioPipeline.updateConfig(partial);
    }

    if (typeof partial.neuralNoiseGate === "boolean" && this.rawMicStream) {
      const audioTrack = this.rawMicStream.getAudioTracks()[0];
      if (audioTrack && typeof audioTrack.applyConstraints === "function") {
        audioTrack
          .applyConstraints({ noiseSuppression: partial.neuralNoiseGate })
          .catch(() => {});
      }
    }

    const state = useHubStore.getState();
    for (const session of this.sessions.values()) {
      if (
        session.voiceAudioEl &&
        typeof partial.remoteStreamVolume === "number"
      ) {
        const peerVol = state.peerVolumes[session.clientId] ?? 1.0;
        session.voiceAudioEl.volume = state.isDeafened
          ? 0
          : Math.max(0, Math.min(1.0, peerVol * partial.remoteStreamVolume));
      }

      if (partial.outputDeviceId && session.voiceAudioEl) {
        void applySafeSinkId(
          session.voiceAudioEl as unknown as {
            setSinkId?: (id: string) => Promise<void>;
          },
          partial.outputDeviceId,
        );
      }
    }
  }

  /* ========================================================================= */
  /* SDP MUNGING & ADAPTIVE BITRATE (ABR)                                      */
  /* ========================================================================= */

  private patchCallSdp(call: MediaConnection, isStereo: boolean): void {
    try {
      const pc = call.peerConnection;
      if (!pc) return;

      const origSetLocalDescription = pc.setLocalDescription.bind(pc);
      pc.setLocalDescription = async (
        desc?: RTCLocalSessionDescriptionInit,
      ) => {
        if (desc && desc.sdp) {
          desc.sdp = enhanceOpusSdp(desc.sdp, isStereo);
        }
        return origSetLocalDescription(desc);
      };
    } catch (err) {
      console.warn(
        "[WebRTC Engine] Interceptação de setLocalDescription falhou:",
        err,
      );
    }
  }

  private abrStatsGeneration = 0;
  private receiverStatsGeneration = 0;
  private receiverStatsPeerId: string | null = null;
  private publishScreenTelemetry(sample: StreamTelemetry) {
    const state = useHubStore.getState(),
      focus = state.focusedPeerStreamKey;
    if (sample.direction === "outgoing" && !state.isScreenSharing) return;
    const focusPeerId = focus?.startsWith("screen-") ? focus.slice(7) : null;
    const validFocus =
      focusPeerId &&
      (state.participants[focusPeerId]?.isLocal
        ? state.localScreenStream
        : state.remoteStreams[focusPeerId]?.screen);
    if (
      state.callStageMode === "spotlight" &&
      validFocus &&
      focusPeerId !== sample.sourcePeerId
    )
      return;
    useHubStore.getState().setTelemetry(sample);
  }

  private startAbrLoop(
    pc: RTCPeerConnection,
    sender: RTCRtpSender,
    config: VideoQualityConfig,
    linkPeerId: string,
  ): void {
    const generation = ++this.abrStatsGeneration;
    if (this.abrIntervalId !== null) clearInterval(this.abrIntervalId);

    this.currentMaxBitrate = config.maxBitrateBps;
    this.targetMaxBitrate = config.maxBitrateBps;
    this.consecutiveBadCycles = 0;
    this.consecutiveGoodCycles = 0;
    this.prevSenderBytes = 0;
    this.prevSenderTimestamp = performance.now();

    this.abrIntervalId = window.setInterval(async () => {
      try {
        const stats = await pc.getStats();
        if (
          generation !== this.abrStatsGeneration ||
          !useHubStore.getState().isScreenSharing
        )
          return;
        let fps = 0;
        let bitrateMbps = 0;
        let rttMs = 0;
        let packetsLostPercent = 0,
          lossMeasured = false,
          bitrateMeasured = false;

        stats.forEach((report) => {
          if (report.type === "outbound-rtp" && report.kind === "video") {
            if (
              typeof report.framesPerSecond === "number" &&
              report.framesPerSecond > 0
            ) {
              fps = report.framesPerSecond;
            }
            const now = performance.now();
            const deltaMs = now - this.prevSenderTimestamp;
            if (this.prevSenderBytes > 0 && deltaMs > 0 && report.bytesSent) {
              bitrateMeasured = true;
              const bytesDiff = report.bytesSent - this.prevSenderBytes;
              bitrateMbps = Math.max(
                0,
                Number(
                  ((bytesDiff * 8) / (deltaMs / 1000) / 1_000_000).toFixed(2),
                ),
              );
            }
            this.prevSenderBytes = report.bytesSent || 0;
            this.prevSenderTimestamp = now;
          }

          if (
            report.type === "candidate-pair" &&
            report.state === "succeeded"
          ) {
            if (Number.isFinite(report.currentRoundTripTime)) {
              rttMs = Math.round(report.currentRoundTripTime * 1000);
            }
          }

          if (report.type === "remote-inbound-rtp" && report.kind === "video") {
            const packetsLost = report.packetsLost || 0;
            const packetsReceived = report.packetsReceived || 0;
            const total = packetsLost + packetsReceived;
            if (total > 0) {
              lossMeasured = true;
              packetsLostPercent = Math.max(
                0,
                Number(((packetsLost / total) * 100).toFixed(1)),
              );
            }
          }
        });

        let abrStatus: "optimal" | "throttled" | "recovering" =
          this.currentMaxBitrate >= this.targetMaxBitrate
            ? "optimal"
            : "recovering";

        const networkMeasured = rttMs > 0 || lossMeasured;
        if (networkMeasured && (packetsLostPercent > 4.0 || rttMs > 120)) {
          this.consecutiveBadCycles++;
          this.consecutiveGoodCycles = 0;

          if (this.consecutiveBadCycles >= 2) {
            const throttled = Math.max(
              1_500_000,
              Math.round(this.currentMaxBitrate * 0.8),
            );
            if (throttled !== this.currentMaxBitrate) {
              this.currentMaxBitrate = throttled;
              await configureVideoSender(sender, this.currentMaxBitrate);
            }
            abrStatus = "throttled";
          }
        } else if (
          networkMeasured &&
          packetsLostPercent < 0.5 &&
          rttMs <= 100
        ) {
          this.consecutiveBadCycles = 0;
          this.consecutiveGoodCycles++;

          if (this.consecutiveGoodCycles >= 6) {
            const recovered = Math.min(
              this.targetMaxBitrate,
              Math.round(this.currentMaxBitrate * 1.15),
            );
            if (recovered !== this.currentMaxBitrate) {
              this.currentMaxBitrate = recovered;
              await configureVideoSender(sender, this.currentMaxBitrate);
            }
            abrStatus =
              this.currentMaxBitrate >= this.targetMaxBitrate
                ? "optimal"
                : "recovering";
          }
        } else {
          this.consecutiveBadCycles = 0;
          this.consecutiveGoodCycles = 0;
        }

        if (generation !== this.abrStatsGeneration) return;
        this.publishScreenTelemetry({
          sourcePeerId: this.localParticipantId(),
          observedLinkPeerId: linkPeerId,
          direction: "outgoing",
          lossMeasured,
          bitrateMeasured,
          active: true,
          resolution: `Meta ${config.resolution} (${config.width}x${config.height})`,
          fps: Math.round(fps),
          bitrateMbps,
          rttMs,
          packetsLostPercent,
          abrStatus,
        });
      } catch (err) {
        console.warn("[ABR Loop] Erro na leitura de stats:", err);
      }
    }, 1500);
  }

  public observeScreenTelemetry(peerId: string): void {
    const state = useHubStore.getState();
    if (state.participants[peerId]?.isLocal) {
      this.stopReceiverStats();
      return;
    }
    const session = this.sessions.get(peerId),
      stream = state.remoteStreams[peerId]?.screen;
    if (this.receiverStatsPeerId === peerId) return;
    if (session?.screenCall?.peerConnection && stream)
      this.startReceiverStats(
        session.screenCall.peerConnection,
        stream,
        peerId,
      );
  }

  private startReceiverStats(
    pc: RTCPeerConnection,
    stream: MediaStream,
    peerId: string,
  ): void {
    const state = useHubStore.getState(),
      focus = state.focusedPeerStreamKey;
    const focusPeerId = focus?.startsWith("screen-") ? focus.slice(7) : null;
    const validFocus =
      focusPeerId &&
      (state.participants[focusPeerId]?.isLocal
        ? state.localScreenStream
        : state.remoteStreams[focusPeerId]?.screen);
    if (
      state.callStageMode === "spotlight" &&
      validFocus &&
      focusPeerId !== peerId
    )
      return;
    this.stopReceiverStats();
    this.receiverStatsPeerId = peerId;
    const generation = this.receiverStatsGeneration;
    this.prevReceiverBytes = 0;
    this.prevReceiverTimestamp = performance.now();

    this.receiverStatsIntervalId = window.setInterval(async () => {
      try {
        const stats = await pc.getStats();
        if (generation !== this.receiverStatsGeneration || !stream.active)
          return;
        let fps = 0;
        let bitrateMbps = 0;
        let rttMs = 0;
        let packetsLostPercent = 0,
          lossMeasured = false,
          bitrateMeasured = false;
        let resolution = "—";

        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          const settings = videoTrack.getSettings();
          if (settings.width && settings.height) {
            resolution = `${settings.width}x${settings.height}`;
          }
        }

        stats.forEach((report) => {
          if (report.type === "inbound-rtp" && report.kind === "video") {
            if (
              typeof report.framesPerSecond === "number" &&
              report.framesPerSecond > 0
            ) {
              fps = report.framesPerSecond;
            }
            const now = performance.now();
            const deltaMs = now - this.prevReceiverTimestamp;
            if (
              this.prevReceiverBytes > 0 &&
              deltaMs > 0 &&
              report.bytesReceived
            ) {
              bitrateMeasured = true;
              const bytesDiff = report.bytesReceived - this.prevReceiverBytes;
              bitrateMbps = Math.max(
                0,
                Number(
                  ((bytesDiff * 8) / (deltaMs / 1000) / 1_000_000).toFixed(2),
                ),
              );
            }
            this.prevReceiverBytes = report.bytesReceived || 0;
            this.prevReceiverTimestamp = now;

            const packetsLost = report.packetsLost || 0;
            const packetsReceived = report.packetsReceived || 0;
            const total = packetsLost + packetsReceived;
            if (total > 0) {
              lossMeasured = true;
              packetsLostPercent = Math.max(
                0,
                Number(((packetsLost / total) * 100).toFixed(1)),
              );
            }
          }

          if (
            report.type === "candidate-pair" &&
            report.state === "succeeded"
          ) {
            if (Number.isFinite(report.currentRoundTripTime)) {
              rttMs = Math.round(report.currentRoundTripTime * 1000);
            }
          }
        });

        this.publishScreenTelemetry({
          sourcePeerId: peerId,
          observedLinkPeerId: peerId,
          direction: "incoming",
          lossMeasured,
          bitrateMeasured,
          active: true,
          resolution,
          fps: Math.round(fps),
          bitrateMbps,
          rttMs,
          packetsLostPercent,
          abrStatus: packetsLostPercent > 4 ? "throttled" : "optimal",
        });
      } catch (err) {
        console.warn("[Receiver Stats] Erro:", err);
      }
    }, 1500);
  }

  private stopReceiverStats(peerId?: string): void {
    if (peerId && this.receiverStatsPeerId !== peerId) return;
    this.receiverStatsGeneration++;
    this.receiverStatsPeerId = null;
    if (this.receiverStatsIntervalId !== null) {
      clearInterval(this.receiverStatsIntervalId);
      this.receiverStatsIntervalId = null;
    }
  }

  /* ========================================================================= */
  /* SOUNDBOARD & ENCERRAMENTO                                                 */
  /* ========================================================================= */

  public async triggerSoundboardClip(clip: SoundboardClip): Promise<void> {
    const state = useHubStore.getState();
    await soundboardEngine.playClip(clip);

    if (this.localPeer) {
      useHubStore.getState().updateParticipant(this.localParticipantId(), {
        activeSoundEffect: {
          emoji: clip.emoji,
          name: clip.name,
          expiresAt: Date.now() + 3500,
        },
      });

      this.broadcast({
        type: "soundboard_triggered",
        peerId: this.localPeer.id,
        clientId: state.clientId,
        nickname: state.nickname,
        emoji: clip.emoji,
        soundName: clip.name,
      });

      soundActivity(
        state.activeChannelId || "dm",
        state.clientId,
        state.nickname,
        clip.emoji,
        clip.name,
      );

      window.setTimeout(() => {
        const current =
          useHubStore.getState().participants[this.localPeer?.id || ""];
        if (current?.activeSoundEffect?.name === clip.name) {
          useHubStore.getState().updateParticipant(this.localParticipantId(), {
            activeSoundEffect: null,
          });
        }
      }, 3600);
    }
  }

  public async loadSoundboardClips(): Promise<void> {
    await soundboardEngine.loadAllClips();
  }

  public leaveRoom(): void {
    const state = useHubStore.getState();
    if (
      (state.inVoiceCall || state.outgoingCall) &&
      state.activeContext?.type !== "room"
    ) {
      this.leaveVoiceCall("manual_leave");
    }
    this.teardownRoomChannels();
    this.cleanupDirectCallLocalState();
    this.roomGeneration++;
    this.currentRoomSlug = "";
    useHubStore.getState().resetSession();
    useHubStore.getState().setMessages([]);
    useHubStore.getState().setActiveContext(null);
  }
}

export const webrtcEngine = new WebRTCEngine();
