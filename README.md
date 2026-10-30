# Glance

Glance today, know them tomorrow.

A personal iOS app for remembering the people you meet at Mumbai's crypto week: IBW (Nov 1–2), Devcon (Nov 3–6) and ETHGlobal. Scan a person's QR or badge, take a photo, record a voice note, and Glance builds a single profile for them across X, LinkedIn, Telegram and WhatsApp. Every link between accounts is confirmed by you, and every promise you made becomes a follow-up.

- **Platform:** iOS (iPhone 13), React Native + Expo dev build, installed with a free Apple ID
- **Backend:** none. Data stays on the phone (SQLite plus files). Paid lookups are made with x402 micropayments in USDC on Base.
- **Status:** v1 is in the repo. Unit and integration tests cover capture, identity rules, offline stubs, spend limits and backup. Install a Release build on the iPhone before Nov 1.

## Run

```bash
npm test
npm start
```

On the iPhone, with Developer Mode on and your Apple ID in Xcode:

```bash
npx expo run:ios --device --configuration Release
```

The free signing profile lasts 7 days. Reinstall over the same bundle id `xyz.abhinil.glance` so the database stays. Keys go in Settings. The wallet key stays in the Keychain and is not in the encrypted export.

## Docs

| Folder | File | What's in it |
|---|---|---|
| | [00-decisions-log.md](docs/00-decisions-log.md) | Every decision from the planning chat, and why |
| 01-research | [competitors.md](docs/01-research/competitors.md) | Existing apps and repos, and what we reuse |
| | [event-apps.md](docs/01-research/event-apps.md) | IBW, Devcon, ETHGlobal: what's accessible |
| | [provider-smoke-tests.md](docs/01-research/provider-smoke-tests.md) | Which data sources respond, tested Oct 24 |
| 02-product | [PRD.md](docs/02-product/PRD.md) | Goals, scope, requirements, success measures |
| | [user-flows.md](docs/02-product/user-flows.md) | One-on-one, rush, offline, follow-up flows |
| | [states-and-edge-cases.md](docs/02-product/states-and-edge-cases.md) | Every screen state, popup rules, edge cases |
| 03-design | [brand-identity.md](docs/03-design/brand-identity.md) | Name, concept, colour, type, voice, icon, motion |
| | [ui-spec.md](docs/03-design/ui-spec.md) | Layout, button sizes and placement per screen |
| | [design-tokens.json](docs/03-design/design-tokens.json) | 3-tier tokens (reference, semantic, component) |
| | [brand-board.html](docs/03-design/brand-board.html) | Visual brand board, opens in a browser |
| | [wireframes-and-prd.html](docs/03-design/wireframes-and-prd.html) | 16 wireframes plus the earlier PRD page |
| 04-engineering | [architecture.md](docs/04-engineering/architecture.md) | Stack, modules, folder layout |
| | [services.md](docs/04-engineering/services.md) | Internal services and their interfaces |
| | [providers-and-fallbacks.md](docs/04-engineering/providers-and-fallbacks.md) | Each API, its backups, costs, health checks |
| | [offline.md](docs/04-engineering/offline.md) | Detection, offline capture, verify on reconnect |
| | [wallet-x402.md](docs/04-engineering/wallet-x402.md) | Wallet, balance, fees, spend cap, errors |
| | [data-model.sql](docs/04-engineering/data-model.sql) | SQLite schema |
| | [error-catalog.md](docs/04-engineering/error-catalog.md) | Every error code, the message shown, and recovery |
| 05-quality | [test-plan.md](docs/05-quality/test-plan.md) | Unit, integration and E2E test cases, plus the field test |
| 06-delivery | [build-plan.md](docs/06-delivery/build-plan.md) | Day-by-day plan to Oct 31 |
| | [install-on-iphone.md](docs/06-delivery/install-on-iphone.md) | Free-account install and the 7-day re-sign |
| | [risks.md](docs/06-delivery/risks.md) | Risks, mitigations, open questions |

Live blueprint (wireframes): https://claude.ai/artifact/VjBLfeZ4X6iWg8hHw7Mtp7
