# Vendored Entanglement

Copied from the Entanglement repository by `tool/vendor.mjs`. **Do not edit
anything in this folder**: change Entanglement and re-vendor, so every app
stays on the same code.

- Source: Entanglement @ 4bfc042 + uncommitted changes
- Vendored: 2026-10-30T23:21:17.410Z
- Kind: npm packages (built tarballs)
- Contents: `entanglement-core-0.1.0.tgz`, `entanglement-supabase-0.1.0.tgz`, `entanglement-cloudflare-0.1.0.tgz`, `docs/`

## Using it

Install them from here so package.json points inside the app:
`npm install ./entanglement/entanglement-core-0.1.0.tgz ./entanglement/entanglement-supabase-0.1.0.tgz ./entanglement/entanglement-cloudflare-0.1.0.tgz --force`
(`--force` because a re-vendored tarball keeps its version but changes its contents).

## Updating

Commit the change in Entanglement, then from its root:

```bash
node tool/vendor.mjs --apps     # re-vendor every app; --status shows who is behind
```

Then re-resolve dependencies in the app, run its tests, and commit this folder
together with any app changes the new version needs.

Start with `docs/how-it-works.md`.
