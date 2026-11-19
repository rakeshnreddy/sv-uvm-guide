# Reference scripts from lesson 1

These are the scripts that drew and checked the figures of lesson 1 (`F1A_The_Cost_of_Bugs`) on 2026-11-15 and
2026-11-16. They are kept as worked examples for the figure redesign of later lessons. Paths were replaced by
`<repo>`, `<scratch>` and `<local>`, so they do not run as they are.

- `gen.cjs`, `gen3.cjs`, `gen4.cjs`: generators for the plates, trays, tape-out line, isometric stacks and the last
  four figures; `apply4.sh` writes a candidate, checks it and moves it into place.
- `texts4.cjs`, `texts5.cjs`: the word proof (every text string unchanged against the released commit).
- `contrast4.cjs`: text and mark contrast measured from rendered pixels.
- `measure4.cjs`: rendered text sizes.
- `shoot4.cjs`: cropped screenshots in both themes.
