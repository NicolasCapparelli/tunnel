# Notices

`@aurora/core` is part of Aurora and is private (not published to npm).

`src/mcu/` is a TypeScript port of parts of the Dart package
[material_color_utilities](https://pub.dev/packages/material_color_utilities)
0.11.1 (HCT, CAM16, tonal palettes, contrast, dynamic colors, dislike analysis,
temperature and the nine schemes Aurora pins). Copyright 2021-2023 Google LLC,
licensed under the Apache License, Version 2.0; the full license text is in
`LICENSE-material-color-utilities`. The port keeps the 0.11.1 algorithm exactly
so generation matches the Dart core and `spec/fixtures` byte for byte at 8 bits.
Changes from the original: translated to TypeScript, Dart rounding and modulo
semantics reproduced explicitly, per-scheme caches removed (results are
deterministic), and unused APIs (quantizers, score, blend, core palettes)
omitted.
