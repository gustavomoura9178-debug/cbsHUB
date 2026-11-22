import { createClient } from "@supabase/supabase-js";

export type DbOnlineStatus = "online" | "idle" | "invisible";

export type DbProfileRow = {
  id: string;
  nickname: string;
  avatar_color: string;
  online_status: DbOnlineStatus;
  custom_status: string | null;
  created_at: string;
  updated_at: string;
};

export type DbFriendshipStatus =
  | "pending"
  | "pending_sent"
  | "pending_received"
  | "accepted"
  | "rejected";

export type DbFriendshipRow = {
  id: string;
  user_id: string;
  friend_id: string;
  status: DbFriendshipStatus;
  created_at: string;
  updated_at: string;
};

export type DbDmChannelRow = {
  id: string;
  created_at: string;
};

export type DbMessageRow = {
  id: string;
  channel_id: string;
  sender_id: string;
  content: string;
  file_url: string | null;
  file_name: string | null;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
  updated_at: string;
};

export type DbSignalingCallRow = {
  id: string;
  caller_id: string;
  receiver_id: string;
  caller_peer_id: string | null;
  receiver_peer_id: string | null;
  status: "calling" | "accepted" | "rejected" | "ended";
  created_at: string;
  updated_at: string;
};

export type DbUserSettingsRow = {
  user_id: string;
  audio_config: Record<string, unknown> | null;
  video_config: Record<string, unknown> | null;
  soundboard_favorites: string[] | null;
  updated_at: string;
};

export type DbRoomRow = {
  id: string;
  slug: string;
  name: string;
  created_by: string | null;
  created_at: string;
};

export type DbRoomMessageRow = {
  id: string;
  room_id: string;
  sender_id: string;
  content: string;
  file_url: string | null;
  file_name: string | null;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
  updated_at?: string;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: DbProfileRow;
        Insert: {
          id: string;
          nickname: string;
          avatar_color?: string;
          online_status?: DbOnlineStatus;
          custom_status?: string | null;
        };
        Update: {
          nickname?: string;
          avatar_color?: string;
          online_status?: DbOnlineStatus;
          custom_status?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      friendships: {
        Row: DbFriendshipRow;
        Insert: {
          user_id: string;
          friend_id: string;
          status?: DbFriendshipStatus;
        };
        Update: {
          user_id?: string;
          friend_id?: string;
          status?: DbFriendshipStatus;
          updated_at?: string;
        };
        Relationships: [];
      };
      dm_channels: {
        Row: DbDmChannelRow;
        Insert: {
          id?: string;
        };
        Update: {
          id?: string;
        };
        Relationships: [];
      };
      messages: {
        Row: DbMessageRow;
        Insert: {
          id?: string;
          channel_id: string;
          sender_id: string;
          content: string;
          file_url?: string | null;
          file_name?: string | null;
          file_type?: string | null;
          file_size?: number | null;
        };
        Update: {
          content?: string;
          file_url?: string | null;
          file_name?: string | null;
          file_type?: string | null;
          file_size?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      signaling_calls: {
        Row: DbSignalingCallRow;
        Insert: {
          id?: string;
          caller_id: string;
          receiver_id: string;
          caller_peer_id?: string | null;
          receiver_peer_id?: string | null;
          status?: "calling" | "accepted" | "rejected" | "ended";
        };
        Update: {
          caller_peer_id?: string | null;
          receiver_peer_id?: string | null;
          status?: "calling" | "accepted" | "rejected" | "ended";
          updated_at?: string;
        };
        Relationships: [];
      };
      user_settings: {
        Row: DbUserSettingsRow;
        Insert: {
          user_id: string;
          audio_config?: Record<string, unknown> | null;
          video_config?: Record<string, unknown> | null;
          soundboard_favorites?: string[] | null;
          updated_at?: string;
        };
        Update: {
          audio_config?: Record<string, unknown> | null;
          video_config?: Record<string, unknown> | null;
          soundboard_favorites?: string[] | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      rooms: {
        Row: DbRoomRow;
        Insert: {
          id?: string;
          slug: string;
          name: string;
          created_by?: string | null;
        };
        Update: {
          slug?: string;
          name?: string;
        };
        Relationships: [];
      };
      room_messages: {
        Row: DbRoomMessageRow;
        Insert: {
          id?: string;
          room_id: string;
          sender_id: string;
          content: string;
          file_url?: string | null;
          file_name?: string | null;
          file_type?: string | null;
          file_size?: number | null;
        };
        Update: {
          content?: string;
          file_url?: string | null;
          file_name?: string | null;
          file_type?: string | null;
          file_size?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      get_or_create_dm_channel: {
        Args: { target_user_id: string };
        Returns: string;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.SUPABASE_URL ||
  "https://bmzxnwebrebgpisrcliu.supabase.co";

export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_jnx8R0ujrZGLybdcno_zEw_BbxERTxz";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});
