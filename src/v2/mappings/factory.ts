// Implement business logic from subgraph
// Reference: original-subgraph/src/v2/mappings/factory.ts

import {
  Factory,
} from "generated";
import { 
  UniswapFactory_t,
  Token_t,
  Pair_t,
  Bundle_t,
  PairTokenLookup_t,
} from "generated/src/db/Entities.gen";
import { ZERO_BD, ZERO_BI, FACTORY_ADDRESS } from "../../common/constants";
import { 
  fetchTokenDecimals, 
  fetchTokenName, 
  fetchTokenSymbol, 
  fetchTokenTotalSupply 
} from "../../common/helpers";

// Register dynamic Pair contracts with Envio
Factory.PairCreated.contractRegister(({ event, context }) => {
  context.addPair(event.params.pair);
});

// Implement handleNewPair function
// Reference: original-subgraph/src/v2/mappings/factory.ts - handleNewPair
Factory.PairCreated.handler(async ({ event, context }) => {
  try {
    // 1. Load/Create UniswapFactory entity (id: FACTORY_ADDRESS)
    let factory = await context.UniswapFactory.get(FACTORY_ADDRESS);
    if (!factory) {
      factory = {
        id: FACTORY_ADDRESS,
        pairCount: 0,
        totalVolumeUSD: ZERO_BD,
        totalVolumeETH: ZERO_BD,
        untrackedVolumeUSD: ZERO_BD,
        totalLiquidityUSD: ZERO_BD,
        totalLiquidityETH: ZERO_BD,
        txCount: ZERO_BI,
      };
    }

    // Increment pair count
    const updatedFactory: UniswapFactory_t = {
      ...factory,
      pairCount: factory.pairCount + 1,
    };
    context.UniswapFactory.set(updatedFactory);

    // 2. Load/Create Bundle entity (id: '1')
    let bundle = await context.Bundle.get('1');
    if (!bundle) {
      bundle = {
        id: '1',
        ethPrice: ZERO_BD,
      };
      context.Bundle.set(bundle);
    }

    // 3. Load/Create Token entities for token0 and token1
    let token0 = await context.Token.get(event.params.token0);
    if (!token0) {
      // Fetch token metadata
      const symbol0 = await fetchTokenSymbol(event.params.token0);
      const name0 = await fetchTokenName(event.params.token0);
      const totalSupply0 = await fetchTokenTotalSupply(event.params.token0);
      const decimals0 = await fetchTokenDecimals(event.params.token0);

      // Bail if we couldn't figure out the decimals
      if (decimals0 === null) {
        context.log.debug('mybug the decimal on token 0 was null');
        return;
      }

      token0 = {
        id: event.params.token0,
        symbol: symbol0,
        name: name0,
        decimals: decimals0,
        totalSupply: totalSupply0,
        derivedETH: ZERO_BD,
        tradeVolume: ZERO_BD,
        tradeVolumeUSD: ZERO_BD,
        untrackedVolumeUSD: ZERO_BD,
        totalLiquidity: ZERO_BD,
        txCount: ZERO_BI,
      };
      context.Token.set(token0);
    }

    let token1 = await context.Token.get(event.params.token1);
    if (!token1) {
      // Fetch token metadata
      const symbol1 = await fetchTokenSymbol(event.params.token1);
      const name1 = await fetchTokenName(event.params.token1);
      const totalSupply1 = await fetchTokenTotalSupply(event.params.token1);
      const decimals1 = await fetchTokenDecimals(event.params.token1);

      // Bail if we couldn't figure out the decimals
      if (decimals1 === null) {
        return;
      }

      token1 = {
        id: event.params.token1,
        symbol: symbol1,
        name: name1,
        decimals: decimals1,
        totalSupply: totalSupply1,
        derivedETH: ZERO_BD,
        tradeVolume: ZERO_BD,
        tradeVolumeUSD: ZERO_BD,
        untrackedVolumeUSD: ZERO_BD,
        totalLiquidity: ZERO_BD,
        txCount: ZERO_BI,
      };
      context.Token.set(token1);
    }

    // 4. Create new Pair entity
    const pair: Pair_t = {
      id: event.params.pair,
      token0_id: token0.id,
      token1_id: token1.id,
      reserve0: ZERO_BD,
      reserve1: ZERO_BD,
      totalSupply: ZERO_BD,
      reserveETH: ZERO_BD,
      reserveUSD: ZERO_BD,
      trackedReserveETH: ZERO_BD,
      token0Price: ZERO_BD,
      token1Price: ZERO_BD,
      volumeToken0: ZERO_BD,
      volumeToken1: ZERO_BD,
      volumeUSD: ZERO_BD,
      untrackedVolumeUSD: ZERO_BD,
      txCount: ZERO_BI,
      createdAtTimestamp: BigInt(event.block.timestamp),
      createdAtBlockNumber: BigInt(event.block.number),
      liquidityProviderCount: ZERO_BI,
    };
    context.Pair.set(pair);

    // 5. Create PairTokenLookup entities for both token orderings
    const pairLookup0: PairTokenLookup_t = {
      id: `${event.params.token0}-${event.params.token1}`,
      pair_id: pair.id,
    };
    context.PairTokenLookup.set(pairLookup0);

    const pairLookup1: PairTokenLookup_t = {
      id: `${event.params.token1}-${event.params.token0}`,
      pair_id: pair.id,
    };
    context.PairTokenLookup.set(pairLookup1);

    context.log.info(`Created new pair: ${event.params.pair} for tokens ${event.params.token0} and ${event.params.token1}`);

  } catch (error) {
    context.log.error(`Error in handleNewPair: ${error}`);
    // Don't throw - let the indexer continue
  }
});
