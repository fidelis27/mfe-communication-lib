import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  loadRemote,
  markRemoteReady,
  REMOTE_LOAD_EVENT,
  REMOTE_READY_EVENT,
  type RemoteLoadEvent,
} from "./remoteLoadingMetrics";

describe("remote loading metrics", () => {
  const events: RemoteLoadEvent[] = [];
  const listener = (event: Event) => {
    events.push((event as CustomEvent<RemoteLoadEvent>).detail);
  };

  beforeEach(() => {
    events.length = 0;
    window.addEventListener(REMOTE_LOAD_EVENT, listener);
  });

  afterEach(() => {
    window.removeEventListener(REMOTE_LOAD_EVENT, listener);
    vi.restoreAllMocks();
  });

  it("records start, completion and duration for a successful remote import", async () => {
    const result = { default: "RemoteApp" };
    const importer = vi.fn().mockResolvedValue(result);

    await expect(loadRemote("student", importer)).resolves.toBe(result);

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ remoteName: "student", phase: "start" });
    expect(events[1]).toMatchObject({
      remoteName: "student",
      attempt: events[0].attempt,
      phase: "success",
    });
    if (events[1].phase === "start") throw new Error("Expected a completion event");
    expect(events[1].endedAt).toBeGreaterThanOrEqual(events[1].startedAt);
    expect(events[1].duration).toBeGreaterThanOrEqual(0);
    expect(
      performance.getEntriesByName(`mfe:remote:student:${events[0].attempt}:duration`, "measure"),
    ).toHaveLength(1);
  });

  it("records import errors and rethrows them for the error boundary", async () => {
    const error = new Error("Remote import failed");

    await expect(loadRemote("activity", () => Promise.reject(error))).rejects.toBe(error);

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ remoteName: "activity", phase: "start" });
    expect(events[1]).toMatchObject({
      remoteName: "activity",
      attempt: events[0].attempt,
      phase: "error",
    });
  });

  it("dispatches a dedicated ready event when the module commits", () => {
    const listener = vi.fn();
    window.addEventListener(REMOTE_READY_EVENT, listener);

    markRemoteReady("activity");

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0]).toMatchObject({
      type: REMOTE_READY_EVENT,
      detail: { remoteName: "activity" },
    });

    window.removeEventListener(REMOTE_READY_EVENT, listener);
  });
});
