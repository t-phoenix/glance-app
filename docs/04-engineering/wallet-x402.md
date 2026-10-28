# Wallet and x402 payments

## Model

- **Network:** Base mainnet only (Solana payments failed in testing on Oct 23 with "BlockhashNotFound"; pin `paymentNetwork: base`).
- **Asset:** USDC on Base, `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (taken from the stableenrich 402 response).
- **Scheme:** x402 v2 `exact`. You sign an EIP-3009 `transferWithAuthorization`, and the facilitator submits it and pays the gas. **You need no ETH, and the network fee shown is $0.00.** Show "Network fee: $0.00 · paid by facilitator" so this is clear.
- **Key:** generated on the phone with viem `generatePrivateKey()`, stored in the Keychain (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`). Import is also allowed. Revealing the key needs Face ID and shows a warning screen.
- **Budget:** fund with about $20. Daily cap $2 by default; raising it needs Face ID. Per-call `maxAmount` = listed price × 1.1.

## Wallet screen

| Element | Detail |
|---|---|
| Balance | Large figure, `14.20 USDC`, tabular numbers. "Updated 12 s ago". Pull to refresh. Polled every 30 s while the screen is open. |
| Address | `0x0544…3980` in mono, plus **Copy** and **Show QR** buttons. A full-address sheet with a QR for topping up. Label: "Send USDC on **Base** only". |
| Network fee | "$0.00 · paid by facilitator" with an info button explaining EIP-3009 |
| Today | Progress bar `$0.38 of $2.00`, colour changes at 80% (warning) and 100% (blocked) |
| History | Rows: endpoint name, amount, time, status (paid / paid-failed / rejected). Tap for the tx hash, with a copy button and a BaseScan link. |
| Actions | Top up (shows the address) · Change cap · Export key (Face ID) · Reset wallet (alert dialog, typed confirmation) |

## Payment flow

```
ProviderRegistry → SpendGuard.check(price)            ✗ → W1/W2/W3
  → fetchWithPayment(url, {maxAmount})                 (x402 client, Base)
      402 → parse accepts[] → choose eip155:8453 exact → sign → retry with X-PAYMENT
      200 → read payment-response header → record spend(tx, amount)
      402 again / rejected → W5 → retry once after 2 s → next provider
```

## Errors

| Code | When | Message (to you) | Recovery |
|---|---|---|---|
| W1 | Balance < price | "Wallet low: 0.04 USDC. Lookup needs 0.06." | Banner + Top up sheet; job `blocked_budget` |
| W2 | Daily cap reached | "Today's $2.00 limit reached." | Raise cap (Face ID) or wait until midnight IST |
| W3 | No wallet set up | "Set up the wallet to use paid lookups." | Free providers still work |
| W4 | Asked price > maxAmount | "Service asked for $0.40, more than its listed $0.06. Skipped." | Next provider; logged |
| W5 | Facilitator rejected the payment | "Payment didn't go through (network busy). Trying another source." | Retry once, then next provider |
| W6 | Paid but the response failed | "Paid $0.06 but the service failed. Receipt saved." | No automatic retry; shown in history as paid-failed |
| W7 | Balance RPC failed | "Couldn't refresh balance. Showing last known." | Next RPC; cached value |
| W8 | Key missing or corrupted (Keychain cleared) | "Wallet key not found. Import or create a new one." | Alert; the old balance stays on chain at that address |

## Security

- The key never leaves the Keychain. It isn't in logs, backups or crash reports. The backup contains only the address.
- Only allowlisted origins (`stableenrich.dev`, `stablesocial.dev`) can trigger a payment. Unknown 402s are refused.
- A payment is never made from a URL taken from a QR code.
