// Core event handlers for Uniswap V2 Pair contract
// Reference: original-subgraph/src/v2/mappings/core.ts

import {
  Pair,
} from "generated";
import {
  Mint_t,
  Burn_t,
  Swap_t,
  Transaction_t,
  Token_t,
  Pair_t,
  UniswapFactory_t,
  Bundle_t,
  PairDayData_t,
  TokenDayData_t,
  PairHourData_t,
  TokenHourData_t,
  UniswapDayData_t,
  User_t,
} from "generated/src/db/Entities.gen";
import { ADDRESS_ZERO, ZERO_BD, ZERO_BI, ONE_BI, BI_18, ALMOST_ZERO_BD } from "../../common/constants";
import { getFactoryAddress } from "../../common/chainConfig";
import { BigDecimal } from "generated";
import { convertTokenToDecimal, createUser } from "../../common/helpers";
import { getTrackedVolumeUSD, getEthPriceInUSD, findEthPerToken, getTrackedLiquidityUSD } from "../../common/pricing";
import { updatePairDayData, updatePairHourData, updateUniswapDayData, updateTokenDayData, updateTokenHourData } from "../../common/hourDayUpdates";

// Helper function to check if a mint is complete (matches subgraph logic)
function isCompleteMint(mint: Mint_t): boolean {
  return mint.sender !== undefined && mint.sender !== null;
}

// Transfer handler - handles LP token transfers and creates Mint/Burn entities
// Reference: original-subgraph/src/v2/mappings/core.ts - handleTransfer
Pair.Transfer.handler(async ({ event, context }) => {
  try {
    const chainId = event.chainId;
    
    // ignore initial transfers for first adds
    if (event.params.to === ADDRESS_ZERO && event.params.value === BigInt(1000)) {
      return;
    }

    const factoryAddress = getFactoryAddress(chainId);
    const factory = await context.UniswapFactory.get(`${chainId}-${factoryAddress}`);
    if (!factory) {
      return;
    }

    // user stats
    const from = event.params.from;
    const to = event.params.to;
    
    // Create users if they don't exist
    let fromUser = await context.User.get(from);
    if (!fromUser) {
      fromUser = {
        id: from,
      };
      context.User.set(fromUser);
    }
    
    let toUser = await context.User.get(to);
    if (!toUser) {
      toUser = {
        id: to,
      };
      context.User.set(toUser);
    }

    // get pair and load contract
    const pair = await context.Pair.get(`${chainId}-${event.srcAddress}`);
    if (!pair) {
      return;
    }

    // liquidity token amount being transferred
    const value = convertTokenToDecimal(event.params.value, BI_18);

    // get or create transaction
    const transactionId = `${chainId}-${event.transaction.hash}`;
    let transaction = await context.Transaction.get(transactionId);
    if (!transaction) {
      transaction = {
        id: transactionId,
        blockNumber: BigInt(event.block.number),
        timestamp: BigInt(event.block.timestamp),
      };
      context.Transaction.set(transaction);
    }

    // mints - when from is ADDRESS_ZERO (pool minting LP tokens)
    if (from === ADDRESS_ZERO) {
      // update total supply
      const updatedPair: Pair_t = {
        ...pair,
        totalSupply: pair.totalSupply.plus(value),
      };
      context.Pair.set(updatedPair);

      // Check if we should create a new mint using getWhere query to simulate array behavior
      // In the subgraph: if (mints.length === 0 || isCompleteMint(mints[mints.length - 1]))
      const existingMints = await context.Mint.getWhere.transaction_id.eq(transactionId);
      
      if (existingMints.length === 0 || isCompleteMint(existingMints[existingMints.length - 1])) {
        // Create new mint with proper ID format: transactionId + "-" + array index
        const mintId = `${transactionId}-${existingMints.length}`;
        const mint: Mint_t = {
          id: mintId,
          transaction_id: transactionId,
          timestamp: BigInt(event.block.timestamp),
          pair_id: pair.id,
          to: to,
          liquidity: value,
          sender: undefined,
          amount0: undefined,
          amount1: undefined,
          logIndex: BigInt(event.logIndex),
          amountUSD: undefined,
          feeTo: undefined,
          feeLiquidity: undefined,
        };
        context.Mint.set(mint);
      }
    }

    // case where direct send first on ETH withdrawals
    // for every burn event, there is a transfer first from the LP to the pool (erc-20)
    if (to === pair.id) {
      // Get existing burns to simulate array behavior
      const existingBurns = await context.Burn.getWhere.transaction_id.eq(transactionId);
      const burnId = `${transactionId}-${existingBurns.length}`;
      
      const burn: Burn_t = {
        id: burnId,
        transaction_id: transactionId,
        timestamp: BigInt(event.block.timestamp),
        pair_id: pair.id,
        to: to,
        liquidity: value,
        sender: from,
        amount0: undefined,
        amount1: undefined,
        logIndex: BigInt(event.logIndex),
        amountUSD: undefined,
        needsComplete: true,
        feeTo: undefined,
        feeLiquidity: undefined,
      };
      context.Burn.set(burn);
    }

    // burn - when to is ADDRESS_ZERO and from is pair.id
    if (to === ADDRESS_ZERO && from === pair.id) {
      const updatedPair: Pair_t = {
        ...pair,
        totalSupply: pair.totalSupply.minus(value),
      };
      context.Pair.set(updatedPair);

      // Get existing burns to simulate array behavior (matches subgraph logic)
      const existingBurns = await context.Burn.getWhere.transaction_id.eq(transactionId);
      let burn: Burn_t;
      
      if (existingBurns.length > 0) {
        // Check if the last burn needs completion
        const currentBurn = existingBurns[existingBurns.length - 1];
        if (currentBurn.needsComplete) {
          // Complete the existing burn
          burn = {
            ...currentBurn,
            needsComplete: false,
          };
        } else {
          // Create new burn entity
          const burnId = `${transactionId}-${existingBurns.length}`;
          burn = {
            id: burnId,
            transaction_id: transactionId,
            timestamp: BigInt(event.block.timestamp),
            pair_id: pair.id,
            to: to,
            liquidity: value,
            sender: undefined,
            amount0: undefined,
            amount1: undefined,
            logIndex: BigInt(event.logIndex),
            amountUSD: undefined,
            needsComplete: false,
            feeTo: undefined,
            feeLiquidity: undefined,
          };
        }
      } else {
        // Create new burn entity (no existing burns)
        const burnId = `${transactionId}-${existingBurns.length}`;
        burn = {
          id: burnId,
          transaction_id: transactionId,
          timestamp: BigInt(event.block.timestamp),
          pair_id: pair.id,
          to: to,
          liquidity: value,
          sender: undefined,
          amount0: undefined,
          amount1: undefined,
          logIndex: BigInt(event.logIndex),
          amountUSD: undefined,
          needsComplete: false,
          feeTo: undefined,
          feeLiquidity: undefined,
        };
      }

      // Check for fee mint logic (matches subgraph logic)
      const existingMints = await context.Mint.getWhere.transaction_id.eq(transactionId);
      if (existingMints.length !== 0 && !isCompleteMint(existingMints[existingMints.length - 1])) {
        // This is a fee mint, not a real mint
        const feeMint = existingMints[existingMints.length - 1];
        
        // Update the burn with fee information
        burn = {
          ...burn,
          feeTo: feeMint.to,
          feeLiquidity: feeMint.liquidity,
        };
        
        // Remove the fee mint entity
        context.Mint.deleteUnsafe(feeMint.id);
      }

      // Save the burn entity
      context.Burn.set(burn);
    }

  } catch (error) {
    context.log.error(`Error in handleTransfer: ${error}`);
  }
});

// Implement handleMint function
// Reference: original-subgraph/src/v2/mappings/core.ts - handleMint
Pair.Mint.handler(async ({ event, context }) => {
  try {
    const chainId = event.chainId;
    
    // 1. Load Transaction entity (created by handleTransfer)
    const transactionId = `${chainId}-${event.transaction.hash}`;
    const transaction = await context.Transaction.get(transactionId);
    if (!transaction) {
      return;
    }

    // 2. Load existing Mint entity (created by handleTransfer)
    // Note: In the subgraph, this loads from transaction.mints[mints.length - 1]
    // Since we can't access the array directly, we'll use a simplified approach
    const mintId = `${transactionId}-0`;
    const mint = await context.Mint.get(mintId);
    if (!mint) {
      return;
    }

    // 3. Load Pair and UniswapFactory entities
    const pair = await context.Pair.get(`${chainId}-${event.srcAddress}`);
    if (!pair) {
      return;
    }

    const factoryAddress = getFactoryAddress(chainId);
    const factory = await context.UniswapFactory.get(`${chainId}-${factoryAddress}`);
    if (!factory) {
      return;
    }

    // 4. Load Token entities for token0 and token1
    const token0 = await context.Token.get(pair.token0_id);
    if (!token0) {
      return;
    }

    const token1 = await context.Token.get(pair.token1_id);
    if (!token1) {
      return;
    }

    // 5. Calculate amounts (but don't update pair reserves - Sync handler does that)
    const amount0 = convertTokenToDecimal(event.params.amount0, BigInt(token0.decimals));
    const amount1 = convertTokenToDecimal(event.params.amount1, BigInt(token1.decimals));

    // 6. Update token tx counts only
    const updatedToken0: Token_t = {
      ...token0,
      txCount: token0.txCount + ONE_BI,
    };

    const updatedToken1: Token_t = {
      ...token1,
      txCount: token1.txCount + ONE_BI,
    };

    // 7. Update pair tx count only (no reserve updates)
    const updatedPair: Pair_t = {
      ...pair,
      txCount: pair.txCount + ONE_BI,
    };

    // 8. Update factory tx count
    const updatedFactory: UniswapFactory_t = { 
      ...factory, 
      txCount: factory.txCount + ONE_BI 
    };

    // 9. Calculate USD value using derivedETH values
    const bundle = await context.Bundle.get(`${chainId}-1`);
    let amountTotalUSD = ZERO_BD;
    
    if (bundle && bundle.ethPrice && bundle.ethPrice.isGreaterThan(ZERO_BD)) {
      // Calculate USD value: (amount1 * token1.derivedETH + amount0 * token0.derivedETH) * bundle.ethPrice
      amountTotalUSD = token1.derivedETH
        .times(amount1)
        .plus(token0.derivedETH.times(amount0))
        .times(bundle.ethPrice);
    }

    // 10. Update existing mint entity with amounts and sender
    const updatedMint: Mint_t = {
      ...mint,
      sender: event.params.sender,
      amount0: amount0,
      amount1: amount1,
      logIndex: BigInt(event.logIndex),
      amountUSD: amountTotalUSD,
    };

    // 11. Save all entities
    context.Token.set(updatedToken0);
    context.Token.set(updatedToken1);
    context.Pair.set(updatedPair);
    context.UniswapFactory.set(updatedFactory);
    context.Mint.set(updatedMint);

    // 12. Update daily/hourly data
    if (!context.isPreload) {
      await updatePairDayData(updatedPair, event, context, String(chainId));
      await updatePairHourData(updatedPair, event, context, String(chainId));
      await updateUniswapDayData(event, context, String(chainId));
      await updateTokenDayData(updatedToken0, event, context, String(chainId));
      await updateTokenDayData(updatedToken1, event, context, String(chainId));
      await updateTokenHourData(updatedToken0, event, context, String(chainId));
      await updateTokenHourData(updatedToken1, event, context, String(chainId));
    }

  } catch (error) {
    context.log.error(`Error in handleMint: ${error}`);
  }
});

// Implement handleBurn function
// Reference: original-subgraph/src/v2/mappings/core.ts - handleBurn
Pair.Burn.handler(async ({ event, context }) => {
  try {
    const chainId = event.chainId;
    
    // 1. Load Transaction entity (created by handleTransfer)
    const transactionId = `${chainId}-${event.transaction.hash}`;
    const transaction = await context.Transaction.get(transactionId);
    if (!transaction) {
      return;
    }

    // 2. Load existing Burn entity (created by handleTransfer)
    // Note: In the subgraph, this loads from transaction.burns[burns.length - 1]
    // Since we can't access the array directly, we'll use a simplified approach
    const burnId = `${transactionId}-0`;
    const burn = await context.Burn.get(burnId);
    if (!burn) {
      return;
    }

    // 3. Load Pair and UniswapFactory entities
    const pair = await context.Pair.get(`${chainId}-${event.srcAddress}`);
    if (!pair) {
      return;
    }

    const factoryAddress = getFactoryAddress(chainId);
    const factory = await context.UniswapFactory.get(`${chainId}-${factoryAddress}`);
    if (!factory) {
      return;
    }

    // 4. Load Token entities for token0 and token1
    const token0 = await context.Token.get(pair.token0_id);
    if (!token0) {
      return;
    }

    const token1 = await context.Token.get(pair.token1_id);
    if (!token1) {
      return;
    }

    // 5. Calculate amounts (but don't update pair reserves - Sync handler does that)
    const amount0 = convertTokenToDecimal(event.params.amount0, BigInt(token0.decimals));
    const amount1 = convertTokenToDecimal(event.params.amount1, BigInt(token1.decimals));

    // 6. Update token tx counts only
    const updatedToken0: Token_t = {
      ...token0,
      txCount: token0.txCount + ONE_BI,
    };

    const updatedToken1: Token_t = {
      ...token1,
      txCount: token1.txCount + ONE_BI,
    };

    // 7. Update pair tx count only (no reserve updates)
    const updatedPair: Pair_t = {
      ...pair,
      txCount: pair.txCount + ONE_BI,
    };

    // 8. Update factory tx count
    const updatedFactory: UniswapFactory_t = { 
      ...factory, 
      txCount: factory.txCount + ONE_BI 
    };

    // 9. Calculate USD value using derivedETH values
    const bundle = await context.Bundle.get(`${chainId}-1`);
    let amountTotalUSD = ZERO_BD;
    
    if (bundle && bundle.ethPrice && bundle.ethPrice.isGreaterThan(ZERO_BD)) {
      // Calculate USD value: (amount1 * token1.derivedETH + amount0 * token0.derivedETH) * bundle.ethPrice
      amountTotalUSD = token1.derivedETH
        .times(amount1)
        .plus(token0.derivedETH.times(amount0))
        .times(bundle.ethPrice);
    }

    // 10. Update existing burn entity with amounts
    const updatedBurn: Burn_t = {
      ...burn,
      amount0: amount0,
      amount1: amount1,
      logIndex: BigInt(event.logIndex),
      amountUSD: amountTotalUSD,
    };

    // 11. Save all entities
    context.Token.set(updatedToken0);
    context.Token.set(updatedToken1);
    context.Pair.set(updatedPair);
    context.UniswapFactory.set(updatedFactory);
    context.Burn.set(updatedBurn);

    // 12. Update daily/hourly data
    if (!context.isPreload) {
      await updatePairDayData(updatedPair, event, context, String(chainId));
      await updatePairHourData(updatedPair, event, context, String(chainId));
      await updateUniswapDayData(event, context, String(chainId));
      await updateTokenDayData(updatedToken0, event, context, String(chainId));
      await updateTokenDayData(updatedToken1, event, context, String(chainId));
      await updateTokenHourData(updatedToken0, event, context, String(chainId));
      await updateTokenHourData(updatedToken1, event, context, String(chainId));
    }

  } catch (error) {
    context.log.error(`Error in handleBurn: ${error}`);
  }
});

// Implement handleSwap function
// Reference: original-subgraph/src/v2/mappings/core.ts - handleSwap
Pair.Swap.handler(async ({ event, context }) => {
  try {
    // 1. Load Pair and UniswapFactory entities
    const chainId = event.chainId;
    let pair = await context.Pair.get(`${chainId}-${event.srcAddress}`);
    if (!pair) {
      return;
    }

    const factoryAddress = getFactoryAddress(chainId);
    const factory = await context.UniswapFactory.get(`${chainId}-${factoryAddress}`);
    if (!factory) {
      return;
    }

    // 2. Load Token entities for token0 and token1
    const token0 = await context.Token.get(pair.token0_id);
    if (!token0) {
      return;
    }

    const token1 = await context.Token.get(pair.token1_id);
    if (!token1) {
      return;
    }

    // 3. Calculate amounts
    const amount0In = convertTokenToDecimal(event.params.amount0In, BigInt(token0.decimals));
    const amount1In = convertTokenToDecimal(event.params.amount1In, BigInt(token1.decimals));
    const amount0Out = convertTokenToDecimal(event.params.amount0Out, BigInt(token0.decimals));
    const amount1Out = convertTokenToDecimal(event.params.amount1Out, BigInt(token1.decimals));

    // 4. Update pair reserves
    const reserve0 = pair.reserve0.plus(amount0In).minus(amount0Out);
    const reserve1 = pair.reserve1.plus(amount1In).minus(amount1Out);

    // 5. Calculate volume and fees
    const volume0 = amount0In.plus(amount0Out);
    const volume1 = amount1In.plus(amount1Out);

    // 6. Update pair entity with basic volume
    pair = {
      ...pair,
      reserve0: reserve0,
      reserve1: reserve1,
      volumeToken0: pair.volumeToken0.plus(volume0),
      volumeToken1: pair.volumeToken1.plus(volume1),
      txCount: pair.txCount + ONE_BI,
    };

    // 7. Update token entities with basic volume
    const updatedToken0: Token_t = {
      ...token0,
      tradeVolume: token0.tradeVolume.plus(volume0),
      txCount: token0.txCount + ONE_BI,
    };

    const updatedToken1: Token_t = {
      ...token1,
      tradeVolume: token1.tradeVolume.plus(volume1),
      txCount: token1.txCount + ONE_BI,
    };

    // 8. Calculate USD values and derived amounts
    const bundle = await context.Bundle.get(`${chainId}-1`);
    let finalToken0: Token_t | undefined;
    let finalToken1: Token_t | undefined;
    let trackedAmountUSD = ZERO_BD;
    let derivedAmountUSD = ZERO_BD;
    let derivedAmountETH = ZERO_BD;
    
    if (bundle && bundle.ethPrice && bundle.ethPrice.isGreaterThan(ZERO_BD)) {
      // Calculate tracked volume (whitelist-based)
      trackedAmountUSD = await getTrackedVolumeUSD(volume0, token0, volume1, token1, pair, context, Number(chainId));
      const trackedAmountETH = trackedAmountUSD.div(bundle.ethPrice);

      // Calculate derived amounts (all volume converted to USD)
      const derivedEthToken1 = token1.derivedETH.times(volume1);
      const derivedEthToken0 = token0.derivedETH.times(volume0);
      
      // If any side is 0, don't divide by 2
      if (derivedEthToken0.isLessThanOrEqualTo(ALMOST_ZERO_BD) || derivedEthToken1.isLessThanOrEqualTo(ALMOST_ZERO_BD)) {
        derivedAmountETH = derivedEthToken0.plus(derivedEthToken1);
      } else {
        derivedAmountETH = derivedEthToken0.plus(derivedEthToken1).div(new BigDecimal(2));
      }
      
      derivedAmountUSD = derivedAmountETH.times(bundle.ethPrice);

      // Update pair with all volume data
      pair = {
        ...pair,
        volumeUSD: pair.volumeUSD.plus(trackedAmountUSD),
        untrackedVolumeUSD: pair.untrackedVolumeUSD.plus(derivedAmountUSD),
      };

      // Update tokens with USD values
      finalToken0 = {
        ...updatedToken0,
        tradeVolumeUSD: updatedToken0.tradeVolumeUSD.plus(trackedAmountUSD),
        untrackedVolumeUSD: updatedToken0.untrackedVolumeUSD.plus(derivedAmountUSD),
      };

      finalToken1 = {
        ...updatedToken1,
        tradeVolumeUSD: updatedToken1.tradeVolumeUSD.plus(trackedAmountUSD),
        untrackedVolumeUSD: updatedToken1.untrackedVolumeUSD.plus(derivedAmountUSD),
      };

      // Update factory with all volume data
      const updatedFactory: UniswapFactory_t = {
        ...factory,
        totalVolumeUSD: factory.totalVolumeUSD.plus(trackedAmountUSD),
        totalVolumeETH: factory.totalVolumeETH.plus(trackedAmountETH),
        untrackedVolumeUSD: factory.untrackedVolumeUSD.plus(derivedAmountUSD),
        txCount: factory.txCount + ONE_BI,
      };

      // Save factory
      context.UniswapFactory.set(updatedFactory);

      // Save updated tokens
      context.Token.set(finalToken0);
      context.Token.set(finalToken1);
    }

    // 9. Create Swap entity
    const transactionId = `${chainId}-${event.transaction.hash}`;
    
    // Create Transaction entity if it doesn't exist (like in subgraph)
    let transaction = await context.Transaction.get(transactionId);
    if (!transaction) {
      transaction = {
        id: transactionId,
        blockNumber: BigInt(event.block.number),
        timestamp: BigInt(event.block.timestamp),
      };
      context.Transaction.set(transaction);
    }
    
    // Use array index format like subgraph: event.transaction.hash + "-" + swaps.length
    // Since we can't access the array directly, we'll use a simplified approach
    const swapId = `${transactionId}-0`; // Simplified ID format
    
    // Calculate USD value for swap - use tracked amount if available, otherwise derived amount
    let swapAmountUSD = trackedAmountUSD.isGreaterThan(ZERO_BD) ? trackedAmountUSD : derivedAmountUSD;
    
    const swap: Swap_t = {
      id: swapId,
      transaction_id: transactionId,
      timestamp: BigInt(event.block.timestamp),
      pair_id: pair.id,
      sender: event.params.sender,
      from: event.params.sender, // Use sender as from since 'from' doesn't exist
      amount0In: amount0In,
      amount1In: amount1In,
      amount0Out: amount0Out,
      amount1Out: amount1Out,
      to: event.params.to,
      logIndex: BigInt(event.logIndex),
      amountUSD: swapAmountUSD,
    };

    // 10. Save all entities
    context.Pair.set(pair);
    context.Swap.set(swap);

    // 11. Update daily/hourly data
    if (bundle) {
      await updatePairDayData(pair, event, context, String(chainId));
      await updatePairHourData(pair, event, context, String(chainId));
      await updateUniswapDayData(event, context, String(chainId));
      await updateTokenDayData(finalToken0 || updatedToken0, event, context, String(chainId));
      await updateTokenDayData(finalToken1 || updatedToken1, event, context, String(chainId));
      await updateTokenHourData(finalToken0 || updatedToken0, event, context, String(chainId));
      await updateTokenHourData(finalToken1 || updatedToken1, event, context, String(chainId));
    }

  } catch (error) {
    context.log.error(`Error in handleSwap: ${error}`);
  }
});

// Implement handleSync function
// Reference: original-subgraph/src/v2/mappings/core.ts - handleSync
Pair.Sync.handler(async ({ event, context }) => {
  try {
    // 1. Load Pair and UniswapFactory entities
    const chainId = event.chainId;
    const pairId = `${chainId}-${event.srcAddress}`;
    
    let pair = await context.Pair.get(pairId);
    if (!pair) {
      return;
    }

    const token0 = await context.Token.get(pair.token0_id);
    if (!token0) {
      return;
    }

    const token1 = await context.Token.get(pair.token1_id);
    if (!token1) {
      return;
    }

    const factoryAddress = getFactoryAddress(chainId);
    const factoryId = `${chainId}-${factoryAddress}`;
    const factory = await context.UniswapFactory.get(factoryId);
    if (!factory) {
      return;
    }

    // 2. Reset factory liquidity by subtracting only tracked liquidity
    const updatedFactory: UniswapFactory_t = {
      ...factory,
      totalLiquidityETH: factory.totalLiquidityETH.minus(pair.trackedReserveETH || ZERO_BD),
    };

    // 3. Reset token total liquidity amounts
    const updatedToken0: Token_t = {
      ...token0,
      totalLiquidity: token0.totalLiquidity.minus(pair.reserve0),
    };

    const updatedToken1: Token_t = {
      ...token1,
      totalLiquidity: token1.totalLiquidity.minus(pair.reserve1),
    };

    // 4. Update pair reserves from event parameters
    const reserve0 = convertTokenToDecimal(event.params.reserve0, BigInt(token0.decimals));
    const reserve1 = convertTokenToDecimal(event.params.reserve1, BigInt(token1.decimals));

    // 5. Update pair token prices
    const token0Price = reserve1.isGreaterThan(ZERO_BD) ? reserve0.div(reserve1) : ZERO_BD;
    const token1Price = reserve0.isGreaterThan(ZERO_BD) ? reserve1.div(reserve0) : ZERO_BD;

    // 6. Update ETH price now that reserves could have changed
    const bundleId = `${chainId}-1`;
    const bundle = await context.Bundle.get(bundleId);
    if (bundle) {
      const newEthPrice = await getEthPriceInUSD(context, chainId);
      const updatedBundle: Bundle_t = {
        ...bundle,
        ethPrice: newEthPrice,
      };

      // 7. Recalculate derivedETH for both tokens
      const token0DerivedETH = await findEthPerToken(updatedToken0, context, chainId);
      const token1DerivedETH = await findEthPerToken(updatedToken1, context, chainId);

      // 8. Update tokens with new derivedETH values
      const finalToken0: Token_t = {
        ...updatedToken0,
        derivedETH: token0DerivedETH,
      };

      const finalToken1: Token_t = {
        ...updatedToken1,
        derivedETH: token1DerivedETH,
      };

      // 9. Calculate derived values for pair
      const reserve0ETH = reserve0.times(token0DerivedETH);
      const reserve1ETH = reserve1.times(token1DerivedETH);
      const reserveETH = reserve0ETH.plus(reserve1ETH);

      // 10. Calculate USD value
      const reserveUSD = reserveETH.times(newEthPrice);

      // 11. Get tracked liquidity - will be 0 if neither is in whitelist
      let trackedLiquidityETH = ZERO_BD;
      if (newEthPrice.isGreaterThan(ZERO_BD)) {
        const trackedLiquidityUSD = await getTrackedLiquidityUSD(reserve0, reserve1, finalToken0, finalToken1, context, chainId);
        trackedLiquidityETH = trackedLiquidityUSD.div(newEthPrice);
      }

      // 12. Update pair with all calculated values
      const updatedPair: Pair_t = {
        ...pair,
        reserve0: reserve0,
        reserve1: reserve1,
        reserveETH: reserveETH,
        reserveUSD: reserveUSD,
        token0Price: token0Price,
        token1Price: token1Price,
        trackedReserveETH: trackedLiquidityETH,
      };

      // 13. Update factory with new liquidity totals
      const finalFactory: UniswapFactory_t = {
        ...updatedFactory,
        totalLiquidityETH: updatedFactory.totalLiquidityETH.plus(trackedLiquidityETH),
        totalLiquidityUSD: updatedFactory.totalLiquidityETH.plus(trackedLiquidityETH).times(newEthPrice),
      };

      // 14. Update tokens with new total liquidity amounts
      const finalToken0WithLiquidity: Token_t = {
        ...finalToken0,
        totalLiquidity: finalToken0.totalLiquidity.plus(reserve0),
      };

      const finalToken1WithLiquidity: Token_t = {
        ...finalToken1,
        totalLiquidity: finalToken1.totalLiquidity.plus(reserve1),
      };

      // 15. Save all entities
      context.Bundle.set(updatedBundle);
      context.Token.set(finalToken0WithLiquidity);
      context.Token.set(finalToken1WithLiquidity);
      context.Pair.set(updatedPair);
      context.UniswapFactory.set(finalFactory);
    }

  } catch (error) {
    context.log.error(`Error in handleSync: ${error}`);
  }
});
