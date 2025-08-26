// Hour and day update helper functions from original subgraph
// Reference: original-subgraph/src/common/hourDayUpdates.ts
// All helper functions have been implemented below

import { BigDecimal } from "generated";
import { ZERO_BD, ZERO_BI, ONE_BI } from "./constants";
import { getFactoryAddress } from "./chainConfig";
import {
  UniswapFactory_t,
  UniswapDayData_t,
  PairDayData_t,
  PairHourData_t,
  TokenDayData_t,
  TokenHourData_t,
  Token_t,
  Bundle_t,
} from "generated/src/db/Entities.gen";

export async function updateUniswapDayData(
  event: any,
  context: any,
  chainId: string
): Promise<UniswapDayData_t> {
      const factoryAddress = getFactoryAddress(Number(chainId));
    const uniswap = await context.UniswapFactory.get(`${chainId}-${factoryAddress}`);
  if (!uniswap) {
    throw new Error('Factory not found for updateUniswapDayData');
  }

  const timestamp = Number(event.block.timestamp);
  const dayID = Math.floor(timestamp / 86400);
  const dayStartTimestamp = dayID * 86400;
  let uniswapDayData = await context.UniswapDayData.get(`${chainId}-${dayID}`);

  if (!uniswapDayData) {
    uniswapDayData = {
      id: `${chainId}-${dayID}`,
      date: dayStartTimestamp, // Int field - remove BigInt wrapper
      dailyVolumeUSD: ZERO_BD,
      dailyVolumeETH: ZERO_BD,
      dailyVolumeUntracked: ZERO_BD,
      totalVolumeUSD: ZERO_BD, // Add missing field from schema
      totalVolumeETH: ZERO_BD,
      totalLiquidityUSD: ZERO_BD,
      totalLiquidityETH: ZERO_BD,
      txCount: ZERO_BI,
    };
  }

  uniswapDayData.totalLiquidityUSD = uniswap.totalLiquidityUSD;
  uniswapDayData.totalLiquidityETH = uniswap.totalLiquidityETH;
  uniswapDayData.txCount = uniswap.txCount;
  context.UniswapDayData.set(uniswapDayData);

  return uniswapDayData;
}

export async function updatePairDayData(
  pair: any,
  event: any,
  context: any,
  chainId: string
): Promise<any> {
  const timestamp = Number(event.block.timestamp);
  const dayID = Math.floor(timestamp / 86400);
  const dayStartTimestamp = dayID * 86400;
  
  // Use pairAddress for ID generation and pairAddress field
  const dayPairID = `${chainId}-${event.srcAddress}-${dayID}`;
  
  let pairDayData = await context.PairDayData.get(dayPairID);

  if (!pairDayData) {
    pairDayData = {
      id: dayPairID,
      date: dayStartTimestamp, // Int field
      token0_id: pair.token0_id, // Token! field - use token0_id for relationship
      token1_id: pair.token1_id, // Token! field - use token1_id for relationship
      pairAddress: event.srcAddress, // Bytes field
      // Reserve fields as BigDecimal
      reserve0: ZERO_BD,
      reserve1: ZERO_BD,
      // Total supply as BigDecimal
      totalSupply: ZERO_BD,
      // Reserve USD as BigDecimal
      reserveUSD: ZERO_BD,
      // Volume fields as BigDecimal
      dailyVolumeToken0: ZERO_BD,
      dailyVolumeToken1: ZERO_BD,
      dailyVolumeUSD: ZERO_BD,
      // Daily transactions as BigInt
      dailyTxns: ZERO_BI, // BigInt field
    };
  }

  // Update all fields as strings
  pairDayData.totalSupply = pair.totalSupply
  pairDayData.reserve0 = pair.reserve0
  pairDayData.reserve1 = pair.reserve1
  pairDayData.reserveUSD = pair.reserveUSD
  
  // Update dailyTxns as BigInt
  const currentTxns = pairDayData.dailyTxns;
  pairDayData.dailyTxns = currentTxns + ONE_BI;
  
  context.PairDayData.set(pairDayData);

  return pairDayData;
}

export async function updatePairHourData(
  pair: any,
  event: any,
  context: any,
  chainId: string
): Promise<any> {
  const timestamp = Number(event.block.timestamp);
  const hourIndex = Math.floor(timestamp / 3600);
  const hourStartUnix = hourIndex * 3600;
  const hourPairID = `${chainId}-${event.srcAddress}-${hourIndex}`;
  let pairHourData = await context.PairHourData.get(hourPairID);

  if (!pairHourData) {
    pairHourData = {
      id: hourPairID,
      hourStartUnix: hourStartUnix,
      pair_id: `${chainId}-${event.srcAddress}`, // Use pair_id for relationship
      hourlyVolumeToken0: ZERO_BD,
      hourlyVolumeToken1: ZERO_BD,
      hourlyVolumeUSD: ZERO_BD,
      hourlyTxns: ZERO_BI,
      totalSupply: ZERO_BD,
      reserve0: ZERO_BD,
      reserve1: ZERO_BD,
      reserveUSD: ZERO_BD,
    };
  }

  pairHourData.totalSupply = pair.totalSupply;
  pairHourData.reserve0 = pair.reserve0;
  pairHourData.reserve1 = pair.reserve1;
  pairHourData.reserveUSD = pair.reserveUSD;
  pairHourData.hourlyTxns = pairHourData.hourlyTxns + ONE_BI;
  context.PairHourData.set(pairHourData);

  return pairHourData;
}

export async function updateTokenDayData(
  token: any,
  event: any,
  context: any,
  chainId: string
): Promise<any> {
  const bundle = await context.Bundle.get(`${chainId}-1`);
  if (!bundle) {
    throw new Error('Bundle not found for updateTokenDayData');
  }

  const timestamp = Number(event.block.timestamp);
  const dayID = Math.floor(timestamp / 86400);
  const dayStartTimestamp = dayID * 86400;
  const tokenDayID = `${chainId}-${token.id}-${dayID}`;
  let tokenDayData = await context.TokenDayData.get(tokenDayID);

  if (!tokenDayData) {
    tokenDayData = {
      id: tokenDayID,
      date: dayStartTimestamp, // Int field - remove BigInt wrapper
      token_id: token.id, // Token! field - use token_id for relationship
      priceUSD: token.derivedETH * bundle.ethPrice,
      dailyVolumeToken: ZERO_BD,
      dailyVolumeETH: ZERO_BD,
      dailyVolumeUSD: ZERO_BD,
      dailyTxns: ZERO_BI,
      totalLiquidityUSD: ZERO_BD,
      totalLiquidityToken: ZERO_BD,
      totalLiquidityETH: ZERO_BD,
    };
  }

  tokenDayData.priceUSD = token.derivedETH * bundle.ethPrice;
  tokenDayData.totalLiquidityToken = token.totalLiquidity;
  tokenDayData.totalLiquidityETH = token.totalLiquidity * token.derivedETH;
  tokenDayData.totalLiquidityUSD = tokenDayData.totalLiquidityETH * bundle.ethPrice;
  tokenDayData.dailyTxns = tokenDayData.dailyTxns + ONE_BI; // Use ONE_BI constant instead of BigInt(1)
  context.TokenDayData.set(tokenDayData);

  return tokenDayData;
}

export async function updateTokenHourData(
  token: any,
  event: any,
  context: any,
  chainId: string
): Promise<any> {
  const bundle = await context.Bundle.get(`${chainId}-1`);
  if (!bundle) {
    throw new Error('Bundle not found for updateTokenHourData');
  }

  const timestamp = Number(event.block.timestamp);
  const hourIndex = Math.floor(timestamp / 3600);
  const hourStartUnix = hourIndex * 3600;
  const tokenHourID = `${chainId}-${token.id}-${hourIndex}`;
  let tokenHourData = await context.TokenHourData.get(tokenHourID);
  const tokenPrice = token.derivedETH * bundle.ethPrice;
  let isNew = false;

  if (!tokenHourData) {
    tokenHourData = {
      id: tokenHourID,
      periodStartUnix: hourStartUnix,
      token_id: token.id,
      volume: ZERO_BD,
      volumeUSD: ZERO_BD,
      untrackedVolumeUSD: ZERO_BD,
      feesUSD: ZERO_BD,
      openPrice: tokenPrice,
      highPrice: tokenPrice,
      lowPrice: tokenPrice,
      closePrice: tokenPrice,
      priceUSD: tokenPrice,
      totalValueLocked: ZERO_BD,
      totalValueLockedUSD: ZERO_BD,
    };

    const tokenHourArray = [...token.hourArray, hourIndex];
    const updatedToken = {
      ...token,
      hourArray: tokenHourArray,
    };
    context.Token.set(updatedToken);
    isNew = true;
  }

  if (tokenPrice > tokenHourData.highPrice) {
    tokenHourData.highPrice = tokenPrice;
  }

  if (tokenPrice < tokenHourData.lowPrice) {
    tokenHourData.lowPrice = tokenPrice;
  }

  tokenHourData.closePrice = tokenPrice;
  tokenHourData.priceUSD = tokenPrice;
  context.TokenHourData.set(tokenHourData);

  if (token.lastHourArchived === BigInt(0) && token.lastHourRecorded === BigInt(0)) {
    const updatedToken = {
      ...token,
      lastHourRecorded: BigInt(hourIndex),
      lastHourArchived: BigInt(hourIndex - 1),
    };
    context.Token.set(updatedToken);
  }

  if (isNew) {
    const lastHourArchived = Number(token.lastHourArchived);
    const stop = hourIndex - 768;
    if (stop > lastHourArchived) {
      await archiveHourData(token, stop, context, chainId);
    }
    const updatedToken = {
      ...token,
      lastHourRecorded: BigInt(hourIndex),
    };
    context.Token.set(updatedToken);
  }

  return tokenHourData;
}

async function archiveHourData(
  token: any,
  stop: number,
  context: any,
  chainId: string
): Promise<void> {
  const length = token.hourArray.length;
  const array = [...token.hourArray];
  const modArray = [...token.hourArray];

  for (let i = 0; i < length; i++) {
    if (array[i] <= stop) {
      modArray.splice(i, 1);
    }
  }

  const updatedToken = {
    ...token,
    hourArray: modArray,
    lastHourArchived: BigInt(stop),
  };
  context.Token.set(updatedToken);
}
