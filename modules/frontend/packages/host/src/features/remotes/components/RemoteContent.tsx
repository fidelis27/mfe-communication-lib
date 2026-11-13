import { Module } from "@lib-core-mfe/module-frontend/client";
import { captureHostError } from "@mfe/shared";
import { markRemoteReady } from "../../../remoteLoadingMetrics";
import type { ModuleId, ActiveModule } from "../../navigation/modules";
import { RemoteSkeleton } from "./RemoteSkeleton";

const moduleHosts: Record<ModuleId, string> = {
  student: import.meta.env.VITE_MFE_STUDENT_URL ?? "http://localhost:4173",
  institution: import.meta.env.VITE_MFE_INSTITUTION_URL ?? "http://localhost:4175",
  activity: import.meta.env.VITE_MFE_ACTIVITY_URL ?? "http://localhost:4176",
  dashboard: import.meta.env.VITE_MFE_DASHBOARD_URL ?? "http://localhost:4178",
  admin: import.meta.env.VITE_MFE_ADMIN_URL ?? "http://localhost:4179",
};

const moduleLabels: Record<ModuleId, string> = {
  student: "estudantes",
  institution: "instituições",
  activity: "atividade",
  dashboard: "dashboard",
  admin: "administração",
};

function RemoteModule({ name }: { name: ModuleId }) {
  const host = moduleHosts[name];
  const label = moduleLabels[name];

  return (
    <Module
      name={name}
      host={host}
      path="/api/modules/__modules_configuration"
      allowedHosts={[host]}
      requireIntegrity
      manifestTtlMs={60_000}
      loading={<RemoteSkeleton label={`Carregando ${label}`} />}
      fallback={({ retry }) => (
        <section className="remote-state">
          <p className="eyebrow">Falha no carregamento</p>
          <h1>Módulo de {label} indisponível</h1>
          <button type="button" onClick={retry}>
            Tentar novamente
          </button>
        </section>
      )}
      onError={(error) => {
        captureHostError(error, { moduleName: name });
      }}
      moduleLifeCycleEvent={{
        onMounted: () => {
          markRemoteReady(name);
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
    case "institution":
    case "activity":
    case "dashboard":
    case "admin":
      return <RemoteModule name={activeModule} />;
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
