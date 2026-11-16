# C escort regression source handoff

Source: apps/game/src/evacuation.ts; test: tests/c-evacuation-world.test.ts.

Reproduced before fix: hub cover x1/z16 stayed in load after279.133 simulated seconds; leader1.192387/16.638720, medics.790738/16.155837 and1.747585/16.226625. Dynamic routing and rigid side offsets formed a circular wait against the real median.

Fix: patient uses static/body-safe route scaffold with every movement step still checked against live crew/player/vehicle collision; medics choose separate reachable positions alongside or behind that route, instead of requesting a rigid three-abreast formation inside a road divider. Helpers remain outside during the patient's final interior loading segment, then physically return to their seats through the existing flow.

Observed checks: all-five-plus-hub cover/escape controller test passed10 authored starts in24.006s. Extended with the actual rendered near-cover defeat pose1.194230/16.044055 and per-frame crew movement continuity. Correct final three-file regression output is escort-evacuation-regression.txt. Targeted TypeScript check and ESLint passed after formatting. These controller checks are not rendered browser acceptance or FPS measurements.

Final saved regression:14/14 pass,0 fail;84.297s total on this host. The collision-aware parameter test includes11 starts (all five areas, both hub covers, all three hub escape anchors, actual near-cover gameplay pose). Vehicle alternatives/obstruction tests5/5 also passed. Typecheck and file lint completed with exit0. No browser performance or visual acceptance is inferred.
