import React, { lazy, Suspense } from "react";
import { Module } from "@lib-core-mfe/module-frontend/client";
import { captureHostError } from "@mfe/shared";
import { loadRemote, markRemoteReady } from "../../../remoteLoadingMetrics";
import type { ActiveModule } from "../../navigation/modules";
import { RemoteSkeleton } from "./RemoteSkeleton";

const StudentApp = lazy(() => loadRemote("student", () => import("mfe_student/App")));
const InstitutionApp = lazy(() => loadRemote("institution", () => import("mfe_institution/App")));
const DashboardApp = lazy(() => loadRemote("dashboard", () => import("mfe_dashboard/App")));
const AdminApp = lazy(() => loadRemote("admin", () => import("mfe_admin/App")));

const activityHost = import.meta.env.VITE_MFE_ACTIVITY_URL ?? "http://localhost:4176";

function ActivityModule() {
  return (
    <Module
      name="activity"
      host={activityHost}
      allowedHosts={[activityHost]}
      loading={<RemoteSkeleton label="Carregando atividade" />}
      fallback={({ retry }) => (
        <section className="remote-state">
          <p className="eyebrow">Falha no carregamento</p>
          <h1>Atividade indisponível</h1>
          <button type="button" onClick={retry}>
            Tentar novamente
          </button>
        </section>
      )}
      onError={(error) => {
        captureHostError(error, { moduleName: "activity" });
      }}
      moduleLifeCycleEvent={{
        onMounted: () => {
          markRemoteReady("activity");
        },
      }}
    />
  );
}

export function RemoteContent({
  activeModule,
  moduleLabel,
}: {
  activeModule: ActiveModule;
  moduleLabel: (moduleId: string) => string;
}) {
  switch (activeModule) {
    case "student":
      return (
        <Suspense fallback={<RemoteSkeleton label="Carregando módulo de estudantes" />}>
          <StudentApp />
        </Suspense>
      );
    case "activity":
      return <ActivityModule />;
    case "institution":
      return (
        <Suspense fallback={<RemoteSkeleton label="Carregando módulo de instituições" />}>
          <InstitutionApp />
        </Suspense>
      );
    case "dashboard":
      return (
        <Suspense fallback={<RemoteSkeleton label="Carregando dashboard" />}>
          <DashboardApp />
        </Suspense>
      );
    case "admin":
      return (
        <Suspense fallback={<RemoteSkeleton label="Carregando administração" />}>
          <AdminApp />
        </Suspense>
      );
    default:
      return (
        <section className="remote-state">
          <p className="eyebrow">Módulo em preparação</p>
          <h1>{moduleLabel(activeModule)}</h1>
          <p>A estrutura está pronta para receber o próximo remote.</p>
        </section>
      );
  }
}
