# Football Battler

A wireframe Phaser prototype for validating the Football Battler core loop.

## Playtest

<https://loopasam.github.io/football-battler/>

## Current rules

- Five rounds, with one Home attack and one Away attack per round.
- Eleven player nodes per team form goalkeeper, defense, midfield, and attack graph layers.
- Home uses a static 4–3–3 formation; Away uses a contrasting static 3–5–2.
- Placement generates lateral edges within layers and passing edges between adjacent layers.
- Nodes show only abbreviated Attack (`A`) and Defense (`D`) values.
- Four guaranteed passes follow a valid graph route and fill the shared Build-Up track.
- The player holding the ball when Build-Up is full takes the shot.
- Shot damage reduces the opposing team's persistent Defense.
- Reducing Defense to zero scores one point. Exhausted Defense stays at zero, so every later shot scores again.
- The team with the most points after round five wins.

## Development

```bash
npm install
npm run dev
```

Verification:

```bash
npm test
npm run build
```

Pushes to `main` are tested, built, and deployed to GitHub Pages through GitHub Actions.
