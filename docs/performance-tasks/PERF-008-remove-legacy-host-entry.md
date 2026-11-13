# PERF-008 - Remover codigo legado do Host

## Objetivo

Eliminar o entrypoint Express legado se ele nao participar de nenhum comando ou
build ativo.

## Escopo

- Confirmar referencias, scripts e dependencias.
- Remover ou mover o arquivo para documentacao legada.
- Preservar o entrypoint Vite/React e todos os builds.

## Fora do escopo

- Refatorar a navegacao do Host.
- Alterar o carregamento de modulos.

## Validacao

- Busca de referencias no repositorio.
- Build do Host e dos remotes.
- Execucao dos comandos locais documentados.
