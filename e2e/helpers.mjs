import { expect } from "@playwright/test";

const API_ORIGIN = "http://127.0.0.1:4280";
const AUTH_STORAGE_KEY = "sb-e2e-auth-token";

function base64Url(value) {
  return Buffer.from(value).toString("base64url");
}

export function createAuthSession() {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: "e2e-super-admin",
    email: "e2e@example.test",
    user_metadata: { name: "E2E Admin" },
    app_metadata: { roles: ["super_admin"] },
    aud: "authenticated",
    exp: now + 3600,
    iat: now,
  };
  const accessToken = `${base64Url(JSON.stringify({ alg: "none", typ: "JWT" }))}.${base64Url(JSON.stringify(payload))}.e2e`;

  return {
    access_token: accessToken,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: now + 3600,
    refresh_token: "e2e-refresh-token",
    user: {
      id: payload.sub,
      aud: payload.aud,
      email: payload.email,
      app_metadata: payload.app_metadata,
      user_metadata: payload.user_metadata,
      created_at: new Date(now * 1000).toISOString(),
    },
  };
}

export async function seedAuthenticatedSession(page) {
  await page.addInitScript(
    ({ storageKey, session }) => {
      window.localStorage.setItem(storageKey, JSON.stringify(session));
    },
    { storageKey: AUTH_STORAGE_KEY, session: createAuthSession() },
  );
}

export async function mockApi(
  page,
  { sessionExpired = false, initialStudents = [], forcedErrors = [] } = {},
) {
  const students = initialStudents.map((student) => ({ ...student }));
  const pendingErrors = forcedErrors.map((error) => ({ after: 0, ...error }));
  const institutions = [
    { id: "institution-e2e", name: "Instituto E2E", cnpj: null, status: "active" },
  ];
  const enrollments = [];
  const history = [];
  const requests = [];

  await page.route(`${API_ORIGIN}/**`, async (route) => {
    const request = route.request();
    const requestUrl = new URL(request.url());
    const method = request.method();
    const corsHeaders = {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
      "access-control-allow-headers":
        request.headers()["access-control-request-headers"] ?? "authorization,content-type",
    };

    if (method === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }

    requests.push({ method, pathname: requestUrl.pathname, postData: request.postData() });
    const forcedError = pendingErrors.find(
      (error) => error.method === method && error.pathname === requestUrl.pathname,
    );
    if (forcedError?.after) {
      forcedError.after -= 1;
    } else if (forcedError) {
      pendingErrors.splice(pendingErrors.indexOf(forcedError), 1);
      await route.fulfill({
        status: forcedError.status,
        headers: corsHeaders,
        contentType: "application/json",
        body: JSON.stringify({ error: forcedError.status === 403 ? "forbidden" : "not found" }),
      });
      return;
    }

    if (requestUrl.pathname === "/students" && method === "GET" && sessionExpired) {
      await route.fulfill({
        status: 401,
        headers: corsHeaders,
        contentType: "application/json",
        body: JSON.stringify({ error: "expired session" }),
      });
      return;
    }

    if (requestUrl.pathname === "/students" && method === "POST") {
      const input = request.postDataJSON();
      const created = {
        id: "student-created-e2e",
        name: input.name,
        institutionId: input.institutionId,
        status: "active",
      };
      students.unshift(created);
      await route.fulfill({
        status: 201,
        headers: corsHeaders,
        contentType: "application/json",
        body: JSON.stringify(created),
      });
      return;
    }

    const body =
      requestUrl.pathname === "/students"
        ? students
        : requestUrl.pathname === "/institutions"
          ? institutions
          : requestUrl.pathname === "/enrollments"
            ? enrollments
            : requestUrl.pathname === "/events/history"
              ? history
              : requestUrl.pathname === "/users" ||
                  requestUrl.pathname === "/groups" ||
                  requestUrl.pathname.includes("/members") ||
                  requestUrl.pathname.includes("/candidates")
                ? []
                : [];
    await route.fulfill({
      status: 200,
      headers: corsHeaders,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });

  return { students, institutions, enrollments, history, requests };
}

export async function installFakeWebSocket(page) {
  const socketRoutes = [];
  await page.routeWebSocket("ws://127.0.0.1:4280/events", (route) => {
    socketRoutes.push(route);
    route.onMessage(() => {});
  });

  return {
    async send(event) {
      await expect.poll(() => socketRoutes.length).toBeGreaterThan(0);
      for (const route of socketRoutes) route.send(JSON.stringify(event));
    },
  };
}

export function studentCreatedEvent(student) {
  return {
    eventId: "e2e-student-created-event",
    type: "STUDENT_CREATED",
    version: 1,
    source: "e2e",
    correlationId: "e2e-correlation",
    occurredAt: new Date().toISOString(),
    payload: student,
  };
}

export function studentUpdatedEvent(student) {
  return {
    ...studentCreatedEvent(student),
    eventId: "e2e-student-updated-event",
    type: "STUDENT_UPDATED",
  };
}
