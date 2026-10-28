import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { createWalletClient, encodeFunctionData, http, isAddress } from 'viem';
import { base } from 'viem/chains';

export const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const RPCS = ['https://mainnet.base.org', 'https://base-rpc.publicnode.com', 'https://base.llamarpc.com', 'https://1rpc.io/base'];

const TRANSFER = [
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
] as const;

export function createWallet(): { privateKey: `0x${string}`; address: `0x${string}` } {
  const privateKey = generatePrivateKey();
  return { privateKey, address: privateKeyToAccount(privateKey).address };
}

export function addressFromKey(privateKey: `0x${string}`): `0x${string}` {
  return privateKeyToAccount(privateKey).address;
}

export async function readUsdcBalance(address: string): Promise<number> {
  const data = encodeFunctionData({
    abi: [{ type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] }],
    functionName: 'balanceOf',
    args: [address as `0x${string}`],
  });
  let lastError: unknown;
  for (const rpc of RPCS) {
    try {
      const response = await fetch(rpc, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: USDC, data }, 'latest'] }),
      });
      const json = (await response.json()) as { result?: string; error?: { message?: string } };
      if (!json.result) throw new Error(json.error?.message || 'rpc');
      return Number(BigInt(json.result)) / 1_000_000;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error('rpc');
}

export function usdcToUnits(amount: string): bigint | null {
  const trimmed = amount.trim();
  if (!/^\d+(\.\d{1,6})?$/.test(trimmed)) return null;
  const [whole = '0', frac = ''] = trimmed.split('.');
  if (whole.length > 12) return null;
  const units = BigInt(whole) * 1_000_000n + BigInt((frac + '000000').slice(0, 6));
  return units > 0n ? units : null;
}

export function walletReplaceAllowed(existingAddress: string | null, nextAddress: string, phrase: string): boolean {
  if (!existingAddress) return true;
  if (existingAddress.toLowerCase() === nextAddress.toLowerCase()) return true;
  return phrase.trim() === 'REPLACE';
}

export function isEthAddress(value: string): value is `0x${string}` {
  return isAddress(value);
}

export async function readEthBalance(address: string): Promise<number> {
  let lastError: unknown;
  for (const rpc of RPCS) {
    try {
      const response = await fetch(rpc, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getBalance', params: [address, 'latest'] }),
      });
      const json = (await response.json()) as { result?: string; error?: { message?: string } };
      if (!json.result) throw new Error(json.error?.message || 'rpc');
      return Number(BigInt(json.result)) / 1e18;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error('rpc');
}

export async function sendUsdc(privateKey: `0x${string}`, to: `0x${string}`, units: bigint): Promise<`0x${string}`> {
  const account = privateKeyToAccount(privateKey);
  let lastError: unknown;
  for (const rpc of RPCS) {
    try {
      const client = createWalletClient({ account, chain: base, transport: http(rpc) });
      return await client.writeContract({
        address: USDC,
        abi: TRANSFER,
        functionName: 'transfer',
        args: [to, units],
      });
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error('send');
}

export function shortAddress(address: string): string {
  if (address.length < 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

const PAY_HOSTS = ['stablesocial.dev', 'stableenrich.dev'];

export function paymentAllowed(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return PAY_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
  } catch {
    return false;
  }
}
