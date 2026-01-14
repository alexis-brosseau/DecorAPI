# Canonical Game State (Phase 1)

This is the authoritative JSON shape stored in `catan_game_state.state`. It separates public board state from per-player private information, uses event sequencing, and references placements with canonical `edgeId`/`vertexId`.

## Top-level

```json
{
  "id": "game-uuid",
  "version": 1,
  "seed": 123456,
  "phase": "setup",            // setup | turn | end
  "subphase": "placeSettlement", // optional fine-grained step
  "seq": 0,                      // last appended event sequence
  "board": { /* see below */ },
  "turn": { /* see below */ },
  "players": [ /* see below */ ],
  "offers": [ /* optional trading offers */ ]
}
```

## Board

```json
{
  "grid": {
    "width": 5,
    "height": 5,
    "coordSystem": "axial",
    "orientation": "pointy"
  },
  "hexes": [
    { "id": "h:0,0", "q": 0, "r": 0, "type": "wood", "token": 8 },
    { "id": "h:1,0", "q": 1, "r": 0, "type": "brick", "token": 4 }
    // ...
  ],
  "robber": { "hexId": "h:1,1" },
  "ports": [
    { "id": "port-1", "kind": "3:1", "at": { "type": "edge", "id": "e:0,0-1,0" } }
  ],
  "placements": {
    "roads": [ { "edgeId": "e:0,0-1,0", "playerId": "p1" } ],
    "settlements": [ { "vertexId": "v:0,0|0,1|1,0", "playerId": "p2" } ],
    "cities": [ { "vertexId": "v:1,0|1,1|2,0", "playerId": "p2" } ]
  },
  "achievements": {
    "longestRoad": { "playerId": null, "length": 0 },
    "largestArmy": { "playerId": null, "size": 0 }
  }
}
```

Notes:
- `hexId`, `edgeId`, `vertexId` follow the canonical rules in the map doc.
- The server computes adjacency and validates distance rules via axial neighbors.

## Turn

```json
{
  "activePlayerId": "p1",
  "dice": [null, null],           // or [d1, d2] after roll
  "rolled": false,
  "mustDiscard": { "pX": 2 },   // only present when 7 is rolled
  "canRob": false,
  "buildsThisTurn": { "devCardPlayed": false }
}
```

## Players

```json
[
  {
    "id": "p1",
    "seat": 1,
    "color": "red",
    "public": {
      "vp": 2,
      "built": { "roads": 2, "settlements": 2, "cities": 0 },
      "ports": ["3:1"],
      "knightsPlayed": 0
    },
    "private": {
      "resources": { "wood": 2, "brick": 1, "sheep": 0, "wheat": 3, "ore": 0 },
      "devCards": { "knight": 1, "monopoly": 0, "roadBuilding": 0, "yearOfPlenty": 0, "victoryPoint": 0 }
    }
  },
  {
    "id": "p2",
    "seat": 2,
    "color": "blue",
    "public": { "vp": 3, "built": { "roads": 1, "settlements": 2, "cities": 0 }, "ports": [], "knightsPlayed": 1 },
    "private": { "resources": { "wood": 0, "brick": 2, "sheep": 1, "wheat": 1, "ore": 0 }, "devCards": { "knight": 0, "monopoly": 0, "roadBuilding": 0, "yearOfPlenty": 0, "victoryPoint": 0 } }
  }
]
```

## Trading offers (MVP optional)

```json
[
  {
    "id": "offer-uuid",
    "fromPlayerId": "p1",
    "toPlayerId": null,  // null for open offers
    "give": { "brick": 1 },
    "want": { "wood": 1 },
    "status": "open"     // open | accepted | declined | cancelled
  }
]
```

## Event-sourcing pointers

- Keep state lean; append detailed events to the event log.
- Use `version` for optimistic write validation and `seq` for replay/sync.
- Do not include private hands in broadcasts; send per-socket `private` diffs when needed.

## Dice → resource distribution

- On roll `n`, all land `hexes` with `token == n` produce to adjacent `vertexId` placements:
  - Settlement: +1 of that resource to the owning player.
  - City: +2 of that resource.
- The engine derives vertex adjacency from the axial neighbors around each hex and the canonical vertex triplet.

## Achievements

- `longestRoad.length` is computed via a graph search over `roads` for the owning player.
- `largestArmy.size` equals total `knightsPlayed` (from public player fields).

## Victory condition

- When any `players[].public.vp >= 10`, emit `victory:reached` and transition `phase = "end"`.
