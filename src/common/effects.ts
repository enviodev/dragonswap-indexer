// Effect API implementations for token metadata fetching
// This replaces direct RPC calls with Envio's Effect API for better performance

import { experimental_createEffect, S } from "envio";
import { createPublicClient, http, parseAbi } from 'viem';
import * as dotenv from 'dotenv';
import { getStaticDefinition, SKIP_TOTAL_SUPPLY } from './tokenDefinition';
import { ZERO_BI } from './constants';

// Load environment variables
dotenv.config();

// ERC20 ABI for basic token functions
const ERC20_ABI = parseAbi([
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
]);

// ERC20 Symbol Bytes ABI for fallback
const ERC20_SYMBOL_BYTES_ABI = parseAbi([
  'function symbol() view returns (bytes32)',
]);

// ERC20 Name Bytes ABI for fallback
const ERC20_NAME_BYTES_ABI = parseAbi([
  'function name() view returns (bytes32)',
]);

// Create a public client with batching enabled for better performance
const publicClient = createPublicClient({
  chain: {
    id: 10143,
    name: 'Monad Testnet',
    network: 'Monad Testnet',
    nativeCurrency: {
      decimals: 18,
      name: 'MON',
      symbol: 'NATIVE',
    },
    rpcUrls: {
      default: {
        http: [process.env.ENVIO_CHAIN_10143_RPC_URL || 'http://localhost:8545'],
      },
      public: {
        http: [process.env.ENVIO_CHAIN_10143_RPC_URL || 'http://localhost:8545'],
      },
    },
  },
  // Disable batching to avoid rate limiting on Monad testnet
  transport: http(process.env.ENVIO_CHAIN_10143_RPC_URL || 'http://localhost:8545', { 
    batch: false, // Disable batching to avoid rate limiting
    retryCount: 5, // Increase retries
    retryDelay: 2000, // Increase delay between retries
    timeout: 20000, // Increase timeout to 20 seconds
  }),
});

// Helper function to check for null ETH values
function isNullEthValue(value: string): boolean {
  return value == '0x0000000000000000000000000000000000000000000000000000000000000001';
}

// Helper function to safely make RPC calls with timeout
async function safeRpcCall<T>(
  callFn: () => Promise<T>,
  fallbackValue: T,
  context: any,
  tokenAddress: string,
  operation: string
): Promise<T> {
  try {
    const result = await Promise.race([
      callFn(),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('RPC timeout')), 20000) // Increased timeout to match transport
      )
    ]);
    
    if (result !== null && result !== undefined) {
      return result;
    }
  } catch (error) {
    context.log.warn(`${operation} RPC call failed for token ${tokenAddress}: ${error}`);
  }
  
  return fallbackValue;
}

// Effect to fetch token symbol with fallback logic
export const getTokenSymbol = experimental_createEffect(
  {
    name: "getTokenSymbol",
    input: S.string, // token address
    output: S.string, // symbol
    cache: false, // Enable caching for better performance
  },
  async ({ input: tokenAddress, context }) => {
    try {
      // Static definitions overrides
      const staticDefinition = getStaticDefinition(tokenAddress);
      if (staticDefinition !== undefined) {
        // Using static definition
        return staticDefinition.symbol;
      }

      // Try standard ERC20 symbol first
      const symbol = await safeRpcCall(
        () => publicClient.readContract({
          address: tokenAddress as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'symbol',
        }),
        '',
        context,
        tokenAddress,
        'Symbol'
      );
      
      if (symbol && symbol !== '') {
        // Symbol fetched successfully
        return symbol;
      }
      
      // Fallback to bytes32 symbol for broken tokens
      const symbolBytes = await safeRpcCall(
        () => publicClient.readContract({
          address: tokenAddress as `0x${string}`,
          abi: ERC20_SYMBOL_BYTES_ABI,
          functionName: 'symbol',
        }),
        '',
        context,
        tokenAddress,
        'Bytes32 Symbol'
      );
      
      if (symbolBytes && !isNullEthValue(symbolBytes)) {
        // Bytes32 symbol fetched successfully
        return symbolBytes;
      }
    } catch (error) {
      context.log.warn(`Unexpected error in getTokenSymbol for token ${tokenAddress}: ${error}`);
    }
    
    context.log.warn(`All symbol attempts failed for token ${tokenAddress}, returning 'UNKNOWN'`);
    return 'UNKNOWN';
  }
);

// Effect to fetch token name with fallback logic
export const getTokenName = experimental_createEffect(
  {
    name: "getTokenName",
    input: S.string, // token address
    output: S.string, // name
    cache: false, // Enable caching for better performance
  },
  async ({ input: tokenAddress, context }) => {
    try {
      // Static definitions overrides
      const staticDefinition = getStaticDefinition(tokenAddress);
      if (staticDefinition !== undefined) {
        // Using static definition
        return staticDefinition.name;
      }

      // Try standard ERC20 name first
      const name = await publicClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'name',
      });
      
      if (name && name !== '') {
        // Name fetched successfully
        return name;
      }
    } catch (error) {
      context.log.warn(`Standard name call failed for token ${tokenAddress}: ${error}`);
      
      // Fallback to bytes32 name for broken tokens
      try {
        const nameBytes = await publicClient.readContract({
          address: tokenAddress as `0x${string}`,
          abi: ERC20_NAME_BYTES_ABI,
          functionName: 'name',
        });
        
        if (nameBytes && !isNullEthValue(nameBytes)) {
          // Bytes32 name fetched successfully
          return nameBytes;
        }
      } catch (fallbackError) {
        context.log.warn(`Bytes32 name fallback also failed for token ${tokenAddress}: ${fallbackError}`);
      }
    }
    
    context.log.warn(`All name attempts failed for token ${tokenAddress}, returning 'Unknown Token'`);
    return 'Unknown Token';
  }
);

// Effect to fetch token decimals
export const getTokenDecimals = experimental_createEffect(
  {
    name: "getTokenDecimals",
    input: S.string, // token address
    output: S.bigint, // decimals (required, but we'll handle failures gracefully)
    cache: false, // Enable caching for better performance
  },
  async ({ input: tokenAddress, context }) => {
    try {
      // Static definitions overrides
      const staticDefinition = getStaticDefinition(tokenAddress);
      if (staticDefinition !== undefined) {
        // Using static definition
        return BigInt(staticDefinition.decimals);
      }

      const decimals = await publicClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'decimals',
      });
      
      // Ensure we always return a valid bigint
      if (decimals !== null && decimals !== undefined) {
        // Decimals fetched successfully
        return BigInt(decimals);
      }
    } catch (error) {
      context.log.warn(`Decimals call failed for token ${tokenAddress}: ${error}`);
    }
    
    // Return default 18 decimals if everything fails
    context.log.warn(`Returning default 18 decimals for token ${tokenAddress}`);
    return BigInt(18);
  }
);

// Effect to fetch token total supply
export const getTokenTotalSupply = experimental_createEffect(
  {
    name: "getTokenTotalSupply",
    input: S.string, // token address
    output: S.bigint, // total supply
    cache: false, // Enable caching for better performance
  },
  async ({ input: tokenAddress, context }) => {
    try {
      // Skip specific tokens that have issues with totalSupply
      if (SKIP_TOTAL_SUPPLY.includes(tokenAddress.toLowerCase())) {
        // Skipping totalSupply (in SKIP_TOTAL_SUPPLY list)
        return ZERO_BI;
      }

      const totalSupply = await publicClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'totalSupply',
      });
      
      if (totalSupply !== null && totalSupply !== undefined) {
        // TotalSupply fetched successfully
        return totalSupply;
      }
    } catch (error) {
      context.log.warn(`TotalSupply call failed for token ${tokenAddress}: ${error}`);
    }
    
    context.log.warn(`Returning ZERO_BI totalSupply for token ${tokenAddress}`);
    return ZERO_BI;
  }
);
