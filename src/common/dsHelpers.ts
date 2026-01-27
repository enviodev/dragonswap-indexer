import { BigDecimal, Pair_Burn_event, Pair_Transfer_event } from "generated";
import { LiquidityPosition_t } from "generated/src/db/Entities.gen";
import { HandlerContext } from "generated/src/Types";

export async function createLiquidityPosition(
  context: HandlerContext,
  exchange: string,
  user: string,
): Promise<LiquidityPosition_t> {
  const id = `${exchange}-${user}`;
  let liquidityTokenBalance = await context.LiquidityPosition.get(id);

  if (!liquidityTokenBalance) {
    // update LP pair count
    const pair = await context.Pair.get(exchange);
    if (pair) {
      context.Pair.set({
        ...pair,
        liquidityProviderCount: pair.liquidityProviderCount + BigInt(1),
      });
    } else {
      context.log.error(
        `Pair not found for creating LiquidityPosition: ${exchange}`,
      );
    }

    // create new LiquidityPosition entity
    liquidityTokenBalance = {
      id: id,
      pair_id: exchange,
      user_id: user,
      liquidityTokenBalance: BigDecimal("0"),
    };
    context.LiquidityPosition.set(liquidityTokenBalance);
    return liquidityTokenBalance;
  } else {
    return liquidityTokenBalance;
  }
}

export async function createLiquiditySnapshot(
  context: HandlerContext,
  position: LiquidityPosition_t,
  event: Pair_Transfer_event | Pair_Burn_event,
) {
  const timestamp = event.block.timestamp;
  const bundle = await context.Bundle.get(`1`);
  if (!bundle) {
    context.log.error(`Bundle not found for creating LiquiditySnapshot`);
    return;
  }

  const pair = await context.Pair.get(position.pair_id);
  if (!pair) {
    context.log.error(
      `Pair not found for creating LiquiditySnapshot: ${position.pair_id}`,
    );
    return;
  }

  const [token0, token1] = await Promise.all([
    context.Token.get(pair.token0_id),
    context.Token.get(pair.token1_id),
  ]);

  if (!token0 || !token1) {
    context.log.error(
      `Tokens not found for creating LiquiditySnapshot: ${pair.token0_id}, ${pair.token1_id}`,
    );
    return;
  }

  context.LiquidityPositionSnapshot.set({
    id: `${position.id}-${timestamp.toString()}`,
    liquidityPosition_id: position.id,
    timestamp: timestamp,
    block: event.block.number,
    user_id: position.user_id,
    pair_id: position.pair_id,
    token0PriceUSD: pair.token0Price.times(bundle.ethPrice),
    token1PriceUSD: pair.token1Price.times(bundle.ethPrice),
    reserve0: pair.reserve0,
    reserve1: pair.reserve1,
    reserveUSD: pair.reserveUSD,
    liquidityTokenBalance: position.liquidityTokenBalance,
    liquidityTokenTotalSupply: pair.totalSupply,
  });
}
