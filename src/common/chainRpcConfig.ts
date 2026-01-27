// Multichain RPC Configuration
// Centralized configuration for all supported chains

export interface ChainRpcConfig {
  chainId: number;
  name: string;
  network: string;
  nativeCurrency: {
    decimals: number;
    name: string;
    symbol: string;
  };
  rpcUrl: string | undefined;
  blockExplorer?: string;
}

// Environment variable mapping for RPC URLs
const RPC_URLS = {
  1329: process.env.ENVIO_CHAIN_1329_RPC_URL,
} as const;

// Chain configurations
export const CHAIN_CONFIGS: Record<number, ChainRpcConfig> = {
  1329: {
    chainId: 1329,
    name: "Sei",
    network: "sei",
    nativeCurrency: {
      decimals: 18,
      name: "Sei",
      symbol: "SEI",
    },
    rpcUrl: RPC_URLS[1329],
    blockExplorer: "https://seiscan.io",
  },
};

// Helper function to get chain config by chain ID
export function getChainConfig(chainId: number): ChainRpcConfig {
  const config = CHAIN_CONFIGS[chainId];
  if (!config) {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }

  // Validate that RPC URL is provided
  if (!config.rpcUrl) {
    throw new Error(
      `RPC URL not configured for chain ID ${chainId}. Please set ENVIO_CHAIN_${chainId}_RPC_URL in your .env file.`,
    );
  }

  return config;
}

// Helper function to check if chain is supported
export function isChainSupported(chainId: number): boolean {
  return chainId in CHAIN_CONFIGS;
}

// Get all supported chain IDs
export function getSupportedChainIds(): number[] {
  return Object.keys(CHAIN_CONFIGS).map(Number);
}

// Export RPC URLs for direct access if needed
export { RPC_URLS };
