# UI design

Before UI changes read [system](system.md), relevant [references](boards/README.md), and [integration](integrations.md) when changing Aurora; then inspect the linked runtime tokens/components. Use semantic tokens and the existing composer/rail/navigation primitives. Keep changed design facts here, proposals in [ideas](../planning/ideas.md).

User preference: bold/simple layout with soft surfaces, quantum tunneling identity, no near-black high contrast. User owns manual and visual verification unless explicitly authorizing it. No board was generated during initialization; [optional prompt](initialize-board.md) remains available for later.

Singularity's UI has two sections: a chronological searchable stream for raw quanta, and user-named structured spaces containing searchable entries. The Windows and Android panels use the Dusk shell through the existing Aurora contract. Raw quanta appear as independent shared items, not as transfers to a linked device. Cloudflare setup is configured; visual and authenticated device verification remain pending.

Nico asked for those shells to follow the Dusk study. The page is [dusk.html](dusk.html). The implementation brief is [dusk-handoff.md](dusk-handoff.md). The study is the layout spec. The shell migration is implemented locally; visual acceptance remains with Nico. Axis, pairing, and Singularity sync stay as they are.
