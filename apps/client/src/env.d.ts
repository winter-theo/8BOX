interface ImportMetaEnv {
  /** Base HTTP URL of the game server, e.g. http://localhost:3000. */
  readonly VITE_SERVER_URL?: string;
  /** Clerk publishable key (pk_…): Google sign-in. Without it, only the dev login exists. */
  readonly VITE_CLERK_PUBLISHABLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
