/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API base URL for a two-service deploy; empty when the API serves the web. */
  readonly VITE_API_BASE?: string;
  /** The commit this bundle was built from (injected in vite.config); "dev" locally. */
  readonly VITE_COMMIT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
