# Event bus local

O bus local usa `globalThis.__mfeBus` como estado compartilhado entre o Host e
os modulos. Como cada bundle inclui sua propria copia de `@mfe/shared`, o
estado do bus (listeners, filas e TTL) precisa viver no objeto global da pagina,
nao em variaveis de modulo. Inicializar outra copia da biblioteca nao reinicia
nem substitui esse estado.

## Convenção de canais

- `cmd:*` para comandos do host para o MFE
- `evt:*` para eventos do MFE para o host
- `domain:*` para eventos de domínio publicados pelo host

Exemplos:

- `cmd:navigate`
- `evt:navigate`
- `domain:connection`
- `domain:event` (envelope completo com `eventId`)
- `STUDENT_CREATED` (payload tipado publicado no módulo `domain`)

## API

```ts
import { dispatch, listen, useDispatch, useListen } from "@mfe/shared";

dispatch("student", "evt:navigate", { path: "/instituicoes" }, { ttl: 10000 });
const unsubscribe = listen("host", "cmd:navigate", ({ path }) => {
  console.log(path);
});

const emit = useDispatch("student");
emit("evt:navigate", { path: "/instituicoes" });

useListen("domain", "STUDENT_CREATED", (payload) => {
  console.log(payload);
});

useListen("domain", "domain:event", (event) => {
  console.log(event.eventId, event.type, event.payload);
});
```

## Fila e TTL

- Se não houver listener em um canal, o evento entra em fila por `moduleId:channel`.
- Com um ou mais listeners registrados, cada evento novo é entregue a todos os listeners (fan-out); nessa situação não se cria fila.
- Quando o primeiro listener for registrado, a fila é drenada em ordem; cada item não expirado é entregue uma vez e todos os itens são removidos da fila, inclusive os expirados.
- Eventos expirados pelo TTL são descartados.
- A fila tem limite de 100 itens por canal; itens antigos são removidos.

## Fluxo do host

O host abre a conexão WebSocket única. Para cada evento validado, publica o
envelope completo com `dispatch("domain", "domain:event", event)` e preserva o
canal tipado existente com `dispatch("domain", event.type, event.payload)`.
Também publica `dispatch("domain", "domain:connection", status)` para comunicar
status de conexão. O envelope completo permite que consumidores dedupliquem
eventos por `eventId` ao atualizar ou invalidar o cache local.

## Contrato de eventos de domínio

O pacote `@mfe/shared` mantém os schemas Zod e os tipos inferidos em
`modules/frontend/packages/shared/src/events.ts`. A fronteira WebSocket valida
envelope e payload antes de publicar o evento no bus; o envelope inclui
`eventId`, `type`, `version`, `source`, `correlationId`, `occurredAt` e,
quando aplicável, `institutionIds`.

Eventos malformados, versões não suportadas e `eventId`s repetidos não são
publicados. Um JSON malformado é reportado, mas não encerra a conexão
WebSocket. Os schemas incluem os eventos de instituição, estudante, matrícula,
usuário e associação de grupo emitidos pelo backend.

## Fallback standalone

Se o host não estiver pronto, os MFEs usam `useDomainEvents` para abrir uma
conexão autenticada de fallback. O hook também consome os envelopes e o status
de conexão publicados pelo host; a deduplicação por `eventId` vale para os dois
fluxos.
