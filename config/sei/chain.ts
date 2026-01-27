// Sei Chain Configuration

export const FACTORY_ADDRESS = "0x71f6b49ae1558357bBb5A6074f1143c46cBcA03d";

export const REFERENCE_TOKEN = "0xE30feDd158A2e3b13e9badaeABaFc5516e95e8C7"; // WSEI
export const STABLE_TOKEN_PAIRS = [
  "0xb243320bcf9c95DB7F74108B6773b8F4Dc3adaF5", // USDC/WSEI pair
]; // Add actual stable token pairs when available

// token where amounts should contribute to tracked volume and liquidity
export const WHITELIST: string[] = [
  "0xE30feDd158A2e3b13e9badaeABaFc5516e95e8C7", // WSEI
  // TODO: Add more whitelist tokens as they become available
];

export const STABLECOINS = [
  "0xe15fC38F6D8c56aF07bbCBe3BAf5708A2Bf42392", // USDC
  "0x9151434b16b9763660705744891fA906F660EcC5", // USDT0
];

// minimum liquidity required to count towards tracked volume for pairs with small # of LPs
export const MINIMUM_USD_THRESHOLD_NEW_PAIRS = "10000";

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
