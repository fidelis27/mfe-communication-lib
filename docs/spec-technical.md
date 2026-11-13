# Especificacao tecnica - Secretaria escolar multi-MFE

## 1. Objetivo tecnico

Entregar um prototipo verificavel em Go, React e TypeScript, mantendo
contratos independentes da implementacao para permitir evolucao futura do
backend sem alterar os MFEs.

## 2. Fronteiras de responsabilidade

```text
Interface MFE
	-> cliente HTTP / adaptador de eventos
	-> caso de uso e autorizacao
	-> repositorio e barramento de eventos
	-> persistencia MariaDB/MySQL
```

- **Host:** navegacao, composicao e ciclo de vida dos MFEs.
- **MFE:** tela, estado visual e interacao do seu bounded context.
- **Backend Go:** validacao de JWT Supabase/OIDC, autorizacao, casos de uso,
  persistencia autoritativa em MariaDB/MySQL e publicacao de eventos.
- **Shared:** schemas Zod e tipos inferidos dos contratos, validados nas
  fronteiras de entrada; nao deve conter regra de negocio de outro dominio.
- **Activity/Dashboard:** consumidores e projecoes; nao alteram a fonte
  autoritativa de Instituicao ou Estudante.

## 3. Stack e ambiente

- Go para API HTTP, WebSocket e acesso MariaDB/MySQL.
- React para os MFEs.
- Vitest para testes.
- Monorepo npm com workspaces em `modules/frontend/packages/*`.
- MariaDB/MySQL para persistencia do prototipo.
- Nenhum repositorio de negocio em memoria; testes de integracao usam banco de
  teste MariaDB/MySQL.
- `@lib-core-mfe/module-frontend` para registrar MFEs como bundles IIFE,
  distribuir manifesto com SRI pelas Vercel Functions e carregá-los no Host.
- Cada módulo empacota sua própria cópia de React e dependências; não há
  singleton de runtime. O estado compartilhado de autenticação e do bus usa
  pontes explicitamente armazenadas em `globalThis`.
- WebSocket como transporte realtime do protótipo.
- `window.bus`/`EventTarget` somente para comunicação local entre MFEs na mesma
  página; não substitui o canal backend.

O Host deve carregar os cinco MFEs pelo manifesto da biblioteca, verificar a
integridade dos bundles e expor loading, fallback com retry e erros reportados.
O Host e cada provider sao implantados independentemente; cada provider
configura CORS para as origens aprovadas do Host.

## 4. Padroes de desenvolvimento

### JavaScript e TypeScript

- Preferir TypeScript estrito e tipos explicitos nos contratos publicos.
- Evitar `any`; quando inevitavel, isolar e justificar no adaptador.
- Usar funcoes pequenas, nomes expressivos e responsabilidade unica.
- Evitar mutacao de estado compartilhado e efeitos colaterais escondidos.
- Validar entradas na fronteira da aplicacao antes de executar regras de
  negocio.
- Tratar erros de forma explicita, sem engolir excecoes.
- Manter funcoes puras sempre que nao houver necessidade de I/O.
- Evitar duplicacao; abstrair somente quando houver comportamento realmente
  compartilhado.
- Nao acoplar regras de negocio a Express, React ou ao adaptador de memoria.

### HTML e acessibilidade

- Usar HTML semantico: `header`, `nav`, `main`, `section`, `form`, `label` e
  `button` conforme a finalidade.
- Todo campo de formulario deve possuir label associado e mensagem de erro
  compreensivel.
- Usar botoes reais para acoes e links reais para navegacao.
- Garantir navegacao por teclado e foco visivel.
- Nao depender somente de cor para comunicar estado.
- Fornecer nome acessivel para controles e feedback de sucesso/erro.
- Manter hierarquia de titulos e ordem de leitura coerente.

### CSS

- Preferir classes e tokens de design a estilos inline repetidos.
- Organizar estilos por componente ou dominio visual.
- Usar layout responsivo com Flexbox/Grid e dimensoes estaveis.
- Evitar seletores globais que vazem entre MFEs.
- Evitar `!important`, valores magicos e especificidade desnecessaria.
- Garantir contraste, estados `hover`, `focus`, `disabled` e `error`.
- Manter o CSS de cada MFE isolado para evitar conflitos no Host.

## 5. Principios de arquitetura

### SOLID

- **S - Responsabilidade unica:** componente, caso de uso e adaptador devem
  possuir uma razao principal para mudar.
- **O - Aberto/fechado:** adicionar um consumidor ou transportador nao deve
  exigir alterar a regra central de dominio.
- **L - Substituicao:** implementacoes em memoria devem respeitar as mesmas
  interfaces dos repositorios definitivos.
- **I - Segregacao de interfaces:** contratos pequenos e orientados ao uso,
  sem obrigar dependencias desnecessarias.
- **D - Inversao de dependencia:** casos de uso dependem de interfaces; HTTP,
  WebSocket e persistencia ficam nos adaptadores.

SOLID sera aplicado de forma pragmatica. Nao criar camadas ou interfaces sem
uma necessidade concreta de teste, substituicao ou separacao de dominio.

### Clean Architecture

Usar Clean Architecture somente onde reduzir acoplamento e facilitar a
evolucao do backend Go e a substituicao futura do MariaDB/MySQL:

```text
Interface React/HTTP/WebSocket
	-> casos de uso
	-> entidades e regras de dominio
	-> portas (repositorios, eventos, identidade)
	-> adaptadores (Go HTTP, MariaDB/MySQL, WebSocket)
```

As dependencias apontam para dentro. Entidades e casos de uso nao importam
React, Express, Vite, WebSocket ou detalhes de banco.

## 6. Componentizacao React

## 6.1 Direcao visual e biblioteca de UI

O produto terá uma interface institucional, administrativa e orientada a
tarefas repetitivas. A prioridade visual é clareza, densidade controlada,
hierarquia e acessibilidade, não uma aparência de landing page.

### Layout aprovado

- Shell com navegação lateral persistente no desktop e navegação recolhível
  em telas menores.
- Barra superior com instituição/unidade selecionada, estado de conexão,
  usuário e ações globais.
- Área principal com título, contexto da página, filtros, ação primária e
  conteúdo.
- Listas e tabelas para comparação; formulários em seções curtas e claras.
- Modais somente para ações rápidas ou confirmação; fluxos longos usam página
  própria.
- Estados explícitos para carregamento, vazio, sucesso, erro e sem permissão.
- Design responsivo, com suporte a teclado e foco visível.

### Direção visual

- Paleta sóbria institucional, com fundo neutro, superfícies claras, texto de
  alto contraste e uma cor de ação consistente.
- Uso moderado de cor para estado: sucesso, alerta, erro e informação.
- Tipografia legível e hierarquia clara; evitar excesso de sombras, gradientes,
  cards decorativos e elementos promocionais.
- Tabelas, filtros, paginação, breadcrumbs e feedback devem priorizar leitura
  rápida e operação de secretaria.

### Biblioteca recomendada

Usar **React Aria Components** para controles que exigem comportamento e
acessibilidade, como campos, combobox, select, dialog, checkbox, radio, tabs e
menu. A aparência será implementada pelo projeto com SCSS, não pelo tema
visual padrão da biblioteca.

Motivos:

- oferece primitives acessíveis e comportamento robusto;
- permite manter identidade visual própria;
- reduz risco de conflito de CSS entre MFEs;
- funciona bem com componentes stateless e containers;
- evita acoplamento visual forte a uma biblioteca de design.

Para tabelas complexas, usar TanStack Table como lógica headless quando
necessário. Não adotar MUI ou PrimeReact como base visual do MVP: são viáveis,
mas seus temas e estilos aumentariam o acoplamento visual entre remotes.

### SCSS e BEM

- Usar SCSS para tokens, componentes e estados.
- Nomear classes com BEM, por exemplo:
  `institution-form`, `institution-form__field`,
  `institution-form__field--invalid`.
- Manter estilos de cada MFE escopados por namespace ou CSS Modules para evitar
  vazamento entre remotes.
- Compartilhar apenas tokens, mixins e componentes realmente estáveis no
  pacote de UI compartilhado.
- Não misturar Tailwind, CSS-in-JS e SCSS como padrões concorrentes.

### Componentes de apresentacao (stateless)

Responsaveis por renderizar dados e emitir intencoes por callbacks.

- Nao fazem chamadas HTTP diretamente.
- Nao conhecem repositorios, WebSocket ou regras de autorizacao.
- Recebem dados, estados e callbacks por props.
- Devem ser previsiveis e faceis de testar.

Exemplos: `InstitutionForm`, `StudentTable`, `EnrollmentStatus` e
`FeedbackMessage`.

### Componentes logicos/container

Responsaveis por coordenar estado, casos de uso, dados e eventos.

- Fazem chamadas a clientes/adaptadores definidos para o MFE.
- Traduzem respostas em estados `idle`, `loading`, `empty`, `success` e
  `error`.
- Assinam eventos realtime e filtram por `eventId`/`correlationId`.
- Passam dados e callbacks para componentes de apresentacao.
- Nao devem concentrar regras de negocio complexas; essas regras pertencem a
  casos de uso ou ao backend.

Exemplos: `InstitutionPage`, `StudentFlowContainer` e
`EnrollmentModalContainer`.

### Regras de composicao

- Preferir composicao de componentes a heranca.
- Um componente deve ter uma API de props pequena e sem detalhes internos.
- Evitar componentes gigantes que renderizam tela, fazem I/O e decidem regras
  ao mesmo tempo.
- Hooks customizados podem encapsular estado de UI e assinaturas de eventos,
  mas nao substituem casos de uso do dominio.
- Cada MFE deve expor uma entrada pequena e documentada para o Host.

## 7. Organizacao recomendada de pastas

```text
src/
	components/       # apresentacao reutilizavel
	containers/       # coordenacao de tela e estado
	hooks/            # comportamento de UI e eventos
	application/      # casos de uso do frontend
	domain/           # tipos e regras locais do dominio
	infrastructure/   # HTTP, WebSocket e carregamento de modulos
	styles/            # tokens e estilos do MFE
```

Nem toda pasta precisa existir em todo MFE. A estrutura deve acompanhar a
complexidade real e nao gerar pastas vazias.

## 8. APIs do MVP

Rotas planejadas:

- `GET /health`
- `GET /institutions`
- `POST /institutions`
- `PUT /institutions/:institutionId`
- `POST /institutions/:institutionId/inactivate`
- `GET /institutions/:institutionId/students`
- `POST /institutions/:institutionId/students`
- `GET /activities`
- `GET /dashboard/summary`
- `POST /students/:studentId/enrollments/:enrollmentId/suspend`
- `POST /students/:studentId/enrollments/:enrollmentId/reopen`
- `POST /students/:studentId/transfer`
- `GET /events/stream` ou endpoint WebSocket equivalente para eventos realtime

Rotas protegidas usam a identidade demonstrativa e carregam o usuario antes
da politica de autorizacao. Respostas de erro devem usar pelo menos `401`,
`403`, `404` e `422` conforme a causa.

### Exibicao de erros 403/404 no frontend

O cliente HTTP compartilhado transforma respostas `403` em "Você não tem
permissão para realizar esta ação." e respostas `404` em "O recurso solicitado
não foi encontrado." No MFE Student, a falha ao cadastrar deve ser anunciada
como alerta, sem feedback de sucesso ou insercao otimista do estudante. Se uma
atualizacao da listagem falhar com `403` ou `404`, a tela anuncia o erro e nao
mantem visiveis os dados em cache da resposta anterior.

Esses testes garantem somente que o frontend nao mascara a negacao; nao provam
autorizacao nem isolamento. O backend e a fonte autoritativa para permissao e
escopo por instituicao. O cliente ainda nao conhece o escopo do usuario; um
seletor/filtro global depende de uma fonte confiavel, como um endpoint de
escopo do usuario atual. O `institutionIds` opcional dos eventos nao substitui
essa fonte.

## 9. Modelo de dados minimo

```ts
type InstitutionStatus = "active" | "inactive";
type EnrollmentStatus = "active" | "suspended" | "transferred" | "inactive";

interface Institution {
  id: string;
  name: string;
  status: InstitutionStatus;
}

interface Student {
  id: string;
  name: string;
  status: "active" | "inactive";
}

interface Enrollment {
  id: string;
  studentId: string;
  institutionId: string;
  campusId?: string;
  courseId?: string;
  status: EnrollmentStatus;
  startedAt: string;
  endedAt?: string;
}
```

Os repositorios devem ser interfaces. O caso de uso nao pode depender de SQL,
MariaDB/MySQL ou detalhes do driver.

## 10. Eventos e transporte

Contrato minimo para dominio e interacao realtime:

```ts
interface DomainEvent<TType extends string, TPayload> {
  eventId: string;
  type: TType;
  version: number;
  source: string;
  correlationId: string;
  payload: TPayload;
  occurredAt: string;
}
```

O barramento em memoria deve permitir publicar e assinar por tipo de evento.
O produtor publica somente depois da persistencia bem-sucedida. Consumidores
devem ser tolerantes a eventos repetidos e ignorar tipos desconhecidos. Um
adaptador WebSocket distribui eventos ao host e aos MFEs. Acoes de modal usam
eventos de sucesso/erro correlacionados; o
consumidor nao deve fechar o modal por mera tentativa de envio.

WebSocket permanece obrigatório no MVP porque Activity, Dashboard e clientes
simultâneos precisam receber eventos originados no backend. O barramento do
browser complementa esse canal para coordenar apenas os MFEs carregados na
mesma página.

Evolucao planejada:

- autenticar e controlar a assinatura dos canais WebSocket;
- substituir o barramento local por broker;
- adicionar retentativa, dead-letter e idempotencia persistente.

## 11. Autenticacao e autorizacao

- O Host autentica via Supabase Auth; os MFEs enviam access token Bearer.
- O backend valida issuer, audience e assinatura via OIDC/JWKS, e associa o
  e-mail do token a um usuario ativo no banco local.
- O middleware de identidade responde `401` quando nao ha sessao valida.
- O middleware de usuario rejeita usuarios inexistentes ou inativos.
- `AuthorizationPolicy` decide acesso por superadministrador e participacao em
  grupos/instituicoes.
- A regra deve ser testada fora do Express e coberta por testes de middleware.

Este mecanismo nao e adequado para producao; ele existe para validar o fluxo.

## 12. Testes e verificacao

Ordem de validacao de cada fatia:

1. Teste unitario do caso de uso ou politica.
2. Teste de integracao da rota com banco MariaDB/MySQL de teste.
3. Teste do evento publicado e do consumidor correspondente.
4. Verificacao manual dos estados `loading`, `empty`, `success` e `error`.
5. Revisao do diff contra `archive/context.md` e
   `product/functional-specification.md`.

Comandos planejados:

```bash
npm test
npm run build
go test ./... # no clone secretaria-backend
go run ./cmd/server # no clone secretaria-backend
```

Antes da entrega, o TypeScript deve ser compilado sem erros e o fluxo
instituicao -> estudante -> evento deve possuir um teste automatizado.

## 13. Observabilidade minima

Registrar em desenvolvimento: identificador do caso de uso, tipo do evento,
data de ocorrencia, resultado do consumidor e erro de validacao. Nao registrar
dados pessoais completos nos logs.

## 14. Riscos tecnicos e limites

- Memoria local nao representa concorrencia, reinicio ou escalabilidade.
- Eventos em memoria nao sobrevivem a falhas.
- A ausencia de um banco pode ocultar constraints de unicidade e transacao.
- Carregamento de modulos, providers indisponiveis e reconexao realtime sao
  riscos centrais da arquitetura.
- Transferencias exigem consistencia entre o vinculo de origem e o de destino.
- Dados pessoais exigem minimizacao, mascaramento, criptografia e auditoria de
  acesso conforme a politica de privacidade do produto.
- Dados reais devem ser anonimizados ou substituidos por dados ficticios no
  ambiente local.

## 15. Plano de tres dias

### Dia 1 - backend Go e MariaDB/MySQL

1. Consolidar contratos, migrations MariaDB, repositorios, casos de uso e
   testes de dominio.
2. Expor leitura, criacao, edicao e inativacao de instituicao.
3. Expor cadastro e listagem de estudante com autorizacao.
4. Publicar eventos apos escrita bem-sucedida.
5. Cobrir o fluxo com testes unitarios e de integracao.

### Dia 2 - frontend e integracao

1. Configurar o carregamento por manifesto e integrar o Host a todos os MFEs.
2. Configurar WebSocket e validar eventos realtime correlacionados.
3. Implementar Institution, Student, Admin, Activity e Dashboard.
4. Adicionar estados de interface e tratamento de erros.

### Dia 3 - qualidade, seguranca e deploy

1. Adicionar logs estruturados, `correlationId` e métricas básicas no backend Go.
2. Usar uma biblioteca de logging e métricas compatível com Go, mantendo os
   adaptadores separados dos casos de uso.
3. Validar acessibilidade, fluxo ponta a ponta e regressao.
4. Configurar builds e deploy da API Go e de todos os remotes.
5. Revisar diff, riscos, evidencias e limites para producao.

<!-- O bloco acima substitui a sequencia anterior de observabilidade. -->

Cada fatia deve terminar com teste executado e diff revisado. Qualquer
requisito novo deve ser registrado nas specs antes de ampliar a implementacao.

## 16. Definicao de pronto do prototipo

Esta definicao descreve o alvo futuro do prototipo e nao autoriza seu inicio.
Nenhuma implementacao, instalacao de dependencia ou alteracao de configuracao
deve ocorrer antes da aprovacao explicita de `archive/context.md`,
`product/functional-specification.md`, `spec-technical.md` e `deployment.md`.

O prototipo sera considerado completo quando:

- o fluxo instituicao -> estudante -> evento -> Activity/Dashboard funcionar;
- as regras de autorizacao tiverem testes;
- estados de sucesso, vazio e erro forem visiveis;
- logs nao expuserem dados pessoais desnecessarios;
- `npm test` e a compilacao TypeScript passarem;
- as limitacoes de producao estiverem documentadas.

Completo, neste contexto, significa completo para demonstracao e validacao do
MVP. Nao significa pronto para operar em producao.

## 17. Decisao final vigente

Este bloco prevalece sobre qualquer referencia anterior conflitante:

- Backend: Go.
- Persistencia: MariaDB/MySQL para todos os dados de negocio, com migrations e
  transacoes.
- Repositorios em memoria: proibidos para dados de negocio; permitidos apenas
  em testes de componentes sem persistencia.
- O banco MariaDB/MySQL deve estar em instancia persistente nos ambientes
  publicados.
- Transferencia deve alterar vinculo de origem e destino na mesma transacao.
- WebSocket e carregamento real dos cinco modulos sao obrigatorios no prototipo.
- O plano de entrega tem tres dias.
- Antes da implementacao, criar o schema MariaDB, os contratos compartilhados,
  o contrato WebSocket e os testes de persistencia.
