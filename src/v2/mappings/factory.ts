// Factory event handler for Uniswap V2 Factory contract
// Reference: original-subgraph/src/v2/mappings/factory.ts

import {
  Factory,  // Contract handler for Factory events
  Pair,    // Contract handler for Pair events
  Token,   // Contract handler for Token events
  UniswapFactory,  // Contract handler for UniswapFactory events
  Bundle,  // Contract handler for Bundle events
  PairTokenLookup,  // Contract handler for PairTokenLookup events
} from "generated";
import {
  Pair_t,
  Token_t,
  UniswapFactory_t,
  Bundle_t,
  PairTokenLookup_t,
} from "generated/src/db/Entities.gen";
import { ZERO_BD, ZERO_BI, FACTORY_ADDRESS } from "../../common/constants";
import { getTokenSymbol, getTokenName, getTokenTotalSupply, getTokenDecimals } from "../../common/effects";

// Register dynamic Pair contracts with Envio
Factory.PairCreated.contractRegister(({ event, context }) => {
  // Register the pair contract with Envio's dynamic contract tracking
  // This tells Envio to index events from this newly created pair contract
  context.log.info(`About to add: ${event.params.pair}`);
  context.addPair(event.params.pair);
  context.log.info(`Registered pair contract: ${event.params.pair}`);
});

// Implement handleNewPair function
// Reference: original-subgraph/src/v2/mappings/core.ts - handleNewPair
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

    // Update factory pair count
    const updatedFactory: UniswapFactory_t = {
      ...factory,
      pairCount: factory.pairCount + 1,
    };
    context.log.info(`About to set factory with pairCount: ${updatedFactory.pairCount}`);
    context.UniswapFactory.set(updatedFactory);
    context.log.info(`Factory set successfully`);

    // 2. Load/Create Bundle entity (id: '1')
    const chainId = event.chainId;
    let bundle = await context.Bundle.get(`${chainId}-1`);
    if (!bundle) {
      context.log.info(`Creating new Bundle entity for chainId: ${chainId}`);
      bundle = {
        id: `${chainId}-1`,
        ethPrice: ZERO_BD,
      };
      context.log.info(`About to set bundle: ${bundle.id}`);
      context.Bundle.set(bundle);
      context.log.info(`Bundle set successfully`);
    }

    // 3. Load/Create Token entities for token0 and token1
    let token0 = await context.Token.get(`${chainId}-${event.params.token0}`);
    if (!token0) {
      context.log.info(`Token0 not found, fetching metadata for: ${event.params.token0}`);
      try {
        // Fetch token metadata using Effect API
        const [symbol0, name0, totalSupply0, decimals0] = await Promise.all([
          context.effect(getTokenSymbol, event.params.token0),
          context.effect(getTokenName, event.params.token0),
          context.effect(getTokenTotalSupply, event.params.token0),
          context.effect(getTokenDecimals, event.params.token0)
        ]);
        
        context.log.info(`Token0 metadata fetched: symbol=${symbol0}, name=${name0}, decimals=${decimals0}, totalSupply=${totalSupply0}`);
        
        // Bail if we couldn't figure out the decimals
        if (decimals0 === undefined) {
          context.log.error(`Failed to get decimals for token0: ${event.params.token0}`);
          return;
        }

        token0 = {
          id: `${chainId}-${event.params.token0}`,
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
          lastHourArchived: ZERO_BI,
          lastHourRecorded: ZERO_BI,
          hourArray: [],
        };
        context.log.info(`Setting token0: ${token0.symbol} (${token0.name})`);
        context.Token.set(token0);
      } catch (error) {
        context.log.error(`Error fetching token0 metadata: ${error}`);
        throw error; // Re-throw to fail the transaction
      }
    }

    let token1 = await context.Token.get(`${chainId}-${event.params.token1}`);
    if (!token1) {
      context.log.info(`Token1 not found, fetching metadata for: ${event.params.token1}`);
      try {
        // Fetch token metadata using Effect API
        const [symbol1, name1, totalSupply1, decimals1] = await Promise.all([
          context.effect(getTokenSymbol, event.params.token1),
          context.effect(getTokenName, event.params.token1),
          context.effect(getTokenTotalSupply, event.params.token1),
          context.effect(getTokenDecimals, event.params.token1)
        ]);
        
        context.log.info(`Token1 metadata fetched: symbol=${symbol1}, name=${name1}, decimals=${decimals1}, totalSupply=${totalSupply1}`);
        
        // Bail if we couldn't figure out the decimals
        if (decimals1 === undefined) {
          context.log.error(`Failed to get decimals for token1: ${event.params.token1}`);
          return;
        }

        token1 = {
          id: `${chainId}-${event.params.token1}`,
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
          lastHourArchived: ZERO_BI,
          lastHourRecorded: ZERO_BI,
          hourArray: [],
        };
        context.log.info(`Setting token1: ${token1.symbol} (${token1.name})`);
        context.Token.set(token1);
      } catch (error) {
        context.log.error(`Error fetching token1 metadata: ${error}`);
        throw error; // Re-throw to fail the transaction
      }
    }

    // 4. Create new Pair entity
    const pair: Pair_t = {
      id: `${chainId}-${event.params.pair}`,
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
    context.log.info(`About to set pair: ${pair.id}`);
    context.Pair.set(pair);
    context.log.info(`Pair set successfully`);

    // 5. Create PairTokenLookup entities for efficient token-pair lookups
    const pairLookup0: PairTokenLookup_t = {
      id: `${chainId}-${event.params.token0}-${event.params.pair}`,
      pair_id: pair.id,
    };
    context.log.info(`About to set pairLookup0: ${pairLookup0.id}`);
    context.PairTokenLookup.set(pairLookup0);
    context.log.info(`PairLookup0 set successfully`);

    const pairLookup1: PairTokenLookup_t = {
      id: `${chainId}-${event.params.token1}-${event.params.pair}`,
      pair_id: pair.id,
    };
    context.log.info(`About to set pairLookup1: ${pairLookup1.id}`);
    context.PairTokenLookup.set(pairLookup1);
    context.log.info(`PairLookup1 set successfully`);

    context.log.info(`All database operations completed successfully for pair: ${event.params.pair}`);

  } catch (error) {
    context.log.error(`Error in handleNewPair: ${error}`);
  }
});
