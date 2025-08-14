/*
 * Please refer to https://docs.envio.dev for a thorough guide on all Envio indexer features
 */
import {
  Factory,
  Factory_PairCreated,
  Pair,
  Pair_Burn,
  Pair_Mint,
  Pair_Swap,
  Pair_Sync,
  Pair_Transfer,
} from "generated";

// TODO: Implement business logic from subgraph
// Reference: original-subgraph/src/v2/mappings/factory.ts - handleNewPair
Factory.PairCreated.handler(async ({ event, context }) => {
  // TODO: Implement business logic from subgraph
  // Reference: original-subgraph/src/v2/mappings/factory.ts
});

// TODO: Implement business logic from subgraph
// Reference: original-subgraph/src/v2/mappings/core.ts - handleMint
Pair.Mint.handler(async ({ event, context }) => {
  // TODO: Implement business logic from subgraph
  // Reference: original-subgraph/src/v2/mappings/core.ts
});

// TODO: Implement business logic from subgraph
// Reference: original-subgraph/src/v2/mappings/core.ts - handleBurn
Pair.Burn.handler(async ({ event, context }) => {
  // TODO: Implement business logic from subgraph
  // Reference: original-subgraph/src/v2/mappings/core.ts
});

// TODO: Implement business logic from subgraph
// Reference: original-subgraph/src/v2/mappings/core.ts - handleSwap
Pair.Swap.handler(async ({ event, context }) => {
  // TODO: Implement business logic from subgraph
  // Reference: original-subgraph/src/v2/mappings/core.ts
});

// TODO: Implement business logic from subgraph
// Reference: original-subgraph/src/v2/mappings/core.ts - handleTransfer
Pair.Transfer.handler(async ({ event, context }) => {
  // TODO: Implement business logic from subgraph
  // Reference: original-subgraph/src/v2/mappings/core.ts
});

// TODO: Implement business logic from subgraph
// Reference: original-subgraph/src/v2/mappings/core.ts - handleSync
Pair.Sync.handler(async ({ event, context }) => {
  // TODO: Implement business logic from subgraph
  // Reference: original-subgraph/src/v2/mappings/core.ts
});
