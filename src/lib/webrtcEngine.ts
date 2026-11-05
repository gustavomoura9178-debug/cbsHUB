import {peerState} from "./signalingValidation";
import {soundActivity} from "../chat/activities";
import { chatLedger } from "../chat/ledger";
import {
  validateMessage,
  validateOperation,
  type ChatOperation,
} from "../chat/model";
import { publicProfile, validatePublicProfile } from "../profiles/model";
import { readOwnProfile, isBlocked } from "../profiles/repository";
import Peer, { type MediaConnection, type DataConnection } from "peerjs";
import { useHubStore } from "../store/useHubStore";
import { sounds } from "./sounds";
import { VoiceAudioPipeline } from "./audioPipeline";
import { soundboardEngine } from "./soundboardEngine";
import { storageDb } from "./storageDb";
import { enhanceOpusSdp, configureVideoSender } from "./sdpMunger";
import type {
  VideoQualityConfig,
  AudioProcessingConfig,
  Participant,
  ChatMessage,
  SoundboardClip,
  SignalingPacket,
} from "../types/cbshub";

import { useMediaState, mediaError } from "./mediaState";

const MAX_ROOM_PEERS = 6;

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

  // Reprodução direta (0–100%); WebAudio separado apenas para detecção de fala.
  voiceAudioCtx: AudioContext | null;
  voiceSourceNode: MediaStreamAudioSourceNode | null;
  voiceGainNode: GainNode | null;
  voiceDestNode: MediaStreamAudioDestinationNode | null;
  voiceAudioEl: HTMLAudioElement | null;
  remoteSpeakingInterval: number | null;
}

class WebRTCEngine {
  private chatClock = 0;
  private roomGeneration = 0;
  private micGeneration = 0;
  private cameraGeneration = 0;
  private screenGeneration = 0;
  private joiningVoice = false;
  private recoveryTimer: number | null = null;
  private recoveryAttempts = 0;

  private localPeer: Peer | null = null;
  private beaconPeer: Peer | null = null;
  private isBeaconOwner = false;
  private beaconHealTimeout: number | null = null;
  private currentRoomSlug = "";

  // Malha de sessões ativas (chave: peerId)
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

  // Sanitizador de slug de sala (Seção 5.1 SDD.md)
  public sanitizeSlug(input: string): string {
    const slug = input.toLowerCase().replace(/[^a-z0-9-]/g, "");
    return slug || "cbs-irmandade";
  }

  private generateShortId(clientId: string): string {
    const clean = clientId.replace(/[^a-z0-9]/gi, "").toLowerCase();
    return clean.substring(0, 6) || Math.random().toString(36).substring(2, 8);
  }

  /* ========================================================================= */
  /* CONEXÃO NA SALA (TEXTO + PRESENÇA + BEACON MESH)                          */
  /* ========================================================================= */

  public async joinRoom(
    roomInput: string,
    autoJoinVoice = false,
  ): Promise<void> {
    localStorage.removeItem("cbshub-room-removed-active");
    this.leaveRoom();
    const generation = this.roomGeneration;

    const slug = this.sanitizeSlug(roomInput);
    this.currentRoomSlug = slug;
    useHubStore.getState().setMessages([]);
    useHubStore.getState().setRoomId(slug);
    useHubStore.getState().setStatusText("Conectando à sala...");

    // Carrega mensagens salvas localmente no IndexedDB
    try {
      const savedMessages = await chatLedger.refresh(slug);
      if (this.currentRoomSlug !== slug || generation !== this.roomGeneration)
        return;
      useHubStore.getState().addMessageBatch(savedMessages);
    } catch (err) {
      console.warn("[WebRTC Engine] Erro ao carregar histórico local:", err);
    }

    // Carrega efeitos do Soundboard
    try {
      await soundboardEngine.loadAllClips();
    } catch {
      /* ignore */
    }

    if (this.currentRoomSlug !== slug || generation !== this.roomGeneration)
      return;
    const state = useHubStore.getState();
    const shortId = this.generateShortId(state.clientId);
    // Sufixo efêmero único garante que recarregamentos rápidos nunca recebam unavailable-id
    const instanceNonce = Math.random().toString(36).substring(2, 6);
    const localPeerId = `cbshub-v2-${slug}-p-${shortId}-${instanceNonce}`;

    // Registra participante local na store
    const localParticipant: Participant = {
      peerId: localPeerId,
      clientId: state.clientId,
      nickname: state.nickname,
      avatarColor: state.avatarColor,
      isLocal: true,
      inVoiceCall: false,
      isMuted: state.isMuted,
      isDeafened: state.isDeafened,
      isSpeaking: false,
      isWebcamActive: false,
      isScreenSharing: false,
      activeSoundEffect: null,
    };

    useHubStore.getState().setParticipants({ [localPeerId]: localParticipant });

    // Inicializa localPeer
    this.localPeer = new Peer(localPeerId, PEER_CONFIG);

    const peer = this.localPeer;
    let firstOpen = true;
    this.setupLocalPeerListeners();
    this.localPeer.on("open", (id) => {
      if (this.localPeer !== peer) return;
      this.recoveryAttempts = 0;
      useMediaState.setState({ reconnecting: false });
      useHubStore
        .getState()
        .setConnectionStatus(
          true,
          false,
          id,
          null,
          "Conectado à sala de texto e presença!",
        );
      sounds.playJoin();

      // Configura escuta de conexões de dados e chamadas de mídia entrantes
      // Tenta assumir ou consultar o Beacon da sala
      if (!this.beaconPeer) this.attemptClaimBeacon(slug);
      else if (!this.isBeaconOwner)
        this.queryBeaconDirectory(`cbshub-v2-${slug}-beacon`);

      const shouldJoinVoice = autoJoinVoice && firstOpen;
      firstOpen = false;
      if (shouldJoinVoice && !useHubStore.getState().inVoiceCall) {
        this.joinVoiceCall().catch((e) =>
          console.warn("[WebRTC Engine] Auto-join voice falhou:", e),
        );
      }
    });

    this.localPeer.on("error", (err: { type?: string }) => {
      if (this.localPeer !== peer) return;
      console.error("[WebRTC Engine] Erro no localPeer:", err);
      if (
        err.type === "network" ||
        err.type === "socket-error" ||
        err.type === "server-error"
      )
        this.scheduleRecovery();
      useHubStore
        .getState()
        .setStatusText(`Aviso de rede: ${err.type || "desconhecido"}`);
    });

    this.localPeer.on("disconnected", () => {
      if (this.localPeer === peer) this.scheduleRecovery();
    });

    this.localPeer.on("close", () => {
      // Executa saída apenas se o peer não foi fechado intencionalmente pelo leaveRoom
      if (this.localPeer === peer && useHubStore.getState().isConnected) {
        this.leaveRoom();
      }
    });
  }

  private scheduleRecovery(): void {
    if (!this.currentRoomSlug || this.recoveryTimer !== null) return;
    useMediaState.setState({ reconnecting: true });
    useHubStore
      .getState()
      .setStatusText("Reconectando sinalização e participantes...");
    const generation = this.roomGeneration;
    this.recoveryTimer = window.setTimeout(
      () => {
        this.recoveryTimer = null;
        if (
          generation !== this.roomGeneration ||
          !this.localPeer ||
          this.localPeer.destroyed
        )
          return;
        if (navigator.onLine && this.localPeer.disconnected) {
          try {
            this.localPeer.reconnect();
          } catch (error) {
            mediaError("Reconexão", error);
          }
        } else if (navigator.onLine) {
          this.queryBeaconDirectory(`cbshub-v2-${this.currentRoomSlug}-beacon`);
          this.broadcastLocalState();
          useMediaState.setState({ reconnecting: false });
          return;
        }
        this.scheduleRecovery();
      },
      Math.min(15000, 1000 * 2 ** Math.min(this.recoveryAttempts++, 4)),
    );
  }

  public retryConnection(): void {
    this.recoveryAttempts = 0;
    this.scheduleRecovery();
  }

  private setupLocalPeerListeners(): void {
    if (!this.localPeer) return;

    // Conexões de dados entrantes (Chat, Presença, Sincronização)
    this.localPeer.on("connection", (conn) => {
      this.handleIncomingDataConnection(conn);
    });

    // Chamadas de mídia entrantes (Voz, Webcam, Compartilhamento de Tela)
    this.localPeer.on("call", (call) => {
      this.handleIncomingMediaCall(call);
    });
  }

  /* ========================================================================= */
  /* BEACON DE DESCOBERTA E AUTO-HEAL ANTI-QUEDA                               */
  /* ========================================================================= */

  private attemptClaimBeacon(slug: string): void {
    const beaconId = `cbshub-v2-${slug}-beacon`;

    try {
      this.beaconPeer = new Peer(beaconId, PEER_CONFIG);

      this.beaconPeer.on("open", () => {
        // Cenário A: Este cliente assumiu com sucesso o papel de Beacon (Diretório)
        this.isBeaconOwner = true;
        useHubStore
          .getState()
          .setStatusText("Conectado como Diretório da sala.");

        this.beaconPeer!.on("connection", (conn) => {
          this.handleBeaconDirectoryConnection(conn);
        });
      });

      this.beaconPeer.on("error", (err: { type?: string }) => {
        if (err.type === "unavailable-id") {
          // Cenário B: Já existe um Beacon ativo na sala! Conectar a ele para descobrir os irmãos
          this.isBeaconOwner = false;
          try {
            this.beaconPeer?.destroy();
          } catch {
            /* ignore */
          }
          this.beaconPeer = null;
          this.queryBeaconDirectory(beaconId);
        } else {
          console.warn("[WebRTC Beacon] Erro no beacon peer:", err);
        }
      });
    } catch (err) {
      console.warn("[WebRTC Beacon] Falha ao instanciar beacon:", err);
    }
  }

  /**
   * Responde a novos membros que conectam ao Beacon para pedir a lista de participantes
   */
  private handleBeaconDirectoryConnection(conn: DataConnection): void {
    conn.on("data", (data) => {
      const packet = data as SignalingPacket;
      if (packet && packet.type === "directory_request") {
        const state = useHubStore.getState();
        // Coleta participantes conhecidos (limite de 6)
        const knownPeers: Array<Omit<Participant, "isLocal">> = Object.values(
          state.participants,
        )
          .map((p) => {
            const { isLocal, profile: _profile, ...rest } = p;
            return rest;
          })
          .slice(0, MAX_ROOM_PEERS);

        // Responde com o diretório completo
        try {
          conn.send({
            type: "directory_response",
            peers: knownPeers,
          } as SignalingPacket);
        } catch (err) {
          console.warn(
            "[WebRTC Beacon] Falha ao enviar directory_response:",
            err,
          );
        }

        // O visitante já discará para os membros recebidos na lista; não discamos de volta para evitar colisão
        // (Glare) no DataChannel
      }
    });
  }

  /**
   * Consulta o Beacon para obter a lista de irmãos e abrir malha direta (Full Mesh)
   */
  private queryBeaconDirectory(beaconId: string): void {
    if (!this.localPeer || this.localPeer.destroyed) return;

    const conn = this.localPeer.connect(beaconId, { reliable: true });

    conn.on("open", () => {
      const state = useHubStore.getState();
      const localParticipant = state.participants[this.localPeer?.id || ""];
      const myInfo: Omit<Participant, "isLocal"> = localParticipant
        ? {
            peerId: localParticipant.peerId,
            clientId: localParticipant.clientId,
            nickname: localParticipant.nickname,
            avatarColor: localParticipant.avatarColor,
            inVoiceCall: localParticipant.inVoiceCall,
            isMuted: localParticipant.isMuted,
            isDeafened: localParticipant.isDeafened,
            isSpeaking: localParticipant.isSpeaking,
            isWebcamActive: localParticipant.isWebcamActive,
            isScreenSharing: localParticipant.isScreenSharing,
          }
        : {
            peerId: this.localPeer!.id,
            clientId: state.clientId,
            nickname: state.nickname,
            avatarColor: state.avatarColor,
            inVoiceCall: state.inVoiceCall,
            isMuted: state.isMuted,
            isDeafened: state.isDeafened,
            isSpeaking: false,
            isWebcamActive: false,
            isScreenSharing: false,
          };

      conn.send({
        type: "directory_request",
        peerInfo: myInfo,
      } as SignalingPacket);
    });

    conn.on("data", (data) => {
      const packet = data as SignalingPacket;
      if (
        packet &&
        packet.type === "directory_response" &&
        Array.isArray(packet.peers)
      ) {
        // Conecta a todos os irmãos retornados pelo diretório
        packet.peers.forEach((peer) => {
          if (peer.peerId && peer.peerId !== this.localPeer?.id) {
            this.connectToPeer(peer.peerId, peer.clientId);
          }
        });
        // Fecha conexão temporária com o Beacon após receber o diretório
        window.setTimeout(() => {
          try {
            conn.close();
          } catch {
            /* ignore */
          }
        }, 500);
      }
    });

    conn.on("error", () => {
      // Beacon pode ter caído, agenda auto-heal
      this.scheduleBeaconElection();
    });
  }

  /**
   * Eleição determinística de novo Beacon baseada em ordem alfabética dos clientIds
   */
  private scheduleBeaconElection(): void {
    if (this.isBeaconOwner || this.beaconHealTimeout !== null) return;

    const state = useHubStore.getState();
    const allParticipants = Object.values(state.participants);
    const sortedClientIds = allParticipants.map((p) => p.clientId).sort();
    const myIndex = sortedClientIds.indexOf(state.clientId);

    if (myIndex === -1) return;

    // Backoff ordenado: 0 * 400ms, 1 * 400ms, etc.
    const delay = myIndex * 400 + 150;

    this.beaconHealTimeout = window.setTimeout(() => {
      this.beaconHealTimeout = null;
      if (!this.isBeaconOwner && this.currentRoomSlug) {
        this.attemptClaimBeacon(this.currentRoomSlug);
      }
    }, delay);
  }

  /* ========================================================================= */
  /* GESTÃO DE SESSÕES MESH (DATACONNECTION & MEDIACONNECTION)                  */
  /* ========================================================================= */

  private connectToPeer(remotePeerId: string, clientId?: string): void {
    if (
      !this.localPeer ||
      this.localPeer.destroyed ||
      remotePeerId === this.localPeer.id
    )
      return;
    if (this.sessions.has(remotePeerId)) return;

    const conn = this.localPeer.connect(remotePeerId, { reliable: true });
    this.setupDataConnection(conn, clientId);
  }

  private handleIncomingDataConnection(conn: DataConnection): void {
    if (this.sessions.has(conn.peer)) {
      // Já existe sessão ativa; fecha duplicada
      const existing = this.sessions.get(conn.peer);
      if (existing && existing.dataConn.open) {
        conn.close();
        return;
      }
    }
    this.setupDataConnection(conn);
  }

  private setupDataConnection(
    conn: DataConnection,
    initialClientId?: string,
  ): void {
    const remotePeerId = conn.peer;

    const session: PeerMediaSession = {
      peerId: remotePeerId,
      clientId: initialClientId || "",
      nickname: "Irmão Conectando...",
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

    const previous = this.sessions.get(remotePeerId);
    if (previous) this.closeBlockedMedia(previous);
    this.sessions.set(remotePeerId, session);

    conn.on("open", () => {
      if (this.sessions.get(remotePeerId) !== session) return;
      const state = useHubStore.getState();
      const localParticipant = state.participants[this.localPeer?.id || ""];

      // Envia nosso estado completo para o irmão
      if (localParticipant) {
        const { isLocal, profile: _profile, ...myState } = localParticipant;
        conn.send({
          type: "peer_state_sync",
          state: myState,
        } as SignalingPacket);
      }

      this.sendProfileToSession(session);

      // Sincroniza chat recente (IndexedDB)
      this.requestChatSync(conn);

      // Compatibilidade legada com 1v1
      if (!useHubStore.getState().remotePeerId) {
        useHubStore.getState().setRemoteNickname(session.nickname);
      }
    });

    conn.on("data", (data) => {
      if (this.sessions.get(remotePeerId) !== session) return;
      this.handleIncomingSignalingPacket(session, data as SignalingPacket);
    });

    conn.on("close", () => {
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
    this.sessions.delete(session.peerId);
    this.closeBlockedMedia(session);
    this.scheduleRecovery();
    sounds.playLeave();
    this.teardownPeerVoiceAudio(session);

    if (session.voiceCall) {
      try {
        session.voiceCall.close();
      } catch {
        /* ignore */
      }
    }
    if (session.webcamCall) {
      try {
        session.webcamCall.close();
      } catch {
        /* ignore */
      }
    }
    if (session.screenCall) {
      try {
        session.screenCall.close();
      } catch {
        /* ignore */
      }
    }

    this.sessions.delete(session.peerId);
    useHubStore.getState().removeParticipant(session.peerId);
    useHubStore.getState().removeRemoteStreams(session.peerId);

    // Compatibilidade legada
    if (useHubStore.getState().remotePeerId === session.peerId) {
      const remainingSessions = Array.from(this.sessions.values());
      if (remainingSessions.length > 0) {
        useHubStore.getState().setRemoteNickname(remainingSessions[0].nickname);
      } else {
        useHubStore.getState().setRemoteNickname("Aguardando irmão...");
        useHubStore.getState().setRemoteVoiceStream(null);
        useHubStore.getState().setRemoteScreenStream(null);
        this.stopReceiverStats();
      }
    }

    // Se o dono do beacon saiu, agenda eleição de novo beacon
    this.scheduleBeaconElection();
  }

  /* ========================================================================= */
  /* TRATAMENTO DE PACOTES DE SINALIZAÇÃO P2P                                  */
  /* ========================================================================= */

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
          /* Malformed remote profile is ignored, not merged. */
        }
        break;
      }
      case "peer_state_sync": {
        const remote = peerState(packet.state, session.peerId, session.clientId);
        if (!remote) return;
        session.clientId = remote.clientId;
        session.nickname = remote.nickname;

        useHubStore.getState().updateParticipant(session.peerId, {
          ...remote,
          isLocal: false,
        });

        // Se o par acabou de ser registrado, insere caso não exista ainda
        if (!useHubStore.getState().participants[session.peerId]) {
          useHubStore.getState().setParticipants({
            ...useHubStore.getState().participants,
            [session.peerId]: { ...remote, isLocal: false },
          });
        }

        if (isBlocked(remote.clientId)) {
          this.closeBlockedMedia(session);
          return;
        }
        this.sendProfileToSession(session);
        // Compatibilidade legada
        useHubStore.getState().setRemoteNickname(remote.nickname);

        // Se ambos estiverem em chamada de voz e a chamada ainda não tiver chegado após 400ms:
        const localState = useHubStore.getState();
        if (
          localState.inVoiceCall &&
          remote.inVoiceCall &&
          !session.voiceCall
        ) {
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
          }, 400);
        }

        if (!remote.inVoiceCall) this.closeBlockedMedia(session);
        if (
          localState.inVoiceCall &&
          remote.inVoiceCall &&
          this.localWebcamStream &&
          !session.outgoingWebcam
        )
          this.initiateWebcamCallWithPeer(session);

        // Se local estiver compartilhando tela e o irmão estiver em call de voz
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
        useHubStore.getState().setTelemetry({ active: false });
        this.stopReceiverStats();
        sounds.playStreamStop();
        break;
      }

      case "chat_message": {
        const room = useHubStore.getState().roomId;
        try {
          const msg = validateMessage(packet.message, room);
          if (msg.type === "soundboard") return;
          if (msg.authorClientId !== session.clientId) return;
          chatLedger
            .mergeMessages(room, [msg])
            .then((merged) => {
              if (useHubStore.getState().roomId !== room) return;
              const fresh = !useHubStore
                .getState()
                .messages.some((m) => m.id === msg.id);
              useHubStore.getState().setMessages(merged);
              if (fresh) useHubStore.getState().setUnreadCount((n) => n + 1);
              session.dataConn.send({
                type: "chat_ack",
                roomId: room,
                messageId: msg.id,
              } as SignalingPacket);
            })
            .catch((error) =>
              console.warn("[Chat] Falha ao persistir mensagem:", error),
            );
        } catch {
          /* Invalid remote content is not rendered or stored. */
        }
        break;
      }
      case "chat_ack": {
        const state = useHubStore.getState();
        const message = state.messages.find(
          (m) =>
            m.id === packet.messageId && m.authorClientId === state.clientId,
        );
        if (!message || packet.roomId !== state.roomId) return;
        chatLedger
          .acknowledge(packet.roomId, message.id)
          .then((messages) => {
            if (useHubStore.getState().roomId === packet.roomId)
              useHubStore.getState().setMessages(messages);
          })
          .catch(() => {});
        break;
      }
      case "chat_operation": {
        this.receiveChatOperations(session, useHubStore.getState().roomId, [
          packet.operation,
        ]);
        break;
      }
      case "chat_operations_sync": {
        if (
          packet.roomId !== useHubStore.getState().roomId ||
          !Array.isArray(packet.operations) ||
          packet.operations.length > 100
        )
          return;
        this.receiveChatOperations(session, packet.roomId, packet.operations);
        break;
      }

      case "chat_reaction_toggle": {
        if (
          typeof packet.emoji !== "string" ||
          packet.emoji.length > 16 ||
          ["__proto__", "constructor", "prototype"].includes(packet.emoji)
        )
          return;
        const ownerState = useHubStore.getState();
        const message = ownerState.messages.find(
          (m) => m.id === packet.messageId,
        );
        if (
          packet.clientId !== session.clientId ||
          (message?.authorClientId === ownerState.clientId &&
            !readOwnProfile(ownerState.clientId, ownerState.nickname).privacy
              .allowReactions)
        )
          return;
        storageDb
          .toggleReaction(
            packet.messageId,
            packet.emoji,
            packet.clientId,
            packet.nickname,
          )
          .catch(() => {});
        useHubStore
          .getState()
          .updateMessageReaction(
            packet.messageId,
            packet.emoji,
            packet.clientId,
            packet.nickname,
          );
        break;
      }

      case "chat_typing": {
        if (
          packet.clientId !== session.clientId ||
          typeof packet.nickname !== "string" ||
          packet.nickname.length > 80 ||
          typeof packet.isTyping !== "boolean"
        )
          return;
        useHubStore
          .getState()
          .setTypingUser(packet.clientId, packet.nickname, packet.isTyping);
        break;
      }

      case "chat_sync_request": {
        const room = useHubStore.getState().roomId;
        if (
          packet.roomId !== room ||
          !Array.isArray(packet.knownIds) ||
          packet.knownIds.length > 500
        )
          return;
        storageDb
          .getMessagesByRoom(room)
          .then((all) => {
            if (useHubStore.getState().roomId !== room) return;
            const known = new Set(packet.knownIds);
            const missing = all.filter(
              (m) =>
                !known.has(m.id) && m.type !== "soundboard" && !m.deleted && !isBlocked(m.authorClientId),
            );
            // Original author is needed to authenticate a new v2 edit/delete; history remains best-effort P2P.
            for (let i = 0; i < missing.length; i += 50)
              session.dataConn.send({
                type: "chat_sync_response",
                roomId: room,
                messages: missing.slice(i, i + 50),
              } as SignalingPacket);
          })
          .catch(() => {});
        this.sendChatOperations(session.dataConn, room);
        break;
      }
      case "chat_sync_response": {
        const room = useHubStore.getState().roomId;
        if (
          packet.roomId !== room ||
          !Array.isArray(packet.messages) ||
          packet.messages.length > 500
        )
          return;
        try {
          const clean = packet.messages
            .filter((m) => m.type !== "soundboard" && !isBlocked(m.authorClientId))
            .map((m) => validateMessage(m, room));
          chatLedger
            .mergeMessages(room, clean)
            .then((merged) => {
              if (useHubStore.getState().roomId === room)
                useHubStore.getState().setMessages(merged);
            })
            .catch(() => {});
        } catch {
          /* Ignore invalid history batches. */
        }
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
        soundActivity(useHubStore.getState().roomId, session.clientId, session.nickname, packet.emoji, packet.soundName);
        // Exibe animação flutuante no card do participante que tocou o som
        useHubStore.getState().updateParticipant(packet.peerId, {
          activeSoundEffect: {
            emoji: packet.emoji,
            name: packet.soundName,
            expiresAt: Date.now() + 3500,
          },
        });

        // Limpa animação após 3.5 segundos
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
  /* SINCRONIZAÇÃO DE CHAT P2P (INDEXEDDB)                                     */
  /* ========================================================================= */

  private requestChatSync(conn: DataConnection): void {
    const room = this.currentRoomSlug;
    if (!room) return;
    storageDb
      .getMessagesByRoom(room)
      .then((messages) => {
        if (this.currentRoomSlug !== room || !conn.open) return;
        conn.send({
          type: "chat_sync_request",
          roomId: room,
          sinceTimestamp: 0,
          knownIds: messages.map((m) => m.id),
        } as SignalingPacket);
        for (const msg of messages.filter(
          (m) =>
            m.authorClientId === useHubStore.getState().clientId && !m.deleted,
        ))
          conn.send({ type: "chat_message", message: msg } as SignalingPacket);
        this.sendChatOperations(conn, room);
      })
      .catch(() => {});
  }

  private sendChatOperations(conn: DataConnection, room: string): void {
    chatLedger
      .operations(room)
      .then((ops) => {
        if (useHubStore.getState().roomId !== room || !conn.open) return;
        const own = ops.filter(
          (o) => o.actorClientId === useHubStore.getState().clientId,
        );
        for (let i = 0; i < own.length; i += 100)
          conn.send({
            type: "chat_operations_sync",
            roomId: room,
            operations: own.slice(i, i + 100),
          } as SignalingPacket);
      })
      .catch(() => {});
  }

  private receiveChatOperations(
    session: PeerMediaSession,
    room: string,
    incoming: ChatOperation[],
  ): void {
    try {
      const state = useHubStore.getState();
      const clean = incoming
        .map((o) => validateOperation(o, room, session.clientId))
        .filter((o) => {
          const target = state.messages.find((m) => m.id === o.messageId);
          if (
            o.kind === "reaction" &&
            target?.authorClientId === state.clientId &&
            !readOwnProfile(state.clientId, state.nickname).privacy
              .allowReactions
          )
            return false;
          return (
            o.kind === "reaction" ||
            !target ||
            target.authorClientId === session.clientId
          );
        });
      chatLedger
        .record(room, clean, session.clientId)
        .then((messages) => {
          if (useHubStore.getState().roomId === room)
            useHubStore.getState().setMessages(messages);
        })
        .catch((error) => console.warn("[Chat] Operação recusada:", error));
    } catch {
      /* Untrusted operations are ignored. */
    }
  }

  public async mutateChat(
    messageId: string,
    kind: ChatOperation["kind"],
    data: { content?: string; emoji?: string; active?: boolean } = {},
  ): Promise<void> {
    const state = useHubStore.getState();
    const message = state.messages.find((m) => m.id === messageId);
    if (!message || message.deleted) throw new Error("Mensagem indisponível.");
    if (kind !== "reaction" && message.authorClientId !== state.clientId)
      throw new Error("Você só pode alterar ou fixar suas próprias mensagens.");
    const author = Object.values(state.participants).find(
      (p) => p.clientId === message.authorClientId,
    );
    if (
      isBlocked(message.authorClientId) ||
      (kind === "reaction" && author?.profile?.interactions.reactions === false)
    )
      throw new Error("Interação não permitida.");
    this.chatClock = Math.max(Date.now(), this.chatClock + 1);
    const op = validateOperation(
      {
        id: crypto.randomUUID(),
        roomId: state.roomId,
        messageId,
        actorClientId: state.clientId,
        nickname: state.nickname,
        at: this.chatClock,
        kind,
        ...data,
      },
      state.roomId,
      state.clientId,
    );
    const messages = await chatLedger.record(
      state.roomId,
      [op],
      state.clientId,
    );
    if (useHubStore.getState().roomId === state.roomId)
      useHubStore.getState().setMessages(messages);
    this.broadcast({ type: "chat_operation", operation: op });
  }

  /* ========================================================================= */
  /* CHAMADAS DE MÍDIA ENTRANTES & SAÍDAS (FULL MESH)                          */
  /* ========================================================================= */

  private handleIncomingMediaCall(call: MediaConnection): void {
    const channel = call.metadata?.channel || "voice";
    const remotePeerId = call.peer;
    const session = this.sessions.get(remotePeerId);
    const ownState = useHubStore.getState();
    if (
      !session ||
      !ownState.inVoiceCall ||
      !["voice", "screen", "webcam"].includes(channel) ||
      isBlocked(session.clientId) ||
      !readOwnProfile(ownState.clientId, ownState.nickname).privacy.allowCalls
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
      const state = useHubStore.getState();
      if (!state.inVoiceCall) {
        // Se o usuário local NÃO está na call de voz, não envia microfone
        call.answer();
      } else {
        const localVoiceStream =
          this.audioPipeline?.getProcessedStream() || this.rawMicStream;
        call.answer(localVoiceStream || undefined);
      }

      if (session) {
        session.voiceCall = call;
      }

      this.patchCallSdp(call, false);

      this.monitorVoiceCall(session, call);
      call.on("stream", (stream) => {
        if (session.voiceCall !== call) return;
        if (session) {
          this.setupPeerVoiceAudio(session, stream);
        }
        useHubStore.getState().setRemoteStream(remotePeerId, "voice", stream);
        useHubStore.getState().setRemoteVoiceStream(stream);
      });

      call.on("close", () => {
        if (session.voiceCall !== call) return;
        if (session) {
          this.teardownPeerVoiceAudio(session);
          session.voiceCall = null;
        }
        useHubStore.getState().setRemoteStream(remotePeerId, "voice", null);
      });
    } else if (channel === "screen") {
      session.screenCall?.close();
      call.answer(); // Atende tela sem enviar vídeo de volta
      if (session) {
        session.screenCall = call;
      }

      this.patchCallSdp(call, true);

      call.on("stream", (stream) => {
        if (session.screenCall !== call) return;
        sounds.playStreamStart();
        useHubStore.getState().setRemoteStream(remotePeerId, "screen", stream);
        useHubStore.getState().setRemoteScreenStream(stream);
        useHubStore
          .getState()
          .updateParticipant(remotePeerId, { isScreenSharing: true });
        useHubStore
          .getState()
          .setTelemetry({ active: true, abrStatus: "optimal" });

        this.startReceiverStats(call.peerConnection, stream);
      });

      call.on("close", () => {
        if (session.screenCall !== call) return;
        session.screenCall = null;
        useHubStore.getState().setRemoteStream(remotePeerId, "screen", null);
        useHubStore.getState().setRemoteScreenStream(null);
        useHubStore
          .getState()
          .updateParticipant(remotePeerId, { isScreenSharing: false });
        useHubStore.getState().setTelemetry({ active: false });
        this.stopReceiverStats();
        sounds.playStreamStop();
      });
    } else if (channel === "webcam") {
      session.webcamCall?.close();
      call.answer();
      if (session) {
        session.webcamCall = call;
      }

      call.on("stream", (stream) => {
        if (session.webcamCall !== call) return;
        useHubStore.getState().setRemoteStream(remotePeerId, "webcam", stream);
        useHubStore
          .getState()
          .updateParticipant(remotePeerId, { isWebcamActive: true });
      });

      call.on("close", () => {
        if (session.webcamCall !== call) return;
        session.webcamCall = null;
        useHubStore.getState().setRemoteStream(remotePeerId, "webcam", null);
        useHubStore
          .getState()
          .updateParticipant(remotePeerId, { isWebcamActive: false });
      });
    }
  }

  private initiateVoiceCallWithPeer(session: PeerMediaSession): void {
    if (!this.localPeer || session.voiceCall || !this.canCallSession(session))
      return;

    const voiceStream =
      this.audioPipeline?.getProcessedStream() || this.rawMicStream;
    if (!voiceStream) return;

    const call = this.localPeer.call(session.peerId, voiceStream, {
      metadata: { channel: "voice" },
    });

    session.voiceCall = call;
    this.patchCallSdp(call, false);

    this.monitorVoiceCall(session, call);
    call.on("stream", (stream) => {
      if (session.voiceCall !== call) return;
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
    let previousReceived = 0,
      previousLost = 0,
      busy = false,
      disconnectedAt = 0;
    session.qualityTimer = window.setInterval(async () => {
      if (
        busy ||
        this.sessions.get(session.peerId) !== session ||
        session.voiceCall !== call
      )
        return;
      busy = true;
      try {
        const pc = call.peerConnection;
        if (!pc) return;
        const stats = await pc.getStats();
        if (session.voiceCall !== call) return;
        let rttMs: number | null = null,
          loss: number | null = null;
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
        });
        useMediaState.setState((s) => ({
          quality: {
            ...s.quality,
            [session.peerId]: { state: pc.connectionState, rttMs, loss },
          },
        }));
        if (pc.connectionState === "disconnected")
          disconnectedAt ||= Date.now();
        else disconnectedAt = 0;
        if (
          pc.connectionState === "failed" ||
          (disconnectedAt && Date.now() - disconnectedAt > 8000)
        ) {
          call.close();
          this.broadcastLocalState();
        }
      } catch {
        /* Stats unavailable: never fabricate quality. */
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
        delete quality[session.peerId];
        return { quality };
      });
      const generation = this.roomGeneration;
      window.setTimeout(
        () => {
          if (
            generation === this.roomGeneration &&
            this.sessions.get(session.peerId) === session &&
            !session.voiceCall &&
            useHubStore.getState().inVoiceCall &&
            useHubStore.getState().participants[session.peerId]?.inVoiceCall
          )
            this.initiateVoiceCallWithPeer(session);
        },
        (this.localPeer?.id || "") < session.peerId ? 500 : 1500,
      );
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
      );
    }
  }

  /* ========================================================================= */
  /* ÁUDIO INDIVIDUAL POR IRMÃO (0% A 100%) & SINK ID                          */
  /* ========================================================================= */

  private setupPeerVoiceAudio(
    session: PeerMediaSession,
    stream: MediaStream,
  ): void {
    this.teardownPeerVoiceAudio(session);

    try {
      // Zera o jitter buffer extra nos receivers de áudio do WebRTC para latência mínima
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

      // Reprodução direta na tag <audio> sem intermediário WebAudio (elimina ~250ms de atraso)
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
      if (outputId && outputId !== "default" && "setSinkId" in audioEl) {
        (audioEl as unknown as { setSinkId: (id: string) => Promise<void> })
          .setSinkId(outputId)
          .catch((e) => mediaError("Saída de áudio indisponível", e));
      }

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

  /* ========================================================================= */
  /* ENTRAR E SAIR DA CHAMADA DE VOZ (INDEPENDENTE DO CHAT)                    */
  /* ========================================================================= */

  public async joinVoiceCall(): Promise<void> {
    const state = useHubStore.getState();
    if (state.inVoiceCall || this.joiningVoice) return;
    const generation = this.roomGeneration;
    this.joiningVoice = true;
    try {
      await this.setupLocalMicrophone();
    } catch {
      this.joiningVoice = false;
      return;
    }
    this.joiningVoice = false;
    if (generation !== this.roomGeneration || !this.rawMicStream?.active)
      return;
    sounds.playJoin();

    useHubStore.getState().setInVoiceCall(true);
    if (this.localPeer) {
      useHubStore
        .getState()
        .updateParticipant(this.localPeer.id, { inVoiceCall: true });
    }

    // Notifica todos os irmãos da sala via peer_state_sync
    this.broadcastLocalState();

    // Inicia chamadas de voz com todos os irmãos que já estão em chamada
    for (const session of this.sessions.values()) {
      const p = useHubStore.getState().participants[session.peerId];
      if (p && p.inVoiceCall && !session.voiceCall) {
        this.initiateVoiceCallWithPeer(session);
      }
    }
  }

  public leaveVoiceCall(): void {
    const state = useHubStore.getState();
    this.micGeneration++;
    this.joiningVoice = false;
    this.cameraGeneration++;
    this.screenGeneration++;
    useMediaState.setState({
      microphoneBusy: false,
      cameraBusy: false,
      screenBusy: false,
    });
    soundboardEngine.stopAll();
    this.audioPipeline?.destroy();
    this.audioPipeline = null;
    this.rawMicStream?.getTracks().forEach((t) => t.stop());
    this.rawMicStream = null;
    state.setLocalVoiceStream(null);
    state.setIsLocalSpeaking(false, 0);
    if (!state.inVoiceCall) return;
    state.setInVoiceCall(false);
    sounds.playLeave();

    if (state.isScreenSharing) {
      this.stopScreenShare();
    }

    if (state.isWebcamActive) {
      this.toggleWebcam().catch(() => {});
    }

    // Encerra mídia, preservando as DataConnections do chat.
    for (const session of this.sessions.values()) {
      this.closeBlockedMedia(session);
      if (session.voiceCall) {
        try {
          session.voiceCall.close();
        } catch {
          /* ignore */
        }
        session.voiceCall = null;
      }
      this.teardownPeerVoiceAudio(session);
    }

    useHubStore.getState().setInVoiceCall(false);
    useHubStore.getState().setRemoteVoiceStream(null);

    if (this.localPeer) {
      useHubStore
        .getState()
        .updateParticipant(this.localPeer.id, { inVoiceCall: false });
    }

    // Notifica todos os irmãos mantendo o chat ativo!
    this.broadcastLocalState();
  }

  private canCallSession(session: PeerMediaSession): boolean {
    const state = useHubStore.getState();
    return (
      state.inVoiceCall &&
      state.participants[session.peerId]?.inVoiceCall === true &&
      !isBlocked(session.clientId) &&
      readOwnProfile(state.clientId, state.nickname).privacy.allowCalls &&
      state.participants[session.peerId]?.profile?.interactions.calls !== false
    );
  }

  private closeBlockedMedia(session: PeerMediaSession): void {
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
      state.updateParticipant(this.localPeer.id, {
        nickname: profile.displayName,
        avatarColor: profile.appearance.color,
      });
    this.broadcastLocalState();
    for (const session of this.sessions.values()) {
      if (isBlocked(session.clientId) || !profile.privacy.allowCalls)
        this.closeBlockedMedia(session);
      if (isBlocked(session.clientId)) {
        useHubStore
          .getState()
          .updateParticipant(session.peerId, { profile: null });
      } else this.sendProfileToSession(session);
    }
  }

  private broadcastLocalState(): void {
    if (!this.localPeer) return;
    const state = useHubStore.getState();
    const local = state.participants[this.localPeer.id];
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

  // Compatibilidade legada
  public sendData(msg: { type: string; [key: string]: unknown }): void {
    if (msg.type === "nickname" && typeof msg.name === "string") {
      useHubStore.getState().setNickname(msg.name);
      if (this.localPeer) {
        useHubStore
          .getState()
          .updateParticipant(this.localPeer.id, { nickname: msg.name });
      }
      this.broadcastLocalState();
    } else if (msg.type === "speaking") {
      this.broadcast({
        type: "speaking",
        peerId: this.localPeer?.id || "",
        isSpeaking: Boolean(msg.isSpeaking),
      });
    }
  }

  /* ========================================================================= */
  /* CONTROLES DE MÍDIA LOCAL (MUTE, DEAFEN, WEBCAM, SCREEN SHARE)             */
  /* ========================================================================= */

  public toggleMute(muted?: boolean): void {
    const state = useHubStore.getState();
    const nextMuted = muted !== undefined ? muted : !state.isMuted;
    useHubStore.getState().setMuted(nextMuted);

    // Ajusta o ganho do microfone no pipeline WebAudio (sem cortar o Soundboard!)
    this.audioPipeline?.setMicMuted(nextMuted);

    if (nextMuted) {
      sounds.playMute();
    } else {
      sounds.playUnmute();
    }

    if (this.localPeer) {
      useHubStore
        .getState()
        .updateParticipant(this.localPeer.id, { isMuted: nextMuted });
    }
    this.broadcastLocalState();
  }

  public toggleDeafen(deafened?: boolean): void {
    const state = useHubStore.getState();
    const nextDeafened = deafened !== undefined ? deafened : !state.isDeafened;
    useHubStore.getState().setDeafened(nextDeafened);

    // Atualiza o elemento de áudio de todas as sessões para silenciar imediatamente se deafened
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

    // Se ativou Deafen, muta microfone automaticamente (igual ao Discord)
    if (nextDeafened && !state.isMuted) {
      this.toggleMute(true);
    }

    if (this.localPeer) {
      useHubStore
        .getState()
        .updateParticipant(this.localPeer.id, { isDeafened: nextDeafened });
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
        useHubStore
          .getState()
          .updateParticipant(this.localPeer.id, { isWebcamActive: false });
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
          useHubStore
            .getState()
            .updateParticipant(this.localPeer.id, { isWebcamActive: true });
        }
        this.broadcastLocalState();

        // Envia chamada de webcam para irmãos em call de voz
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
        useHubStore.getState().updateParticipant(this.localPeer.id, {
          isScreenSharing: true,
          screenQualityLabel: `${qualityConfig.resolution} ${qualityConfig.fps}FPS`,
        });
      }
      this.broadcastLocalState();

      // Envia stream de tela para todos os irmãos na chamada
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
      useHubStore.getState().updateParticipant(this.localPeer.id, {
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
  /* MICROFONE LOCAL & PIPELINE DE ÁUDIO                                       */
  /* ========================================================================= */

  public async setupLocalMicrophone(): Promise<void> {
    const generation = ++this.micGeneration;
    let stream: MediaStream | null = null;
    let pipeline: VoiceAudioPipeline | null = null;
    useMediaState.setState({ microphoneBusy: true, error: null });
    try {
      const audioConfig = useHubStore.getState().audioConfig;
      const useSuppression = Boolean(audioConfig.neuralNoiseGate);
      const constraints: MediaStreamConstraints = {
        audio: {
          deviceId:
            audioConfig.inputDeviceId !== "default"
              ? { exact: audioConfig.inputDeviceId }
              : undefined,
          echoCancellation: audioConfig.echoCancellation,
          autoGainControl: audioConfig.autoGainControl,
          noiseSuppression: useSuppression,
          sampleRate: 48000,
          channelCount: 1,
        },
      };

      stream = await navigator.mediaDevices.getUserMedia(constraints);
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
              .updateParticipant(this.localPeer.id, { isSpeaking });
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
      pipeline.setMicMuted(useHubStore.getState().isMuted);
      const processed = await pipeline.initialize();
      if (generation !== this.micGeneration) {
        pipeline.destroy();
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const newTrack = processed.getAudioTracks()[0];
      const senders = [...this.sessions.values()].flatMap(
        (session) =>
          session.voiceCall?.peerConnection
            .getSenders()
            .filter((sender) => sender.track?.kind === "audio") || [],
      );
      const oldTrack = this.audioPipeline
        ?.getProcessedStream()
        ?.getAudioTracks()[0];
      const replacements = await Promise.allSettled(
        senders.map((sender) => sender.replaceTrack(newTrack)),
      );
      const failure = replacements.find(
        (result) => result.status === "rejected",
      );
      if (failure?.status === "rejected") {
        await Promise.allSettled(
          senders.map((sender) => sender.replaceTrack(oldTrack || null)),
        );
        throw failure.reason;
      }
      if (generation !== this.micGeneration) {
        pipeline.destroy();
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      soundboardEngine.stopAll();
      this.audioPipeline?.destroy();
      this.rawMicStream?.getTracks().forEach((t) => t.stop());
      pipeline.setMicMuted(useHubStore.getState().isMuted);
      this.audioPipeline = pipeline;
      this.rawMicStream = stream;
      stream.getAudioTracks()[0].onended = () => {
        if (this.rawMicStream === stream) {
          this.leaveVoiceCall();
          mediaError(
            "Microfone desconectado",
            "Selecione um dispositivo e entre novamente.",
          );
        }
      };
      useHubStore.getState().setLocalVoiceStream(processed);
      soundboardEngine.registerPipelineHooks(
        () => this.audioPipeline?.getAudioContext() ?? null,
        () => this.audioPipeline?.getSoundboardInputNode() ?? null,
      );
    } catch (error) {
      pipeline?.destroy();
      stream?.getTracks().forEach((t) => t.stop());
      mediaError("Microfone indisponível", error);
      throw error;
    } finally {
      if (generation === this.micGeneration)
        useMediaState.setState({ microphoneBusy: false });
    }
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

    // Se o usuário ligou/desligou a supressão de ruído, aplica ao vivo na trilha do microfone
    if (typeof partial.neuralNoiseGate === "boolean" && this.rawMicStream) {
      const audioTrack = this.rawMicStream.getAudioTracks()[0];
      if (audioTrack && typeof audioTrack.applyConstraints === "function") {
        audioTrack
          .applyConstraints({ noiseSuppression: partial.neuralNoiseGate })
          .catch(() => {});
      }
    }

    // Se atualizou remoteStreamVolume ou outputDeviceId, aplica em todas as sessões
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

      if (
        partial.outputDeviceId &&
        session.voiceAudioEl &&
        "setSinkId" in session.voiceAudioEl
      ) {
        (
          session.voiceAudioEl as unknown as {
            setSinkId: (id: string) => Promise<void>;
          }
        )
          .setSinkId(partial.outputDeviceId)
          .catch((error) => mediaError("Saída de áudio indisponível", error));
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

  private startAbrLoop(
    pc: RTCPeerConnection,
    sender: RTCRtpSender,
    config: VideoQualityConfig,
  ): void {
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
        let fps = config.fps;
        let bitrateMbps = 0;
        let rttMs = 20;
        let packetsLostPercent = 0;

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
            if (typeof report.currentRoundTripTime === "number") {
              rttMs = Math.round(report.currentRoundTripTime * 1000);
            }
          }

          if (report.type === "remote-inbound-rtp" && report.kind === "video") {
            const packetsLost = report.packetsLost || 0;
            const packetsReceived = report.packetsReceived || 0;
            const total = packetsLost + packetsReceived;
            if (total > 0) {
              packetsLostPercent = Math.max(
                0,
                Number(((packetsLost / total) * 100).toFixed(1)),
              );
            }
          }
        });

        let abrStatus: "optimal" | "throttled" | "recovering" =
          useHubStore.getState().telemetry.abrStatus;

        if (packetsLostPercent > 4.0 || rttMs > 120) {
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
        } else if (packetsLostPercent < 0.5 && rttMs <= 100) {
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

        useHubStore.getState().setTelemetry({
          active: true,
          resolution: `${config.resolution} (${config.width}x${config.height})`,
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

  private startReceiverStats(pc: RTCPeerConnection, stream: MediaStream): void {
    this.stopReceiverStats();
    this.prevReceiverBytes = 0;
    this.prevReceiverTimestamp = performance.now();

    this.receiverStatsIntervalId = window.setInterval(async () => {
      try {
        const stats = await pc.getStats();
        let fps = 60;
        let bitrateMbps = 0;
        let rttMs = 18;
        let packetsLostPercent = 0;
        let resolution = "1080p";

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
            if (typeof report.currentRoundTripTime === "number") {
              rttMs = Math.round(report.currentRoundTripTime * 1000);
            }
          }
        });

        useHubStore.getState().setTelemetry({
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

  private stopReceiverStats(): void {
    if (this.receiverStatsIntervalId !== null) {
      clearInterval(this.receiverStatsIntervalId);
      this.receiverStatsIntervalId = null;
    }
  }

  /* ========================================================================= */
  /* MÉTODOS PÚBLICOS DE CHAT E SOUNDBOARD                                     */
  /* ========================================================================= */

  public async sendChatMessage(
    content: string,
    replyTo?: string,
  ): Promise<ChatMessage | null> {
    if (!useHubStore.getState().roomId) throw new Error("Entre em uma sala para enviar mensagens.");
    await storageDb.requirePersistentStorage();
    const trimmed = content.trim();
    if (!trimmed) return null;
    if (trimmed.length > 8000)
      throw new Error("Limite de 8000 caracteres por mensagem.");

    const state = useHubStore.getState();
    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : "msg-" + Date.now();

    const msg: ChatMessage = {
      id,
      roomId: state.roomId,
      type: "user",
      ...(replyTo ? { replyTo } : {}),
      delivery: "queued",
      authorClientId: state.clientId,
      authorNickname: state.nickname,
      authorAvatarColor: state.avatarColor,
      content: trimmed,
      createdAt: Date.now(),
      reactions: {},
    };

    await storageDb.saveMessage(msg);
    useHubStore.getState().addMessage(msg);

    this.broadcast({
      type: "chat_message",
      message: msg,
    });

    return msg;
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
    this.broadcast({
      type: "chat_typing",
      clientId: state.clientId,
      nickname: state.nickname,
      isTyping,
    });
  }

  public async triggerSoundboardClip(clip: SoundboardClip): Promise<void> {
    const state = useHubStore.getState();

    // Reproduz localmente e injeta no WebRTC
    await soundboardEngine.playClip(clip);

    if (this.localPeer) {
      // Exibe animação visual flutuante localmente
      useHubStore.getState().updateParticipant(this.localPeer.id, {
        activeSoundEffect: {
          emoji: clip.emoji,
          name: clip.name,
          expiresAt: Date.now() + 3500,
        },
      });

      // Notifica todos os irmãos para exibirem o badge animado
      this.broadcast({
        type: "soundboard_triggered",
        peerId: this.localPeer.id,
        clientId: state.clientId,
        nickname: state.nickname,
        emoji: clip.emoji,
        soundName: clip.name,
      });

      soundActivity(state.roomId,state.clientId,state.nickname,clip.emoji,clip.name);

      window.setTimeout(() => {
        const current =
          useHubStore.getState().participants[this.localPeer?.id || ""];
        if (current?.activeSoundEffect?.name === clip.name) {
          useHubStore
            .getState()
            .updateParticipant(this.localPeer!.id, { activeSoundEffect: null });
        }
      }, 3600);
    }
  }

  public async loadSoundboardClips(): Promise<void> {
    await soundboardEngine.loadAllClips();
  }

  /* ========================================================================= */
  /* ENCERRAMENTO COMPLETO DA SALA                                             */
  /* ========================================================================= */

  public leaveRoom(): void {
    this.roomGeneration++;
    this.micGeneration++;
    this.cameraGeneration++;
    this.screenGeneration++;
    this.currentRoomSlug = "";
    this.joiningVoice = false;
    if (this.recoveryTimer !== null) clearTimeout(this.recoveryTimer);
    this.recoveryTimer = null;
    useMediaState.setState({
      microphoneBusy: false,
      cameraBusy: false,
      screenBusy: false,
      reconnecting: false,
      quality: {},
    });
    const leavingPeer = this.localPeer;
    this.localPeer = null;
    if (this.beaconHealTimeout !== null) {
      clearTimeout(this.beaconHealTimeout);
      this.beaconHealTimeout = null;
    }

    this.stopScreenShare();
    this.stopReceiverStats();
    soundboardEngine.stopAll();

    if (this.localWebcamStream) {
      this.localWebcamStream.getTracks().forEach((t) => t.stop());
      this.localWebcamStream = null;
    }

    if (this.audioPipeline) {
      this.audioPipeline.destroy();
      this.audioPipeline = null;
    }

    if (this.rawMicStream) {
      this.rawMicStream.getTracks().forEach((t) => t.stop());
      this.rawMicStream = null;
    }

    // Encerra todas as sessões mesh ativas
    const leavingSessions = [...this.sessions.values()];
    this.sessions.clear();
    for (const session of leavingSessions) {
      this.closeBlockedMedia(session);
      this.teardownPeerVoiceAudio(session);
      if (session.voiceCall) {
        try {
          session.voiceCall.close();
        } catch {
          /* ignore */
        }
      }
      if (session.webcamCall) {
        try {
          session.webcamCall.close();
        } catch {
          /* ignore */
        }
      }
      if (session.screenCall) {
        try {
          session.screenCall.close();
        } catch {
          /* ignore */
        }
      }
      if (session.dataConn) {
        try {
          session.dataConn.close();
        } catch {
          /* ignore */
        }
      }
    }
    this.sessions.clear();

    if (this.beaconPeer) {
      try {
        this.beaconPeer.destroy();
      } catch {
        /* ignore */
      }
      this.beaconPeer = null;
      this.isBeaconOwner = false;
    }

    if (leavingPeer) {
      try {
        leavingPeer.destroy();
      } catch {
        /* ignore */
      }
      this.localPeer = null;
    }

    sounds.playLeave();
    useHubStore.getState().resetSession();
  }
}

export const webrtcEngine = new WebRTCEngine();
