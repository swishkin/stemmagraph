/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DATA_ADAPTER: 'mock' | 'rest' | 'supabase';
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /**
   * Deployment-level default UI language ('id' or 'en'). Set at build
   * time (e.g. the Docker build passes VITE_UI_LANG=en). A language the
   * user picked in the UI (localStorage) still takes precedence.
   */
  readonly VITE_UI_LANG?: 'id' | 'en' | string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
