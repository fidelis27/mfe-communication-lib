# Desenvolvimento local

Este guia descreve como subir o backend Go, o MariaDB pelo XAMPP, os MFEs e acessar o banco pelo phpMyAdmin no Windows.

## Pré-requisitos

- Go instalado e disponível no `PATH`.
- Node.js e npm instalados.
- XAMPP instalado em `C:\xampp`.
- MariaDB/MySQL do XAMPP configurado para a porta `3306`.
- Uma conta Supabase com Auth habilitado para autenticar usuarios locais.

Clone `https://github.com/fidelis27/secretaria-backend` como pasta irmã de
`mfe-communication`. Os frontends ficam em `modules/frontend/packages`.

## 0. Configurar Supabase Auth

Crie um projeto Supabase e habilite o provedor de e-mail/senha. Mantenha a
confirmacao de e-mail habilitada e desabilite cadastro publico; provisione no
Supabase somente as contas autorizadas que tambem existam como usuarios ativos
na tabela `users` do backend.

Defina o Project URL e a chave anon/public no ambiente antes de compilar os
workspaces, ou configure-os nas variaveis de build de cada projeto Vercel:

```powershell
$env:VITE_SUPABASE_URL="https://<project-ref>.supabase.co"
$env:VITE_SUPABASE_ANON_KEY="<anon-public-key>"
```

Configure no backend `OIDC_ISSUER` com o Project URL seguido de `/auth/v1` e
`OIDC_AUDIENCE=authenticated`. A chave anon e publica; nunca coloque a
`service_role` no frontend.

## 1. Subir o MariaDB pelo XAMPP

Abra o **XAMPP Control Panel** e clique em **Start** para:

- **MySQL**, na porta `3306`;
- **Apache**, se quiser usar o phpMyAdmin pelo navegador.

Pelo PowerShell, é possível confirmar a porta:

```powershell
Get-NetTCPConnection -LocalPort 3306 -State Listen
```

Se o MariaDB não estiver iniciado, o backend falha com erro de conexão recusada.

## 2. Criar o banco

No XAMPP, o usuário local padrão deste projeto é `root` sem senha. Crie o banco uma vez:

```powershell
C:\xampp\mysql\bin\mysql.exe -uroot -e "CREATE DATABASE IF NOT EXISTS test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

Para um banco com nome próprio:

```powershell
C:\xampp\mysql\bin\mysql.exe -uroot -e "CREATE DATABASE IF NOT EXISTS secretaria CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

Aplique as migrations na ordem:

```powershell
$database = "test"
$backend = Join-Path (Split-Path (Get-Location).Path -Parent) "secretaria-backend"
Get-ChildItem "$backend\migrations\*.sql" | Sort-Object Name | ForEach-Object {
  Get-Content -Raw $_.FullName | C:\xampp\mysql\bin\mysql.exe -uroot $database
}
```

As migrations atuais são:

1. `001_initial_schema.sql`: tabelas principais;
2. `002_enrollment_lifecycle.sql`: trancamento e reabertura;
3. `003_audit_events.sql`: eventos persistidos;
4. `004_seed_demo_super_admin.sql`: usuário demo `demo-active`.

Para executar somente uma migration:

```powershell
Get-Content -Raw "$backend\migrations\004_seed_demo_super_admin.sql" | C:\xampp\mysql\bin\mysql.exe -uroot test
```

## 3. Acessar o banco no phpMyAdmin

Com Apache e MySQL ativos no XAMPP, abra:

[http://localhost/phpmyadmin](http://localhost/phpmyadmin)

Na tela de login local:

- **Servidor:** `localhost`;
- **Usuário:** `root`;
- **Senha:** deixe vazia;
- **Banco:** `test` ou `secretaria`.

Consultas úteis na aba **SQL**:

```sql
SHOW TABLES;
SELECT * FROM institutions;
SELECT * FROM users;
SELECT * FROM students;
SELECT * FROM enrollments;
SELECT event_id, event_type, correlation_id, occurred_at
FROM audit_events
ORDER BY occurred_at DESC;
```

O phpMyAdmin administra o banco, mas não substitui a aplicação das migrations.

## 4. Subir o backend Go

Em um terminal na raiz do projeto:

```powershell
$env:PORT="3333"
$env:DB_HOST="127.0.0.1"
$env:DB_PORT="3306"
$env:DB_NAME="test"
$env:DB_USER="root"
$env:DB_PASSWORD=""
$env:DB_TLS="false"
$env:OIDC_ISSUER="https://<project-ref>.supabase.co/auth/v1"
$env:OIDC_AUDIENCE="authenticated"
$env:CORS_ORIGINS="http://localhost:4173,http://localhost:4174,http://localhost:4175,http://localhost:4176,http://localhost:4178,http://localhost:4179"
Push-Location $backend
go run ./cmd/server
Pop-Location
```

O backend fica em `http://localhost:3333`.

`CORS_ORIGINS` controla quais Hosts/remotes podem chamar a API no navegador.
Se omitida, a API aceita os ports locais documentados neste guia.

Teste básico:

```powershell
curl.exe -i http://localhost:3333/health
```

A resposta esperada é `200` com `{"ok":true}`.

Configure `OIDC_ISSUER` e `OIDC_AUDIENCE` no backend para autenticação Supabase.
As métricas básicas exigem access token:

```powershell
curl.exe -i http://localhost:3333/metrics -H "Authorization: Bearer <access-token>"
```

O endpoint retorna contadores no formato Prometheus para requisições totais,
respostas 5xx e requisições em andamento. O backend também emite logs JSON
com método, rota, status, duração e `correlation_id`; nenhum corpo de
requisição é registrado.

As rotas protegidas usam o usuário demo:

```powershell
curl.exe -i http://localhost:3333/institutions -H "Authorization: Bearer <access-token>"
```

O gerenciamento de grupos usa as rotas abaixo:

```powershell
curl.exe -i http://localhost:3333/groups -H "Authorization: Bearer <access-token>"
curl.exe -i -X POST http://localhost:3333/groups `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer <access-token>" `
  -d '{"institutionId":"institution-1"}'
curl.exe -i http://localhost:3333/groups/{groupId}/members `
  -H "Authorization: Bearer <access-token>"
curl.exe -i -X POST http://localhost:3333/groups/{groupId}/members `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer <access-token>" `
  -d '{"userId":"user-1","role":"member"}'
```

Somente superadministradores criam grupos. A listagem e a gestão de membros
respeitam o escopo da instituição; um administrador de grupo pode gerenciar
apenas o próprio grupo.

Sem o header, a API retorna `401`. Usuário inexistente ou inativo retorna `403`.

O WebSocket fica em:

```text
ws://localhost:3333/events (subprotocol: bearer.<access-token>)
```

## 5. Instalar dependências frontend

Na raiz do projeto:

```powershell
npm ci --legacy-peer-deps
```

## 6. Build dos MFEs

O Host e os providers podem ser compilados em conjunto. O build de módulo de
cada MFE produz o bundle IIFE em `dist/modules`:

```powershell
npm run build --workspace=@mfe/shared
npm run build --workspace=mfe-host
npm run build:module --workspaces --if-present
```

Os builds standalone continuam disponiveis no script `build` de cada
workspace; eles sao usados para desenvolver e implantar a aplicacao isolada.

```powershell
npm run build --workspace=mfe-activity
```

## 7. Subir os providers e o Host

Copie `.env.example` para `.env` na raiz quando precisar sobrescrever as
origens dos providers ou a API. As variáveis `VITE_MFE_*_URL` devem conter as
origens, sem caminho de manifesto. Para desenvolvimento local, o script
configura as portas de cada provider e a origem permitida do Host.

Para iniciar backend, Host e os cinco providers no Windows:

```powershell
npm run dev:local
```

O script compila os módulos, inicia o middleware local `serveModules` para cada
provider e abre o preview do Host. Ele também tenta iniciar o backend; o
MariaDB deve estar ativo no XAMPP. O Host fica em
[http://localhost:4174/](http://localhost:4174/). Para encerrar os processos:

```powershell
npm run stop:local
```

O comando de validação verifica health, autenticação, CORS, métricas,
WebSocket, os cinco manifestos e os respectivos assets:

```powershell
npm run validate:local
```

Pode-se alterar a API e a origem usada na validação com `API_BASE_URL` e
`CHECK_ORIGIN`. A origem dos módulos deve coincidir com `MFE_HOST_ORIGINS` no
provider; localmente, use `http://localhost:4174`.

| Componente  | Host local do provider  |
| ----------- | ----------------------- |
| Student     | `http://localhost:4173` |
| Institution | `http://localhost:4175` |
| Activity    | `http://localhost:4176` |
| Dashboard   | `http://localhost:4178` |
| Admin       | `http://localhost:4179` |

Cada manifesto fica em `/api/modules/__modules_configuration`. Os assets
listados no manifesto são servidos pelo middleware com metadados SRI.

## 8. Verificar os manifestos

Por exemplo, para consultar o manifesto Student e o bundle indicado por ele:

```powershell
$manifest = Invoke-RestMethod "http://localhost:4173/api/modules/__modules_configuration" -Headers @{ Origin = "http://localhost:4174" }
$manifest.modules.student.scripts[0]
```

`npm run validate:local` verifica todos os manifestos, os assets esperados e
as respostas CORS. O Host deve retornar `200` em
`http://localhost:4174/`.

## 9. Testes E2E com Playwright

Os testes constroem o Host e os cinco bundles IIFE, iniciam os providers locais
com o middleware real `serveModules` e carregam os módulos sem mocks de
componentes. API e WebSocket são interceptados na rede para manter os cenários
determinísticos; não é necessário iniciar o backend, MariaDB ou Supabase.
Essa separação entre integração de browser e validação dos serviços está
registrada no [ADR-0002](./adr/0002-federation-e2e-testing.md).

Instale as dependências e o Chromium uma vez:

```powershell
npm ci --legacy-peer-deps
npx playwright install chromium
```

Execute os testes:

```powershell
npm run test:e2e
```

O comando gera os builds, inicia o Host e os providers nas portas `4273`,
`4274`, `4275`, `4276`, `4278` e `4279`, executa os cenários e encerra os
servidores ao final.
Não inicie outros previews nessas portas ao mesmo tempo. O ambiente de
autenticação usa valores fictícios exclusivos para os testes. Para abrir o
relatório HTML após a execução:

```powershell
npx playwright show-report
```

Em caso de falha, screenshots, vídeos e traces ficam em `test-results/`; o CI
também publica o relatório e esses arquivos como artefato. Os testes cobrem
navegação pelos cinco módulos, cadastro de estudante, atualização por evento
entre Activity e Dashboard, falha do manifesto com retry, fallback de falha e
respostas HTTP 401.

## Problemas comuns

### Playwright não consegue iniciar um preview

Confirme que as portas `4273`, `4274`, `4275`, `4276`, `4278` e `4279` estão
livres. O servidor de teste usa `--strictPort` e falha explicitamente se uma
porta já estiver ocupada.

### Chromium não está instalado

Execute `npx playwright install chromium`. No CI Linux, as dependências do
sistema são instaladas junto com o navegador por `npx playwright install
--with-deps chromium`.

### Porta ocupada

Descubra o processo:

```powershell
Get-NetTCPConnection -LocalPort 3333,4173,4174,4175,4176,4178,4179 -State Listen
```

Encerre um processo específico somente quando tiver certeza do PID:

```powershell
Stop-Process -Id <PID> -Force
```

### Executar um MFE standalone

Os scripts standalone continuam disponiveis por workspace. Execute o preview no
diretorio do pacote, depois de gerar o build standalone, para que o Vite use o
`dist` correto. O Host integrado deve ser iniciado por `npm run dev:local`,
que tambem sobe os providers de manifesto.

### Host responde, mas um modulo nao carrega

Confirme que o manifesto do provider responde em
`/api/modules/__modules_configuration`, que lista o módulo esperado e que o
asset correspondente retorna `200`. Verifique também `MFE_HOST_ORIGINS` no
provider e se o `VITE_MFE_*_URL` do Host aponta para a origem correta.

### Backend não conecta no banco

Confirme:

```powershell
Get-NetTCPConnection -LocalPort 3306 -State Listen
```

Depois confira `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` e `DB_PASSWORD` no mesmo terminal que executará `go run`.

### Reiniciar tudo

Pare os processos dos terminais, reinicie MySQL/Apache no XAMPP, aplique apenas as migrations pendentes e suba novamente o backend antes dos frontends.
