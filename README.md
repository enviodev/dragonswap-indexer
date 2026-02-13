## DragonSwap Indexer

_Please refer to the [documentation website](https://docs.envio.dev) for a thorough guide on all [Envio](https://envio.dev) indexer features_

### Run

```bash
pnpm dev
```

Visit http://localhost:8080 to see the GraphQL Playground, local password is `testing`.

### Generate files from `config.yaml` or `schema.graphql`

```bash
pnpm codegen
```

### Pre-requisites

- [Node.js (use v18 or newer)](https://nodejs.org/en/download/current)
- [pnpm (use v8 or newer)](https://pnpm.io/installation)
- [Docker desktop](https://www.docker.com/products/docker-desktop/)

## Notes

If you're running this indexer for the first time or on local for development, your performance of your indexer depends on RPS of your RPC which is used to read current blockchain state. On hosted service, if indexer has cache turned on then you can share that cache between deployment which will increase performance of your indexer.

### Migration Progress

- [x] Transfer
- [x] Sync
- [x] Mint
- [x] Burn
- [x] Swap
