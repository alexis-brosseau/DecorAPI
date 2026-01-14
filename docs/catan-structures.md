# Map (Phase 1)

This defines the authoritative JSON shape for the Catan board map and IDs for graph elements (hexes, edges, vertices). It supports custom maps generated from a `width` and `height`.

## Coordinate system

- Use axial hex coordinates: `q` (column), `r` (row), pointy-top orientation.
- Neighbor directions (pointy-top axial):
  - `(q+1, r)`, `(q+1, r-1)`, `(q, r-1)`, `(q-1, r)`, `(q-1, r+1)`, `(q, r+1)`
- Advantages: simple math for adjacency and canonical IDs.

If you prefer to think in offset `x`/`y`, you can convert to axial on the server. All stored JSON uses `q`/`r`.

## Canonical IDs (stable across references)

- `hexId`: `h:{q},{r}`
- `edgeId`: `e:{q1},{r1}-{q2},{r2}` where `{q1,r1}` and `{q2,r2}` are the two adjacent hexes that share the edge, sorted lexicographically by `(q,r)`.
- `vertexId`: `v:{q1},{r1}|{q2},{r2}|{q3},{r3}` where the three hexes meet; store the triplet sorted lexicographically.

This normalization guarantees a unique ID regardless of which incident hex you reference when computing placements.

## Map JSON

```json
{
  "grid": {
    "width": 5,
    "height": 5,
  },
  "seed": 123456,
  "resourceBag": {
    "wood": 4,
    "brick": 3,
    "sheep": 4,
    "wheat": 4,
    "ore": 3,
    "desert": 1
  },
  "tokenBag": [2,3,3,4,4,5,5,6,6,8,8,9,9,10,10,11,11,12],
  "ports": {
    "kinds": ["3:1","3:1","3:1","3:1","wood","brick","sheep","wheat","ore"],
    "placement": [
      { "id": "p:3,3", "q": 3, "r": 3, "kind": "wood" }
    ]
  }
  "hexes": [
    { "id": "h:0,0", "q": 0, "r": 0, "type": "wood", "token": 8 },
    { "id": "h:1,0", "q": 1, "r": 0, "type": "brick", "token": 4 },
    { "id": "h:2,0", "q": 2, "r": 0, "type": "sheep", "token": 10 },
    { "id": "h:0,1", "q": 0, "r": 1, "type": "wheat", "token": 9 },
    { "id": "h:1,1", "q": 1, "r": 1, "type": "desert" },
    { "id": "h:2,1", "q": 2, "r": 1, "type": "ore", "token": 6 }
    // ... additional hexes including water where applicable
  ],
  "ports": [
    { "id": "port-1", "kind": "3:1", "at": { "type": "edge", "id": "e:0,0-1,0" } },
    { "id": "port-2", "kind": "wood", "at": { "type": "edge", "id": "e:2,0-2,1" } }
  ]
}
```

### Notes
- `generator` is metadata used by the server to create a custom map given `width` and `height`. The server will fill interior land with `resourceBag`, assign `tokenBag` to non-desert land hexes in standard ring order, mark borders as `water` if desired, and place `ports` on edges between land/water.
- `ports.at` binds a port to a single `edgeId` (or use `{ "type": "vertex", "id": "v:..." }` if you prefer corner ports).
- `token` is omitted for `desert` and `water`.

## Example layout intuition

Axial `(q,r)` for a 3x3 interior might be visualized similarly to the offset grid you started:

Row r=0:  (0,0) (1,0) (2,0)
Row r=1:    (0,1) (1,1) (2,1)
Row r=2:  (0,2) (1,2) (2,2)

The server will compute adjacency and canonical edge/vertex IDs using the axial neighbor rules.


