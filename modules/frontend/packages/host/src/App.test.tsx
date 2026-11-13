import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { StrictMode } from "react";
import { vi } from "vitest";
import {
  REMOTE_LOAD_EVENT,
  REMOTE_READY_EVENT,
  type RemoteLoadEvent,
} from "./remoteLoadingMetrics";

vi.mock("@lib-core-mfe/module-frontend/client", async () => {
  const React = await import("react");
  const { default: RemoteAppMock } = await import("./__mocks__/RemoteAppMock");

  function ModuleMock({
    moduleLifeCycleEvent,
  }: {
    moduleLifeCycleEvent?: { onMounted?: () => void };
  }) {
    const onMounted = moduleLifeCycleEvent?.onMounted;

    React.useEffect(() => {
      onMounted?.();
    }, [onMounted]);

    return React.createElement(RemoteAppMock);
  }

  return { Module: ModuleMock };
});

const authMocks = vi.hoisted(() => ({
  initializeAuth: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  subscribeToAuthState: vi.fn(),
  useDomainEvents: vi.fn(() => ({ events: [], connection: "connected" })),
}));

vi.mock("@mfe/shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@mfe/shared")>()),
  ...authMocks,
}));

import { listen, type DomainEvent } from "@mfe/shared";

async function renderHost(options: { authenticated: boolean; path?: string }) {
  vi.resetModules();
  vi.stubEnv("VITE_SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "public-key");
  window.history.pushState({}, "", options.path ?? "/estudantes");
  authMocks.initializeAuth.mockResolvedValue(options.authenticated);
  authMocks.subscribeToAuthState.mockReturnValue(() => {});

  const { default: App } = await import("./App");
  return render(<App />);
}

describe("Host navigation", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    Reflect.deleteProperty(globalThis, "__mfeBus");
  });

  it("renders module links with real href targets", async () => {
    await renderHost({ authenticated: true, path: "/admin" });

    await waitFor(() => expect(screen.getByTestId("remote-mock")).toBeInTheDocument());
    expect(document.activeElement).not.toBe(screen.getByRole("heading", { name: "Remote module" }));

    expect(screen.getByRole("link", { name: /estudantes/i })).toHaveAttribute(
      "href",
      "/estudantes",
    );
    expect(screen.getByRole("link", { name: /instituições/i })).toHaveAttribute(
      "href",
      "/instituicoes",
    );
    expect(screen.getByRole("link", { name: /admin/i })).toHaveAttribute("aria-current", "page");
  });

  it("starts the domain event connection after an authenticated session is ready", async () => {
    await renderHost({ authenticated: true });

    expect(authMocks.useDomainEvents).toHaveBeenNthCalledWith(1, "");
    await waitFor(() =>
      expect(authMocks.useDomainEvents).toHaveBeenLastCalledWith("http://localhost:3333"),
    );
  });

  it.each([
    ["student", "/estudantes"],
    ["institution", "/instituicoes"],
    ["dashboard", "/dashboard"],
    ["admin", "/admin"],
  ])("records load timing for the %s remote", async (remoteName, path) => {
    const events: RemoteLoadEvent[] = [];
    const listener = (event: Event) => {
      events.push((event as CustomEvent<RemoteLoadEvent>).detail);
    };
    window.addEventListener(REMOTE_LOAD_EVENT, listener);

    try {
      await renderHost({ authenticated: true, path });

      await waitFor(() =>
        expect(
          events.some((event) => event.remoteName === remoteName && event.phase === "success"),
        ).toBe(true),
      );
      expect(events[0]).toMatchObject({ remoteName, phase: "start" });
    } finally {
      window.removeEventListener(REMOTE_LOAD_EVENT, listener);
    }
  });

  it("records the activity remote as ready after it mounts", async () => {
    const readyEvents: { remoteName: string; readyAt: number }[] = [];
    const listener = (event: Event) => {
      readyEvents.push((event as CustomEvent<(typeof readyEvents)[number]>).detail);
    };
    window.addEventListener(REMOTE_READY_EVENT, listener);

    try {
      await renderHost({ authenticated: true, path: "/atividade" });

      await waitFor(() =>
        expect(readyEvents).toContainEqual(
          expect.objectContaining({ remoteName: "activity", readyAt: expect.any(Number) }),
        ),
      );
    } finally {
      window.removeEventListener(REMOTE_READY_EVENT, listener);
    }
  });

  it("updates history with client-side navigation on plain clicks", async () => {
    await renderHost({ authenticated: true, path: "/estudantes" });

    await waitFor(() => expect(screen.getByTestId("remote-mock")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("link", { name: /dashboard/i }));

    await waitFor(() =>
      expect(screen.getByRole("link", { name: /dashboard/i })).toHaveAttribute(
        "aria-current",
        "page",
      ),
    );
    expect(window.location.pathname).toBe("/dashboard");
  });

  it("renders a working breadcrumb to the dashboard", async () => {
    await renderHost({ authenticated: true, path: "/estudantes" });

    await waitFor(() => expect(screen.getByTestId("remote-mock")).toBeInTheDocument());

    const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
    const homeLink = within(breadcrumb).getByRole("link", { name: "Início" });
    expect(homeLink).toHaveAttribute("href", "/dashboard");

    fireEvent.click(homeLink);

    await waitFor(() => expect(window.location.pathname).toBe("/dashboard"));
    expect(within(breadcrumb).getByRole("listitem", { current: "page" })).toHaveTextContent(
      "Dashboard",
    );
  });

  it("opens the mobile drawer, closes it on navigation, and focuses the page heading", async () => {
    await renderHost({ authenticated: true, path: "/estudantes" });

    await waitFor(() => expect(screen.getByTestId("remote-mock")).toBeInTheDocument());

    const toggle = screen.getByRole("button", { name: "Menu" });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    const moduleNavigation = screen.getByRole("navigation", { name: "Módulos da secretaria" });
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(moduleNavigation).getByRole("link", { name: /estudantes/i }),
      ),
    );

    fireEvent.click(within(moduleNavigation).getByRole("link", { name: /dashboard/i }));

    await waitFor(() => expect(window.location.pathname).toBe("/dashboard"));
    expect(screen.getByRole("button", { name: "Menu" })).toHaveAttribute("aria-expanded", "false");
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Remote module" })),
    );
  });

  it("closes the mobile drawer on Escape and restores focus to its toggle", async () => {
    await renderHost({ authenticated: true, path: "/estudantes" });

    await waitFor(() => expect(screen.getByTestId("remote-mock")).toBeInTheDocument());

    const toggle = screen.getByRole("button", { name: "Menu" });
    fireEvent.click(toggle);
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(screen.getByRole("navigation", { name: "Módulos da secretaria" })).getByRole(
          "link",
          { name: /estudantes/i },
        ),
      ),
    );

    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => expect(toggle).toHaveAttribute("aria-expanded", "false"));
    expect(document.activeElement).toBe(toggle);
  });

  it("provides an accessible account menu that closes on Escape", async () => {
    await renderHost({ authenticated: true, path: "/admin" });

    await waitFor(() => expect(screen.getByTestId("remote-mock")).toBeInTheDocument());

    const accountToggle = screen.getByRole("button", { name: "Conta" });
    fireEvent.click(accountToggle);
    expect(accountToggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Sair" })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => expect(accountToggle).toHaveAttribute("aria-expanded", "false"));
    expect(document.activeElement).toBe(accountToggle);
  });

  it("publishes each domain event only once, including under StrictMode", async () => {
    const received: string[] = [];
    const unsubscribe = listen("domain", "STUDENT_CREATED", (payload) => {
      received.push(payload.id);
    });

    const eventOne: DomainEvent<"STUDENT_CREATED"> = {
      eventId: "event-1",
      type: "STUDENT_CREATED",
      version: 1,
      source: "test",
      correlationId: "test",
      occurredAt: "2026-01-01T00:00:00.000Z",
      payload: { id: "student-1", name: "Ana", institutionId: "institution-1", status: "active" },
    };
    const eventTwo: DomainEvent<"STUDENT_CREATED"> = {
      ...eventOne,
      eventId: "event-2",
      payload: { ...eventOne.payload, id: "student-2" },
    };

    authMocks.useDomainEvents.mockReturnValue({
      events: [],
      connection: "connected",
    });
    vi.stubEnv("VITE_SUPABASE_URL", "https://project.supabase.co");
    vi.stubEnv("VITE_SUPABASE_ANON_KEY", "public-key");
    authMocks.initializeAuth.mockResolvedValue(true);
    authMocks.subscribeToAuthState.mockReturnValue(() => {});
    window.history.pushState({}, "", "/estudantes");
    const { default: App } = await import("./App");
    const { rerender } = render(
      <StrictMode>
        <App />
      </StrictMode>,
    );

    act(() => {
      authMocks.useDomainEvents.mockReturnValue({
        events: [eventOne],
        connection: "connected",
      });
      rerender(
        <StrictMode>
          <App />
        </StrictMode>,
      );
    });

    act(() => {
      authMocks.useDomainEvents.mockReturnValue({
        events: [eventTwo, eventOne],
        connection: "connected",
      });
      rerender(
        <StrictMode>
          <App />
        </StrictMode>,
      );
    });

    expect(received).toEqual(["student-1", "student-2"]);
    unsubscribe();
  });
});
