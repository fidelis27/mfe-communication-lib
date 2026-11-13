# PERF-006 - Instrumentar prontidao dos modulos

## Objetivo

Registrar quando cada modulo carregado pelo Host fica montado e pronto.

## Status e implementacao

O Host usa `moduleLifeCycleEvent.onMounted` para registrar remote-ready depois
que o componente de cada modulo foi montado. O consumidor `<Module>` exibe o
loading e o fallback com retry; `onError` encaminha falhas para o Sentry.
`mfe:remote-ready` representa o estado pronto, nao o inicio e fim do fetch do
bundle.

## Escopo

- Marcar a prontidao de cada modulo montado.
- Associar a medicao ao nome do modulo.
- Reportar erros de carregamento ao Sentry.
- Preservar loading, fallback e retry.

## Fora do escopo

- Precarregar todos os remotes.
- Alterar a navegacao ou a politica de cache sem medicao.

## Validacao

- Testes automatizados verificam que o evento ready e emitido no callback de
  montagem do modulo.
- O tempo medido termina no primeiro mount; ele nao e uma medida de LCP nem
  cobre o inicio do fetch do manifesto.
- Medicoes de rota e render devem ser coletadas com a metodologia descrita em
  [`performance-lib-comparison.md`](../performance-lib-comparison.md).
