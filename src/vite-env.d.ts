/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_METERED_TURN_URL?: string;
  readonly VITE_METERED_TURNS_URL?: string;
  readonly VITE_METERED_USERNAME?: string;
  readonly VITE_METERED_CREDENTIAL?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly SUPABASE_URL?: string;
  readonly SUPABASE_PUBLISHABLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
