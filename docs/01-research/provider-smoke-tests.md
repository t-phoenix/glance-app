# Provider smoke tests

Run Oct 24, 2026 from a Mac on Indian broadband, with `curl`. Re-run with `scripts/health-check.ts` (see providers-and-fallbacks.md) at the venue on cellular data before relying on any result.

| Provider | Test | Result | Decision |
|---|---|---|---|
| Telegram public page `t.me/<user>` | `og:title`, `og:description`, `og:image` for `durov` | ✅ name, bio and photo returned | **Primary** for Telegram |
| Ethereum RPC publicnode `ethereum-rpc.publicnode.com` | `eth_blockNumber` | ✅ | **Primary** ENS RPC |
| Ethereum RPC 1rpc `1rpc.io/eth` | `eth_blockNumber` | ✅ | **Backup** ENS RPC |
| Ethereum RPC llamarpc | `eth_blockNumber` | ❌ error 525 | Not used |
| Ethereum RPC cloudflare-eth | `eth_blockNumber` | ❌ -32046 "Cannot fulfill request" | Not used |
| Ethereum RPC ankr | `eth_blockNumber` | ❌ needs API key | Not used |
| ensdata.net | `GET /vitalik.eth` | ❌ empty or non-JSON response | Not used |
| **web3.bio** `api.web3.bio/profile/<id>` | `vitalik.eth` | ✅ ENS, Basenames, Farcaster and Lens identities, with linked twitter, github and website | **Primary** crypto identity source (free) |
| Base RPC `mainnet.base.org` | USDC `balanceOf` | ✅ | **Primary** wallet balance |
| Base RPC `base-rpc.publicnode.com` | `eth_blockNumber` | ✅ | **Backup** wallet balance |
| GitHub REST `api.github.com/users/<u>` | `vbuterin` | ✅ (60 requests/hr without a key) | **Primary** GitHub |
| LinkedIn public profile page | `og:title`, `og:description` for a public profile | ✅ name, headline and company, free | **Primary** LinkedIn (free); may hit a login wall from cellular data, so paid is the backup |
| twitterapi.io `/twitter/user/info` | No key | 403 (expected without a key) | **Primary** X once the key is added; re-test with the key |
| stablesocial `/api/sc/linkedin/profile` | Schema check (free) | ✅ POST `{url}`, $0.06 | **Backup** LinkedIn |
| stablesocial `/api/sc/twitter/profile` | Schema check (free) | ✅ POST `{handle}`, $0.06 | **Backup** X |
| stableenrich `/api/exa/search` | Paid call | ✅ on **Base**. ❌ on **Solana**: "BlockhashNotFound" simulation failure | Pin x402 payments to Base |

## Still to test (needs keys or money)

- twitterapi.io: user info, user search and advanced search, with the real key
- Anthropic Messages API from the device: structuring and vision (badge)
- stableenrich `/api/minerva/resolve` ($0.02) and `/api/serper/lens` ($0.20) with one sample each
- whisper.rn `small` model speed on an iPhone 13 with a 60-second Hinglish note
