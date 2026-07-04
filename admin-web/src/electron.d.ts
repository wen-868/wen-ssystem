export interface ElectronAPI {
  getApiBase: () => Promise<string>;
  openExternal: (url: string) => Promise<void>;
  showMessage: (options: { type?: string; title?: string; message?: string; buttons?: string[] }) => Promise<{ response: number }>;
  platform: string;
  versions: { electron: string; chrome: string; node: string };
  apiBase?: string;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
