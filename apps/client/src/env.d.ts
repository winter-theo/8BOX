interface ImportMetaEnv {
  /** Base HTTP URL of the game server, e.g. http://localhost:3000. */
  readonly VITE_SERVER_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
