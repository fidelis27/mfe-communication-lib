import { test, expect } from "@playwright/test";
import {
  installFakeWebSocket,
  mockApi,
  seedAuthenticatedSession,
  studentCreatedEvent,
  studentUpdatedEvent,
} from "./helpers.mjs";

async function setup(page, options = {}) {
  page.on("console", (message) => {
    if (message.type() === "error") console.error("[browser console]", message.text());
  });
  page.on("pageerror", (error) =>
    console.error("[browser page error]", error.stack ?? error.message),
  );
  if (options.authenticated !== false) await seedAuthenticatedSession(page);
  const api = await mockApi(page, options);
  const socket = await installFakeWebSocket(page);
  return { api, socket };
}

test("host loads all five real modules through manifest navigation", async ({ page }) => {
  await setup(page);
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "Módulos da secretaria" })).toBeVisible();

  const modules = [
    { name: "student", label: "Estudantes", heading: "Vínculos que acompanham cada trajetória." },
    {
      name: "institution",
      label: "Instituições",
      heading: "Uma rede de instituições, um só lugar.",
    },
    { name: "activity", label: "Atividade", heading: "Atividade do sistema." },
    { name: "dashboard", label: "Dashboard", heading: "O pulso da operação." },
    { name: "admin", label: "Admin", heading: "Pessoas e permissões." },
  ];

  for (const module of modules) {
    await page.getByRole("link", { name: new RegExp(module.label) }).click();
    await expect(
      page.getByRole("main").getByRole("heading", { level: 1, name: module.heading }),
    ).toBeVisible();
    await expect(page.locator(`style[data-module-styles="${module.name}"]`)).toHaveCount(1);
  }
});

test("activity manifest failure shows retry fallback and then loads the module", async ({
  page,
}) => {
  await setup(page);
  let manifestRequests = 0;
  await page.route("http://127.0.0.1:4276/api/modules/__modules_configuration", async (route) => {
    manifestRequests += 1;
    if (manifestRequests === 1) {
      await route.fulfill({ status: 503, body: "Temporary provider failure" });
      return;
    }
    await route.continue();
  });
  await page.goto("/atividade");

  await expect(page.getByRole("heading", { name: "Atividade indisponível" })).toBeVisible();
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(page.getByRole("heading", { name: "Atividade do sistema." })).toBeVisible();
  expect(manifestRequests).toBeGreaterThanOrEqual(2);
});

test("student form creates a record through the real remote", async ({ page }) => {
  const { api } = await setup(page);
  await page.goto("/estudantes");

  await page.getByLabel("Nome completo").fill("Ana E2E");
  await page.getByLabel("Instituição").selectOption("institution-e2e");
  await page.getByRole("button", { name: /Cadastrar estudante/ }).click();

  await expect(page.getByRole("heading", { name: "Ana E2E" })).toBeVisible();
  expect(
    api.requests.some(
      (request) =>
        request.method === "POST" &&
        request.pathname === "/students" &&
        request.postData === JSON.stringify({ name: "Ana E2E", institutionId: "institution-e2e" }),
    ),
  ).toBe(true);
});

test("403 while creating a student is accessible and does not add the student", async ({
  page,
}) => {
  const { api } = await setup(page, {
    forcedErrors: [{ method: "POST", pathname: "/students", status: 403 }],
  });
  await page.goto("/estudantes");

  await page.getByLabel("Nome completo").fill("Cadastro negado E2E");
  await page.getByLabel("Instituição").selectOption("institution-e2e");
  await page.getByRole("button", { name: /Cadastrar estudante/ }).click();

  await expect(page.getByRole("alert")).toHaveText(
    "Você não tem permissão para realizar esta ação.",
  );
  await expect(page.getByRole("heading", { name: "Cadastro negado E2E" })).toHaveCount(0);
  expect(api.students).toHaveLength(0);
});

for (const status of [403, 404]) {
  test(`${status} while refreshing students hides previously loaded data`, async ({ page }) => {
    const student = {
      id: `student-existing-${status}`,
      name: `Estudante existente ${status}`,
      institutionId: "institution-e2e",
      status: "active",
    };
    const { socket } = await setup(page, {
      initialStudents: [student],
      forcedErrors: [{ method: "GET", pathname: "/students", status, after: 1 }],
    });
    await page.goto("/estudantes");
    await expect(
      page.getByRole("heading", { level: 1, name: "Vínculos que acompanham cada trajetória." }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("heading", { name: student.name })).toBeVisible();

    await socket.send(studentUpdatedEvent(student));

    await expect(page.getByRole("alert")).toContainText(
      status === 403
        ? "Você não tem permissão para realizar esta ação."
        : "O recurso solicitado não foi encontrado.",
    );
    await expect(page.getByRole("heading", { name: student.name })).toHaveCount(0);
    await expect(page.getByText("00", { exact: true })).toBeVisible();
  });
}

test("WebSocket event appears in Activity and refreshes Dashboard", async ({ page }) => {
  const { api, socket } = await setup(page);
  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: "Estudantes" }).locator("..").locator("strong"),
  ).toHaveText("0");

  const student = {
    id: "student-from-event",
    name: "Evento E2E",
    institutionId: "institution-e2e",
    status: "active",
  };
  const event = studentCreatedEvent(student);
  api.students.unshift(student);
  api.history.unshift(event);
  await socket.send(event);

  await expect(
    page.getByRole("heading", { name: "Estudantes" }).locator("..").locator("strong"),
  ).toHaveText("1");
  await page.getByRole("link", { name: /Atividade/ }).click();
  await expect(page.getByText("Estudante cadastrado")).toBeVisible();
  await expect(page.getByText("e2e-correlation")).toBeVisible();
});

test("failed module shows fallback and offers retry", async ({ page }) => {
  await setup(page);
  await page.route("http://127.0.0.1:4279/api/modules/__modules_configuration", (route) =>
    route.abort(),
  );
  await page.goto("/");
  await page.getByRole("link", { name: /Admin/ }).click();

  await expect(
    page.getByRole("heading", { name: "Módulo de administração indisponível" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Tentar novamente" })).toBeVisible();
});

test("401 API response shows an expired-session message", async ({ page }) => {
  await setup(page, { sessionExpired: true });
  await page.goto("/estudantes");

  await expect(page.getByText("Sua sessão expirou. Entre novamente.")).toBeVisible();
});

test("unauthenticated session shows the login form", async ({ page }) => {
  await setup(page, { authenticated: false });
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Login necessário" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
});
