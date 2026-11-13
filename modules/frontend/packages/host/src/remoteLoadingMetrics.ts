export type RemoteReadyEvent = {
  remoteName: string;
  readyAt: number;
};

export const REMOTE_READY_EVENT = "mfe:remote-ready";

export function markRemoteReady(remoteName: string) {
  if (typeof window === "undefined") return;

  const readyAt = performance.now();
  performance.mark(`mfe:remote:${remoteName}:ready`);
  window.dispatchEvent(
    new CustomEvent<RemoteReadyEvent>(REMOTE_READY_EVENT, {
      detail: { remoteName, readyAt },
    }),
  );
}
