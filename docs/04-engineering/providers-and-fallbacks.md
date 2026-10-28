# Providers and fallbacks

Each need has an ordered chain: free first, then paid backup, then manual. The status column comes from [provider-smoke-tests.md](../01-research/provider-smoke-tests.md). **Lock the chain order after the Oct 31 field test** by updating `src/providers/chains.ts`. `HealthCheck` can still demote a provider on the day if it starts failing.

| Need | 1st | 2nd | 3rd | Manual |
|---|---|---|---|---|
| `x.profile` | twitterapi.io `GET /twitter/user/info?userName=` (header `X-API-Key`), about $0.0002 · ⏳ test with key | stablesocial `POST /api/sc/twitter/profile {handle}` $0.06 ✅ | x.com page `og:` tags (free, unreliable) | Screenshot import |
| `x.search_users` | twitterapi.io user search ⏳ confirm endpoint with key | stableenrich Exa search `"<name>" site:x.com` (Exa blocks x.com in includeDomains, so put it in the query text) $0.01 | — | Type handle |
| `x.event_signal` | twitterapi.io advanced search `from:<h> (IBW OR Devcon OR ETHGlobal) since:2026-10-25` ⏳ | — | — | — |
| `linkedin.profile` | Public page `og:title/description` (free) ✅ | stablesocial `POST /api/sc/linkedin/profile {url}` $0.06 ✅ | stableenrich Minerva enrich $0.05 | Paste headline |
| `linkedin.find` | stableenrich Minerva resolve (name + company → URL) $0.02 | Exa search $0.01 | — | Paste URL |
| `telegram.profile` | `t.me/<user>` `og:` tags (free) ✅ | stableenrich Firecrawl scrape $0.0126 | — | Type name |
| `crypto.identity` | web3.bio `GET /profile/<ens|address|farcaster>` (free) ✅ | ENS text records through viem on publicnode ✅ → 1rpc ✅ | — | — |
| `github.profile` | GitHub REST (free, 60 requests/hr) ✅ | — | — | — |
| `web.search` | Exa search $0.01 ✅ (Base) | Firecrawl search $0.025 | — | — |
| `url.preview` (unknown QR) | Direct fetch, no cookies, 5 s, 512 KB cap, text only | Firecrawl scrape $0.0126 | — | Show raw text |
| `transcribe` | whisper.rn on device (free) | Cloud speech-to-text (OpenAI or Groq key, optional) | — | Type the note |
| `ai.structure` | Anthropic `claude-haiku-5-5` | Anthropic `claude-sonnet-5-5` | — | Edit the fields yourself |
| `ai.vision` (badge, avatar compare) | `claude-sonnet-5-5` | `claude-haiku-5-5` | — | Type it |
| `reverse_avatar` | stableenrich Serper Lens $0.20 (only when you ask) | — | — | — |
| `wallet.balance` | `mainnet.base.org` ✅ | `base-rpc.publicnode.com` ✅ | — | Cached value |

✅ = passed the Oct 24 smoke test · ⏳ = not tested yet

## Chain rules

- **Timeouts:** 8 s by default, 20 s for AI, 5 s for previews and RPC.
- **Circuit breaker:** 3 failures in a row → open for 10 minutes → half-open (one test call).
- **Retryable errors:** timeouts, 5xx, 429 (wait for Retry-After) and network errors. **Not retryable:** 400, 401/403 (bad key, so raise "Check API key"), 404 (`gone`).
- **Paid calls** go through SpendGuard first. `maxAmount` is set to the listed price plus 10%. Unstarred stubs never use paid providers (D13).
- **Every call is logged** to `provider_log` (provider, ms, status, cost) so the Settings › Providers screen can show success rate and average time.

## Face and photo policy (D23)

| Allowed | Not allowed |
|---|---|
| Compare *your* photo with avatars of candidates you already found by handle or name ("looks similar" is shown as a weak signal) | Uploading someone's face to open face-search engines (PimEyes, FaceCheck.id) to find out who they are |
| Reverse image search of a candidate's **avatar** (the same image used on other platforms) | Running Lens on a photo of a person's face |
| Lens or vision on **badges, booth banners, slides and name tags** | Storing face embeddings |

Why: identifying strangers from their face without consent conflicts with India's DPDP Act 2023 and with how those services are meant to be used. Google Lens also deliberately avoids identifying people, so results would be poor anyway. The avatar route gives most of the benefit for pseudonymous accounts without that risk.

## Health check

`scripts/health-check.ts` (Node) and Settings › Providers › "Run check" (in the app) call each provider with its `sample` input. Paid providers are skipped unless you tick "include paid" (about $0.20 per full run). Results are written to `provider_health(provider_id, ok, ms, checked_at, error)`. A provider failing two checks in a row is skipped in its chain until it passes again.
