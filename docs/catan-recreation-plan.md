# Catan Recreation Plan (WebGame server)

This document is a concrete plan for recreating a playable Settlers of Catan loop on top of the existing WebGame server (Express + Postgres + WebSocket).

## Current server capabilities (already in repo)

### HTTP
- Lobby create/join/list exists in `controllers/game.ts` calling `services/game.ts` functions.

### WebSocket
- WebSocket entrypoint: `realtime/catanWs.ts` (`/ws/catan`)
- On connect: validates `accessToken`, loads a snapshot via `connectWebSocket`, then sends `{ type: "snapshot" }`.
- Handles:
  - `ping` → `pong`
  - `player:setReady` → updates readiness + broadcasts `players:update`
  - `game:advancePhase` → runs `advanceGamePhase` + broadcasts `phase:update` and closes room on `end`

### Persistence primitives (DAL)
- State snapshot table: `dal/tables/catanGameState.ts`
- Event log table: `dal/tables/catanGameEvent.ts`
- Session/players/trade offer tables exist under `dal/tables/`

---

## High-level approach

- The server is authoritative. Clients only send intent (actions); server validates and applies.
- Use a state snapshot (JSON) for fast join/reconnect and an event log for replay/debug/incremental updates.
- Never broadcast private player information (hands, dev cards). Publish public state to the room, and private diffs only to the relevant socket.

---

## Phase 1 — Define the authoritative game state model

### 1) Define ONE canonical state JSON shape
Stored in `catan_game_state.state`.

Suggested top-level shape:
- `meta`: `{ version, createdAt, seed }`
- `board`: `{ hexes, numbers, ports, robberHexId }`
- `bank`: resource counts, dev deck remaining
- `playersPublic`: per-player public info (color/seat, buildings count, public VP, longestRoad, largestArmy)
- `playersPrivate`: per-player private info (resources/dev cards). IMPORTANT: do NOT broadcast this structure.
- `turn`: `{ activePlayerId, phase, subphase, dice, hasRolled, devCardPlayedThisTurn }`
- `pending`: workflow prompts (discard list, robber move needed, steal selection, etc.)
- `trade`: open offers and/or references to DB offers

### 2) Public vs private views
- Public:
  - board layout, roads/settlements/cities locations
  - active player, phase, dice result
  - achievements (largest army / longest road)
  - public VP
- Private (per player):
  - resource cards and dev cards
  - hidden choices (e.g., monopoly target resource before play)

### 3) Versioning strategy
- Use `catan_game_state.version` for optimistic sequencing.
- Use event `seq` for replay/sync and reconnect.

---

## Phase 2 — Event-sourcing contract

### 1) Define event types (append-only)
Examples:
- `game:created`
- `game:started`
- `setup:placedSettlement`
- `setup:placedRoad`
- `turn:rolled`
- `turn:ended`
- `build:road`
- `build:settlement`
- `build:city`
- `trade:offerCreated`
- `trade:accepted`
- `trade:declined`
- `trade:cancelled`
- `dev:played`
- `robber:moved`
- `robber:stolen`
- `victory:reached`

### 2) Snapshot + events
- On connect: send snapshot.
- During play: broadcast incremental updates (events) plus any needed state patches.
- On reconnect: client can request events since last known `seq`.

---

## Phase 3 — Expand the WebSocket protocol

### Current message types
Client → Server:
- `ping`
- `player:setReady`
- `game:advancePhase`

Server → Client:
- `error`
- `pong`
- `snapshot`
- `players:update`
- `phase:update`
- `game:ended`

### Add gameplay actions (Client → Server)
Recommended additions:
- `game:start` (host only)
- `setup:placeSettlement` `{ vertexId }`
- `setup:placeRoad` `{ edgeId }`
- `turn:rollDice`
- `turn:end`
- `build:road` `{ edgeId }`
- `build:settlement` `{ vertexId }`
- `build:city` `{ vertexId }`
- `trade:bank` `{ give: ResourceCount, receive: ResourceCount }`
- `trade:offerCreate` `{ give, want, toPlayerId?: UUID }`
- `trade:offerAccept` `{ offerId }`
- `trade:offerDecline` `{ offerId }`
- `trade:offerCancel` `{ offerId }`
- `robber:move` `{ hexId, stealFromPlayerId?: UUID }`
- `dev:play` `{ cardType, payload }`

### Add server broadcasts (Server → Client)
- `events:append` `{ event }` (public)
- `state:update` `{ state }` (public) OR a patch/diff format
- `private:update` `{ you }` (only to that socket)

NOTE: Keep `snapshot` for initial connect. Avoid resending full state every time unless MVP simplicity requires it.

---

## Phase 4 — Implement the game engine in the service layer

Create a game rules module/service patterned after `services/game.ts`.

### Responsibilities
1) Validate action legality (pure, deterministic)
- Is it the player’s turn?
- Are prerequisites met (rolled dice, correct subphase)?
- Does player have resources?
- Does placement satisfy distance rules?

2) Apply state transitions (pure)
- Input: `{ state, action, actorPlayerId }`
- Output: `{ newState, events[], privateOutputsByPlayerId }`

3) Transactional persistence wrapper
- In a DB transaction:
  - Load snapshot state
  - Validate + apply
  - Write new snapshot state (increment version)
  - Append events
  - Update derived DB fields if needed (status, winner, player summary)

4) Authorization
- Use WS-connected `playerId` as the actor identity.
- Enforce host-only actions (start game, maybe force phase advance).

---

## Phase 5 — Lobby → Start → Setup placement

### Start game
- Preconditions: >= 2 players, all ready
- Generate board deterministically using `catan_game.seed`
- Assign seats/colors
- Transition to setup placement order: 1 → N then N → 1

### Setup rules
- Place settlement then road
- Enforce distance rule for settlements
- Second settlement grants starting resources
- Emit events for each placement

---

## Phase 6 — Core turn loop

### Turn steps
1) Roll dice
- If 7:
  - Discard workflow (players with > 7 cards)
  - Robber move
  - Optional steal target selection
- Else:
  - Distribute resources based on settlements/cities and number rolled

2) Main actions (repeat until end)
- Build roads/settlements/cities
- Buy dev card
- Trade (bank/ports first; then player offers)
- Play dev card (restrictions apply)

3) End turn
- Advance active player
- Reset per-turn flags

---

## Phase 7 — Trading plan (MVP → full)

### MVP (fastest)
- Bank trades (4:1)
- Port trades (3:1 and 2:1)

### Then
- Player-to-player trades via `catan_trade_offer`:
  - Create offer
  - Accept/decline/cancel
  - Broadcast offer changes to room

---

## Phase 8 — Victory + ending

- Track VP server-side in state.
- When player reaches 10 VP:
  - Emit `victory:reached`
  - Set game status to finished
  - Notify room and close sockets (`game:ended`)

---

## Phase 9 — Client sync and security

- Never broadcast private hands/dev cards.
- Per-socket private updates for the acting player.
- Add input validation for WS messages (shape/type checks).
- Consider per-socket rate limiting to reduce spam.

---

## Recommended build order (most direct path)

1) Add WS action `game:start` and implement `startGame(...)` service
   - board generation + seat assignment + setup turn order
2) Implement setup placement actions
   - `setup:placeSettlement`
   - `setup:placeRoad`
3) Implement turn roll + resource distribution
   - `turn:rollDice`
4) Implement building actions
   - roads/settlements/cities
5) Implement bank/port trading
6) Add player-to-player offers
7) Add dev cards + robber workflows
8) Add victory + game end cleanup
