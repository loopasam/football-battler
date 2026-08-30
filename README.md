# Football Battler

A wireframe Phaser prototype for validating the Football Battler core loop.

## Playtest

<https://loopasam.github.io/football-battler/>

## Current rules

- Five rounds, with one Home attack and one Away attack per round.
- Five static cards per team show their Attack and Defense values.
- Four guaranteed passes fill the shared Build-Up track.
- The player holding the ball when Build-Up is full takes the shot.
- Shot damage reduces the opposing team's persistent Defense.
- Reducing Defense to zero scores one point and resets that Defense.
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
