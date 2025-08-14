// Helper functions from original subgraph helpers
// Reference: original-subgraph/src/common/helpers.ts

import { ZERO_BI, ZERO_BD, ONE_BI } from './constants';
import { BigDecimal } from 'generated';
import { createPublicClient, http, parseAbi } from 'viem';
import * as dotenv from 'dotenv';
import { getStaticDefinition, SKIP_TOTAL_SUPPLY } from './tokenDefinition';

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

// Create a public client for reading contract state
// Using Ethereum mainnet (network ID 1) as default
const publicClient = createPublicClient({
  chain: {
    id: 1,
    name: 'Ethereum',
    network: 'ethereum',
    nativeCurrency: {
      decimals: 18,
      name: 'Ether',
      symbol: 'ETH',
    },
    rpcUrls: {
      default: {
        http: [process.env.RPC_URL || 'https://eth.llamarpc.com'],
      },
      public: {
        http: [process.env.RPC_URL || 'https://eth.llamarpc.com'],
      },
    },
  },
  transport: http(process.env.RPC_URL || 'https://eth.llamarpc.com'),
});

export function exponentToBigDecimal(decimals: bigint): BigDecimal {
  let bd = new BigDecimal(1);
  for (let i = ZERO_BI; i < decimals; i = i + ONE_BI) {
    bd = bd.times(new BigDecimal(10));
  }
  return bd;
}

export function bigDecimalExp18(): BigDecimal {
  return new BigDecimal('1000000000000000000');
}

export function convertEthToDecimal(eth: bigint): BigDecimal {
  return new BigDecimal(eth.toString()).div(exponentToBigDecimal(BigInt(18)));
}

export function convertTokenToDecimal(tokenAmount: bigint, exchangeDecimals: bigint): BigDecimal {
  if (exchangeDecimals == ZERO_BI) {
    return new BigDecimal(tokenAmount.toString());
  }
  return new BigDecimal(tokenAmount.toString()).div(exponentToBigDecimal(exchangeDecimals));
}

export function equalToZero(value: BigDecimal): boolean {
  return value.isEqualTo(ZERO_BD);
}

export function isNullEthValue(value: string): boolean {
  return value == '0x0000000000000000000000000000000000000000000000000000000000000001';
}

// Implement token metadata fetching using Viem RPC calls
// Following the original subgraph logic with fallback handling for broken tokens

export async function fetchTokenSymbol(tokenAddress: string): Promise<string> {
  // Static definitions overrides
  const staticDefinition = getStaticDefinition(tokenAddress);
  if (staticDefinition !== null) {
    return staticDefinition.symbol;
  }

  try {
    // Try standard ERC20 symbol first
    const symbol = await publicClient.readContract({
      address: tokenAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'symbol',
    });
    
    if (symbol && symbol !== '') {
      return symbol;
    }
  } catch (error) {
    // Fallback to bytes32 symbol for broken tokens
    try {
      const symbolBytes = await publicClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: ERC20_SYMBOL_BYTES_ABI,
        functionName: 'symbol',
      });
      
      if (symbolBytes && !isNullEthValue(symbolBytes)) {
        return symbolBytes;
      }
    } catch (fallbackError) {
      // Both attempts failed
    }
  }
  
  return 'unknown';
}

export async function fetchTokenName(tokenAddress: string): Promise<string> {
  // Static definitions overrides
  const staticDefinition = getStaticDefinition(tokenAddress);
  if (staticDefinition !== null) {
    return staticDefinition.name;
  }

  try {
    // Try standard ERC20 name first
    const name = await publicClient.readContract({
      address: tokenAddress as `0x${string}`,
      abi: ERC20_ABI,
        functionName: 'name',
    });
    
    if (name && name !== '') {
      return name;
    }
  } catch (error) {
    // Fallback to bytes32 name for broken tokens
    try {
      const nameBytes = await publicClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: ERC20_NAME_BYTES_ABI,
        functionName: 'name',
      });
      
      if (nameBytes && !isNullEthValue(nameBytes)) {
        return nameBytes;
      }
    } catch (fallbackError) {
      // Both attempts failed
    }
  }
  
  return 'unknown';
}

export async function fetchTokenDecimals(tokenAddress: string): Promise<bigint | null> {
  // Static definitions overrides
  const staticDefinition = getStaticDefinition(tokenAddress);
  if (staticDefinition !== null) {
    return staticDefinition.decimals;
  }

  try {
    const decimals = await publicClient.readContract({
      address: tokenAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'decimals',
    });
    
    if (decimals !== null && decimals !== undefined) {
      return BigInt(decimals);
    }
  } catch (error) {
    // Return null if decimals call fails
  }
  
  return null;
}

export async function fetchTokenTotalSupply(tokenAddress: string): Promise<bigint> {
  // Skip specific tokens that have issues with totalSupply
  if (SKIP_TOTAL_SUPPLY.includes(tokenAddress.toLowerCase())) {
    return ZERO_BI;
  }

  try {
    const totalSupply = await publicClient.readContract({
      address: tokenAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'totalSupply',
    });
    
    if (totalSupply !== null && totalSupply !== undefined) {
      return totalSupply;
    }
  } catch (error) {
    // Return ZERO_BI if totalSupply call fails
  }
  
  return ZERO_BI;
}

// Note: This function needs to be called from within handlers where context is available
// The context parameter will be passed from the handler
export function createUser(address: string, context: any): void {
  // Check if user already exists
  const existingUser = context.User.get(address);
  if (!existingUser) {
    // Create new user entity
    const user = {
      id: address,
      // Add any other user fields that might be needed
      // For now, just the ID is sufficient
    };
    context.User.set(user);
  }
}
