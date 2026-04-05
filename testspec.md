# AI Hype Machine — Testing Specification

Pre-publish QA plan. Covers every layer: engine logic, API, WebSocket, MCP, persistence, client, and end-to-end flows.

---

## 1. Existing Coverage & Gaps

**Covered** (32 unit tests in `engine.test.ts`):
- `createInitialState`, `producerCost`, `computeRates`, `tick`, `click`
- `buyHardware`, `buyModel`, `buyInvestor`, `buyUpgrade`, `prestige`
- `getAvailableActions`, `computeScore`

**Not covered**:
- API routes (`routes.ts`) — no integration tests
- WebSocket handler (`handler.ts`) — no tests
- Session management (`session.ts`) — no tests
- Database layer (`db/index.ts`) — no tests
- MCP server (`mcp/index.ts`) — no tests
- Client hooks/components — no tests
- End-to-end flows — no tests
- Edge cases in engine (overflow, NaN, negative values, compute exhaustion)

---

## 2. Test Layers

### Layer 1: Engine Unit Tests (expand existing)

Framework: **Jest** (already configured)
File: `server/src/game/engine.test.ts`

#### 2.1.1 — Numeric Edge Cases
| # | Test | Expected |
|---|------|----------|
| E1 | `tick()` with dt=0 | No state change |
| E2 | `tick()` with dt negative | No state change or clamped to 0 |
| E3 | `tick()` with very large dt (1 hour) | Tokens increase, no NaN/Infinity |
| E4 | `producerCost()` with owned=1000 | Returns finite number, no overflow |
| E5 | `click()` with n=0 | No tokens added |
| E6 | `click()` with n=-5 | Clamped, no tokens removed |
| E7 | `click()` with n=9999 (above cap) | Clamped to 1000 |
| E8 | State with tokens = Number.MAX_SAFE_INTEGER, buy something | Graceful handling |
| E9 | State with NaN tokens, call tick | No crash, recoverable |

#### 2.1.2 — Compute Utilization
| # | Test | Expected |
|---|------|----------|
| U1 | 10 models, 0 hardware, 0 compute | tokensPerSecond = 0 |
| U2 | Models consume exactly available compute | 100% utilization, full token rate |
| U3 | Models consume 2x available compute | ~50% token rate (proportional throttle) |
| U4 | Add hardware mid-session → tick | Compute increases, tokens scale up |

#### 2.1.3 — Upgrade Stacking
| # | Test | Expected |
|---|------|----------|
| S1 | Two hardware multiplier upgrades (Quantization ×2 + Flash Attention ×3) | Combined ×6 compute/s |
| S2 | All 3 click upgrades (×2, ×5, ×10) | clickPower = 100 |
| S3 | Hype milestone multiplier upgrade + milestone trigger | Hype gain is multiplied |
| S4 | Reputation bonus stacks with upgrades | Tokens = base × upgrades × (1 + rep × 0.5) |

#### 2.1.4 — Milestone Progression
| # | Test | Expected |
|---|------|----------|
| M1 | Cross multiple milestones in single tick (e.g., 0 → 100k) | All intermediate milestones fire |
| M2 | Prestige resets milestones, re-earn them | Milestones fire again after prestige |
| M3 | All 8 milestones crossed | Hype = sum of all milestone grants |

#### 2.1.5 — Prestige Edge Cases
| # | Test | Expected |
|---|------|----------|
| P1 | Prestige at exactly 1,000,000 totalTokensEarned | Allowed |
| P2 | Prestige retains 10% hype | hype = floor(oldHype × 0.1) or similar |
| P3 | Reputation formula: log10(totalTokensEarned) | Verify for 1M, 100M, 10B |
| P4 | Double prestige: reputation accumulates | rep after 2nd > rep after 1st |
| P5 | Prestige resets all producer counts to 0 | All hardware/models/investors = 0 |
| P6 | Prestige resets upgrades array | upgrades = [] |
| P7 | Prestige preserves playerId, playerName | Identity intact |

#### 2.1.6 — Unlock Chains (full progression)
| # | Test | Expected |
|---|------|----------|
| L1 | All 7 hardware unlock conditions verified individually | Each requires 3 of prior tier |
| L2 | All 7 model unlock conditions (hardware + prestige gates) | AGI requires Data Center + 10 prestiges |
| L3 | All 6 investor unlock conditions (hype thresholds) | Saudi Fund requires hype ≥ 50 |
| L4 | Buying hardware tier N when owning exactly 2 of tier N-1 | Rejected |
| L5 | Buying hardware tier N when owning exactly 3 of tier N-1 | Accepted |

#### 2.1.7 — Score Computation
| # | Test | Expected |
|---|------|----------|
| SC1 | Score = totalTokensEarned + (prestigeCount × 1M) + (reputation × 500k) | Formula verified |
| SC2 | Two players with same tokens, different prestige | Higher prestige → higher score |

---

### Layer 2: API Integration Tests

Framework: **Jest + supertest**
File: `server/src/api/routes.test.ts`
Setup: spin up Express app in-memory, mock Supabase with in-memory store.

#### 2.2.1 — Registration (`POST /api/players`)
| # | Test | Expected |
|---|------|----------|
| R1 | Valid name + 4-digit PIN | 200, returns playerId + state |
| R2 | Valid name + 8-digit PIN | 200, success |
| R3 | Empty name | 400 |
| R4 | Name > 20 chars | 400 |
| R5 | PIN with letters | 400 |
| R6 | PIN < 4 digits | 400 |
| R7 | PIN > 8 digits | 400 |
| R8 | Duplicate name | 200, nameTaken=true, new playerId |
| R9 | Name with leading/trailing spaces | Trimmed, accepted |

#### 2.2.2 — Authentication (`POST /api/auth`)
| # | Test | Expected |
|---|------|----------|
| A1 | Correct name + PIN | 200, returns playerId |
| A2 | Wrong PIN | 401 |
| A3 | Non-existent name | 401 |
| A4 | Case-insensitive name match | 200 |
| A5 | 5 failed attempts | 429 with lockout message |
| A6 | 5 failures + wait 10 min | 200 on next correct attempt |
| A7 | Successful auth after 4 failures | Resets counter |
| A8 | Two players same name, different PINs | Correct PIN matches correct player |

#### 2.2.3 — Click (`POST /api/click/:playerId`)
| # | Test | Expected |
|---|------|----------|
| C1 | Valid click, n=1 | Tokens +1, totalClicks +1 |
| C2 | Bulk click n=100 | Tokens +100 |
| C3 | n=1001 (over cap) | Clamped to 1000 |
| C4 | n=-1 | Clamped or rejected |
| C5 | Invalid playerId | 404 |
| C6 | With X-Mcp-Source header | State returned + mcp_action broadcast (verify via WS) |

#### 2.2.4 — Buy (`POST /api/buy/:playerId`)
| # | Test | Expected |
|---|------|----------|
| B1 | Buy mac_mini with enough tokens | 200, hardware.mac_mini + 1 |
| B2 | Buy mac_mini with 0 tokens | 400, error message |
| B3 | Buy locked hardware | 400, error message |
| B4 | Buy upgrade (one-time) | 200, upgrades array contains id |
| B5 | Buy same upgrade twice | 400 |
| B6 | Buy investor with insufficient hype | 400 |
| B7 | Invalid producerType | 400 |
| B8 | Invalid id | 400 |
| B9 | quantity=100 bulk buy | Correct cost deducted, count +=100 |

#### 2.2.5 — Prestige (`POST /api/prestige/:playerId`)
| # | Test | Expected |
|---|------|----------|
| PR1 | Prestige when eligible (≥1M tokens earned) | 200, reset state, prestige +1 |
| PR2 | Prestige when ineligible | 400 |
| PR3 | Leaderboard updates after prestige | Score reflects new prestige count |

#### 2.2.6 — Leaderboard (`GET /api/leaderboard`)
| # | Test | Expected |
|---|------|----------|
| LB1 | Empty DB | Returns [] |
| LB2 | Multiple players | Sorted desc by score, max 20 |
| LB3 | 25 players | Only top 20 returned |

#### 2.2.7 — Actions (`GET /api/actions/:playerId`)
| # | Test | Expected |
|---|------|----------|
| AC1 | Fresh player with 100 tokens | mac_mini affordable, others listed |
| AC2 | Affordable sorted before unaffordable | Order correct |

#### 2.2.8 — Admin Reset (`POST /api/admin/reset`)
| # | Test | Expected |
|---|------|----------|
| AD1 | Without X-Admin-Secret header | 401/403 |
| AD2 | With wrong secret | 401/403 |
| AD3 | With correct secret | 200, DB wiped |

---

### Layer 3: Session Management Tests

Framework: **Jest**
File: `server/src/game/session.test.ts`
Mock: Supabase adapter (in-memory)

| # | Test | Expected |
|---|------|----------|
| SS1 | `loadOrCreateSession` — new player | Creates fresh state, persists to DB |
| SS2 | `loadOrCreateSession` — existing player | Loads from DB, returns cached |
| SS3 | `loadOrCreateSession` — already in memory | Returns memory copy, no DB call |
| SS4 | Dirty tracking: `doClick` marks session dirty | Dirty flag set |
| SS5 | Save flush: dirty sessions written to DB within 10s | DB state matches memory |
| SS6 | Debounce: rapid actions don't spam DB | Max 1 save per 2s per player |
| SS7 | Concurrent sessions: two players tick independently | Tokens differ per state |
| SS8 | Session after prestige: immediate save triggered | DB has reset state |

---

### Layer 4: WebSocket Tests

Framework: **Jest + ws client**
File: `server/src/ws/handler.test.ts`
Setup: start HTTP+WS server on random port, connect ws client.

| # | Test | Expected |
|---|------|----------|
| W1 | Connect with valid playerId | Receives `state` message within 200ms |
| W2 | Connect without playerId | Connection rejected or no state sent |
| W3 | State messages arrive continuously (~100ms interval) | ≥5 state messages in 1 second |
| W4 | After HTTP click → state message reflects new tokens | State.tokens increased |
| W5 | Milestone crossed → `milestone` message sent | Contains id, message, hypeGain |
| W6 | MCP action → `mcp_action` message broadcast | Contains action description |
| W7 | Client disconnect + reconnect | State resumes from where it left off |
| W8 | Multiple WS clients same playerId | Both receive state updates |

---

### Layer 5: MCP Server Tests

Framework: **Jest**
File: `server/src/mcp/index.test.ts`
Setup: spawn MCP server as child process (stdio), exchange JSON-RPC messages.

#### 2.5.1 — Authentication
| # | Test | Expected |
|---|------|----------|
| MCP1 | Valid MCP_PLAYER_NAME + MCP_PLAYER_PIN env vars | Startup succeeds, tools available |
| MCP2 | Invalid PIN | Process exits with error |
| MCP3 | Non-existent player name | Process exits with error |
| MCP4 | API_URL unreachable, retries | 3 retries with backoff, then exit |

#### 2.5.2 — Tools
| # | Test | Expected |
|---|------|----------|
| MCP5 | `get_game_state` | Returns valid GameState JSON |
| MCP6 | `click` | tokens increase by clickPower |
| MCP7 | `click_n` with n=500 | tokens increase by 500 × clickPower |
| MCP8 | `click_n` with n=2000 | Clamped to 1000 |
| MCP9 | `buy_producer` hardware mac_mini | hardware.mac_mini +1 |
| MCP10 | `buy_producer` unaffordable | Error message returned |
| MCP11 | `buy_upgrade` valid | Upgrade applied |
| MCP12 | `buy_upgrade` duplicate | Error message |
| MCP13 | `prestige` eligible | State reset, prestige +1 |
| MCP14 | `prestige` ineligible | Error message |
| MCP15 | `get_available_actions` | Returns sorted ActionOption[] |
| MCP16 | `get_leaderboard` | Returns LeaderboardEntry[] |
| MCP17 | All tools set X-Mcp-Source header | Browser receives mcp_action WS message |

---

### Layer 6: Database Layer Tests

Framework: **Jest**
File: `server/src/db/index.test.ts`
Setup: dedicated Supabase test project OR mock Supabase client.

| # | Test | Expected |
|---|------|----------|
| D1 | `createPlayer(name, pinHash)` | Row inserted, returns id |
| D2 | `findPlayerByNameAndPin(name)` | Returns matching rows |
| D3 | `findPlayerByNameAndPin` case-insensitive | "alice" matches "Alice" |
| D4 | `saveState(playerId, state)` | State JSONB updated |
| D5 | `loadState(playerId)` | Returns stored state |
| D6 | `loadState` non-existent player | Returns null |
| D7 | `getLeaderboard()` | Top 20 sorted by score DESC |
| D8 | `saveState` preserves pin_hash | pin_hash unchanged after state save |
| D9 | Round-trip: save → load → compare | State identical |

---

### Layer 7: Client Tests

Framework: **Vitest + React Testing Library**
Files: `client/src/components/*.test.tsx`, `client/src/hooks/*.test.ts`

#### 2.7.1 — Component Rendering
| # | Test | Expected |
|---|------|----------|
| CL1 | `Register` — renders name + PIN inputs | Inputs visible |
| CL2 | `Register` — submit with valid data | Calls API, transitions to game |
| CL3 | `Register` — submit with empty name | Shows error |
| CL4 | `ClickButton` — renders click power | Shows current clickPower |
| CL5 | `ClickButton` — click fires API call | POST /api/click called |
| CL6 | `ProducerPanel` — shows locked vs unlocked | Locked items visually distinct |
| CL7 | `ProducerPanel` — buy button disabled when unaffordable | Button disabled |
| CL8 | `UpgradePanel` — hides purchased upgrades | Purchased not shown |
| CL9 | `Leaderboard` — renders top players | Table with rank, name, score |
| CL10 | `PrestigeModal` — shows when eligible | Modal visible |
| CL11 | `PrestigeModal` — hidden when ineligible | Not rendered |
| CL12 | `ResourceBar` — displays formatted numbers | "1.2M" not "1200000" |
| CL13 | `MilestoneLog` — shows milestone history | List of milestone messages |

#### 2.7.2 — Number Formatting (`lib/format.ts`)
| # | Test | Expected |
|---|------|----------|
| F1 | format(0) | "0" |
| F2 | format(999) | "999" |
| F3 | format(1000) | "1.0K" |
| F4 | format(1_500_000) | "1.5M" |
| F5 | format(1_000_000_000) | "1.0B" |
| F6 | format(negative) | Graceful (no crash) |
| F7 | format(NaN) | Graceful (no crash) |
| F8 | format(Infinity) | Graceful (no crash) |

#### 2.7.3 — useGame Hook
| # | Test | Expected |
|---|------|----------|
| H1 | Initializes with null state | Loading shown |
| H2 | WebSocket connects with stored playerId | State populated |
| H3 | doClick dispatches POST and updates state | State.tokens increases |
| H4 | Disconnect → reconnect | State resumes |

---

### Layer 8: End-to-End Tests

Framework: **Playwright**
File: `e2e/game.spec.ts`
Setup: full server + client running, test Supabase instance, clean DB per test suite.

#### 2.8.1 — New Player Journey
| # | Test | Steps | Expected |
|---|------|-------|----------|
| E2E1 | Registration | Open app → enter name + PIN → submit | Game screen shown, resources at 0 |
| E2E2 | First clicks | Click button 10 times | Tokens ≥ 10 |
| E2E3 | Buy first hardware | Click until 15 tokens → buy Mac Mini | Hardware count = 1, compute/s > 0 |
| E2E4 | Passive income starts | Wait 3 seconds after buying model | Tokens increase without clicking |
| E2E5 | Buy first model | Accumulate tokens → buy GPT-2 | tokens/s > 0 |
| E2E6 | Milestone fires | Earn 1,000 tokens | Hype increases, milestone log entry |

#### 2.8.2 — Progression Flow
| # | Test | Steps | Expected |
|---|------|-------|----------|
| E2E7 | Unlock tier 2 hardware | Own 3 Mac Minis → buy Gaming PC | Gaming PC available and purchased |
| E2E8 | Unlock investor | Reach hype ≥ 1 → buy Mom's Card | Investor purchased, funding/s > 0 |
| E2E9 | Buy upgrade | Enough tokens → buy Better Prompts | Click power doubles |
| E2E10 | Funding upgrade | Enough funding → buy funding upgrade | Model output multiplied |

#### 2.8.3 — Prestige Flow
| # | Test | Steps | Expected |
|---|------|-------|----------|
| E2E11 | Prestige button appears | totalTokensEarned ≥ 1M | Prestige button visible |
| E2E12 | Prestige resets correctly | Click prestige → confirm | Resources 0, prestige count 1, reputation > 0 |
| E2E13 | Post-prestige progression faster | Buy same producers after prestige | tokens/s higher than pre-prestige |

#### 2.8.4 — Identity & Recovery
| # | Test | Steps | Expected |
|---|------|-------|----------|
| E2E14 | Login recovery | Register → clear localStorage → login with name+PIN | Same game state restored |
| E2E15 | Wrong PIN rejected | Try login with wrong PIN | Error shown, game not loaded |
| E2E16 | Rate limiting | 5 wrong PINs | Locked out, shows wait message |

#### 2.8.5 — Leaderboard
| # | Test | Steps | Expected |
|---|------|-------|----------|
| E2E17 | Player appears on leaderboard | Register + earn tokens | Name visible in leaderboard tab |
| E2E18 | Ranking order | Two players, different scores | Higher score ranked first |

#### 2.8.6 — Persistence
| # | Test | Steps | Expected |
|---|------|-------|----------|
| E2E19 | State survives server restart | Play → stop server → start server → reconnect | Tokens/producers preserved |
| E2E20 | Concurrent players | Two browser tabs, different players | Independent state, both updating |

#### 2.8.7 — MCP Co-Play (E2E)
| # | Test | Steps | Expected |
|---|------|-------|----------|
| E2E21 | MCP click reflects in browser | Send MCP `click` → check browser | Tokens increase + MCP flash shown |
| E2E22 | MCP buy producer | Send MCP `buy_producer` → check browser | Producer count increases |
| E2E23 | MCP + manual play concurrent | MCP clicking while browser open | Both actions reflected, no conflicts |

---

## 3. Non-Functional Tests

### 3.1 — Performance
| # | Test | Expected |
|---|------|----------|
| PF1 | Tick loop with 50 concurrent sessions | All tick within 100ms wall clock |
| PF2 | 1000 rapid clicks via API | All processed, no 5xx errors |
| PF3 | WebSocket with 20 connections | All receive state updates |
| PF4 | Leaderboard query with 1000 players | Response < 500ms |

### 3.2 — Resilience
| # | Test | Expected |
|---|------|----------|
| RE1 | Supabase unavailable during save | Game continues in-memory, retries save |
| RE2 | Supabase unavailable during load | Error returned, no crash |
| RE3 | WebSocket client sends malformed message | Ignored, no crash |
| RE4 | API receives malformed JSON body | 400, no crash |
| RE5 | Extremely long player name (1000 chars) | Rejected at validation |

### 3.3 — Security
| # | Test | Expected |
|---|------|----------|
| SE1 | SQL injection in player name | Parameterized query, no injection |
| SE2 | XSS in player name (e.g., `<script>alert(1)</script>`) | Escaped in leaderboard rendering |
| SE3 | Admin reset without secret | 401/403 |
| SE4 | PIN not in any API response body | Check all endpoints |
| SE5 | PIN hash not in state WebSocket messages | Verify state shape |
| SE6 | CORS: cross-origin request from unknown origin | Blocked or scoped |

---

## 4. Test Infrastructure

### 4.1 — Dependencies to Add
```
# Server
npm i -D supertest @types/supertest ws @types/ws

# Client  
npm i -D @testing-library/react @testing-library/jest-dom @testing-library/user-event vitest jsdom

# E2E
npm i -D @playwright/test
```

### 4.2 — Test Database Strategy
- **Unit/integration tests**: mock Supabase client with in-memory Map
- **E2E tests**: dedicated Supabase test project, wiped before each suite via admin reset endpoint
- **CI**: GitHub Actions, test DB credentials in secrets

### 4.3 — Test Scripts (package.json)
```json
{
  "test:engine": "jest --testPathPattern=engine",
  "test:api": "jest --testPathPattern=routes",
  "test:session": "jest --testPathPattern=session",
  "test:ws": "jest --testPathPattern=handler",
  "test:mcp": "jest --testPathPattern=mcp",
  "test:db": "jest --testPathPattern=db",
  "test:client": "vitest run",
  "test:e2e": "playwright test",
  "test:all": "npm run test:engine && npm run test:api && npm run test:session && npm run test:ws && npm run test:mcp && npm run test:db && npm run test:client && npm run test:e2e"
}
```

### 4.4 — File Structure
```
server/src/
├── game/
│   ├── engine.test.ts          # Layer 1 (expand)
│   └── session.test.ts         # Layer 3 (new)
├── api/
│   └── routes.test.ts          # Layer 2 (new)
├── ws/
│   └── handler.test.ts         # Layer 4 (new)
├── mcp/
│   └── index.test.ts           # Layer 5 (new)
└── db/
    └── index.test.ts           # Layer 6 (new)

client/src/
├── components/
│   ├── ClickButton.test.tsx    # Layer 7
│   ├── ProducerPanel.test.tsx
│   ├── Register.test.tsx
│   └── ...
├── hooks/
│   └── useGame.test.ts
└── lib/
    └── format.test.ts

e2e/
├── game.spec.ts                # Layer 8
├── identity.spec.ts
└── playwright.config.ts
```

---

## 5. Priority Order

Implement tests in this order (highest ROI first):

1. **Layer 1** — Engine edge cases (fast, pure functions, catches math bugs)
2. **Layer 2** — API integration (validates HTTP contract, auth, input validation)
3. **Layer 7.2** — Number formatting (trivial to write, prevents display bugs)
4. **Layer 3** — Session management (persistence correctness = data loss prevention)
5. **Layer 4** — WebSocket (real-time state delivery = core UX)
6. **Layer 6** — Database (round-trip integrity, pin_hash safety)
7. **Layer 5** — MCP (AI co-play is a key differentiator)
8. **Layer 7** — Client components (rendering correctness)
9. **Layer 8** — E2E (full flow validation, slowest to run)
10. **Section 3** — Non-functional (performance, resilience, security)

---

## 6. Coverage Targets

| Layer | Target | Rationale |
|-------|--------|-----------|
| Engine | 100% line + branch | Pure logic, no excuses |
| API routes | 95%+ | Every endpoint, every validation path |
| Session | 90%+ | Core persistence orchestration |
| WebSocket | 85%+ | Message types, reconnect |
| MCP | 90%+ | All 8 tools + auth flows |
| Database | 85%+ | CRUD + edge cases |
| Client components | 80%+ | Render + interaction |
| E2E | N/A (scenario-based) | All critical user journeys covered |

---

## 7. Test Count Summary

| Layer | Tests |
|-------|-------|
| Engine (expanded) | ~45 |
| API integration | ~30 |
| Session management | ~8 |
| WebSocket | ~8 |
| MCP | ~17 |
| Database | ~9 |
| Client | ~21 |
| E2E | ~23 |
| Non-functional | ~15 |
| **Total** | **~176** |
