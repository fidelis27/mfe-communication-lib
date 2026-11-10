export type RemoteLoadEvent =
  | {
      remoteName: string;
      attempt: number;
      phase: "start";
      startedAt: number;
    }
  | {
      remoteName: string;
      attempt: number;
      phase: "success" | "error";
      startedAt: number;
      endedAt: number;
      duration: number;
    };

export const REMOTE_LOAD_EVENT = "mfe:remote-load";
export const REMOTE_READY_EVENT = "mfe:remote-ready";

let nextAttempt = 0;

export function markRemoteReady(remoteName: string) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent(REMOTE_READY_EVENT, {
      detail: {
        remoteName,
        readyAt: performance.now(),
      },
    }),
  );
}

function publishRemoteLoadEvent(detail: RemoteLoadEvent) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(REMOTE_LOAD_EVENT, { detail }));
  }
}

export function loadRemote<TModule>(remoteName: string, importer: () => Promise<TModule>) {
  const attempt = ++nextAttempt;
  const startedAt = performance.now();
  const markPrefix = `mfe:remote:${remoteName}:${attempt}`;
  const startMark = `${markPrefix}:start`;
  const endMark = `${markPrefix}:end`;

  performance.mark(startMark);
  publishRemoteLoadEvent({ remoteName, attempt, phase: "start", startedAt });

  const finish = (phase: "success" | "error") => {
    const endedAt = performance.now();
    performance.mark(endMark);
    performance.measure(`${markPrefix}:duration`, startMark, endMark);
    publishRemoteLoadEvent({
      remoteName,
      attempt,
      phase,
      startedAt,
      endedAt,
      duration: endedAt - startedAt,
    });
  };

  return importer().then(
    (module) => {
      finish("success");
      return module;
    },
    (error: unknown) => {
      finish("error");
      throw error;
    },
  );
}
