import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { markRemoteReady, REMOTE_READY_EVENT, type RemoteReadyEvent } from "./remoteLoadingMetrics";

describe("remote loading metrics", () => {
  beforeEach(() => {
    vi.spyOn(performance, "mark");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("marks the remote ready after its module commits", () => {
    let received: RemoteReadyEvent | undefined;
    const listener = (event: Event) => {
      received = (event as CustomEvent<RemoteReadyEvent>).detail;
    };
    window.addEventListener(REMOTE_READY_EVENT, listener);

    markRemoteReady("activity");

    expect(received).toMatchObject({ remoteName: "activity", readyAt: expect.any(Number) });
    expect(performance.mark).toHaveBeenCalledWith("mfe:remote:activity:ready");

    window.removeEventListener(REMOTE_READY_EVENT, listener);
  });
});
