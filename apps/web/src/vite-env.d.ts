/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Origem do WebSocket (ex.: wss://api.exemplo.com) quando a API não está na mesma origem da página. */
  readonly VITE_WS_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
