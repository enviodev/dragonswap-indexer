// Sei Chain Configuration

export const FACTORY_ADDRESS = "0x71f6b49ae1558357bBb5A6074f1143c46cBcA03d";

export const REFERENCE_TOKEN = "0xE30feDd158A2e3b13e9badaeABaFc5516e95e8C7"; // WSEI
export const STABLE_TOKEN_PAIRS = [
  "0xC75C669a62A7eCe0C8d37904b747970467432ad3", // USDC.n/WSEI pair
  "0x8D5261cFF8d63E71C772574EbA63E64E6726EE06", // USDT/WSEI pair
]; // Add actual stable token pairs when available

// token where amounts should contribute to tracked volume and liquidity
export const WHITELIST: string[] = [
  "0xE30feDd158A2e3b13e9badaeABaFc5516e95e8C7", // wsei
  "0xB75D0B03c06A926e488e2659DF1A861F860bD3d1", // usdt
  "0x3894085Ef7Ff0f0aeDf52E2A2704928d1Ec074F1", // usdc
  "0x5Cf6826140C1C56Ff49C808A1A75407Cd1DF9423", // iSEI
  "0x5f0E07dFeE5832Faa00c63F2D33A0D79150E8598", // SEIYAN
  "0xC18b6a15FB0ceaf5eb18696EeFCb5bc7b9107149", // Popo The Cat
  // TODO: Add more whitelist tokens as they become available
];

export const STABLECOINS = [
  "0x3894085Ef7Ff0f0aeDf52E2A2704928d1Ec074F1", // USDC.n Noble USDC
  "0xB75D0B03c06A926e488e2659DF1A861F860bD3d1", // USDT
];

// minimum liquidity required to count towards tracked volume for pairs with small # of LPs
export const MINIMUM_USD_THRESHOLD_NEW_PAIRS = "4000";

// minimum liquidity for price to get tracked
export const MINIMUM_LIQUIDITY_THRESHOLD_ETH = "1";

export interface TokenDefinition {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
}

export const STATIC_TOKEN_DEFINITIONS: TokenDefinition[] = [];

export const SKIP_TOTAL_SUPPLY: string[] = [];
