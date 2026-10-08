# Optional full documentation migration

**Optional — requires explicit user approval before execution.** This prompt is separate from initialization. Discovering, reading, or copying it does not authorize migration, removal of old documentation, or changes to locked specifications. Never run it automatically during initialization or routine project work.

The objective, once approved, is to make `continuity/` the primary home for all ordinary project documentation, transferring its useful content and removing superseded originals. A `docs/` directory should no longer be a competing documentation home after complete migration. This task does not authorize product features, commits, deployments, credential use, or weakening repository rules.

The normal flow is: initialize Continuity, ask the user whether to fully migrate or keep both, then honor that choice. An explicit full-migration answer authorizes this operation; do not ask for the same approval again. A keep-both answer means no full migration: remove only this installed prompt and tell the user it can be obtained later from [Continuity's source repository](https://github.com/NicolasCapparelli/continuity/blob/main/template/continuity/migrate.md). If no answer has arrived, wait for the decision and keep this prompt; elapsed time is not approval.

## 1. Establish approval and a concrete scope

Read applicable repository instructions, `continuity/about.md`, and the agent contract, status, and complete map. If Continuity has not been initialized, report that prerequisite; do not replace populated files with templates.

Before execution, inventory ordinary project documentation and references read-only. Prepare an old-to-new checklist with each old path, destination, proposed merge/relocation, removals, retained exceptions, and affected inbound links/configuration. Include nested documentation, diagrams/assets, schema references, decisions, roadmaps, reviews, historical verification, and documentation in non-Markdown formats where relevant. Exclude vendor/generated/dependency content, unrelated repositories, and captured benchmark inputs.

Show how current knowledge, locked decisions, and historical evidence will be preserved. Identify external references or tooling that consume existing paths. If the user selected full migration during initialization or otherwise explicitly approved full migration, proceed within that authorization without another routine confirmation. Otherwise show the scope and ask "Would you like to fully migrate the existing documentation into Continuity, or keep both?" before changing active documentation or deleting files. State that full migration transfers ordinary docs and cleans up originals, while preserving agent files, rules, legal/public requirements, and historical meaning. Reading this prompt, approving initialization alone, or expressing interest is insufficient. Newly discovered protected material outside the approved scope requires clarification while independent approved work continues.

If approval is absent, stop after the read-only inventory/plan. Do not edit existing docs, rewrite discovery instructions, or clean up old folders. Keep the prompt for a later approved run.

## 2. Protect instruction files and required artifacts

**Never delete, relocate, empty, or replace agent-specific instruction files or rule directories as cleanup.** This includes `CLAUDE.md`, `AGENTS.md`, `AGENT.md`, `GEMINI.md`, `.github/copilot-instructions.md`, and existing tool-specific/scoped rules. Preserve every unrelated instruction, constraint, approval requirement, and workflow rule. With approval, update documentation references to their new locations and maintain the Continuity startup/upkeep pointer; do not turn a detailed instruction file into a stub.

Full migration includes faithful relocation of ordinary specifications and updating their references; explain this when presenting the choice. Move locked specs only within that approved scope, preserving obligations and rationale. Do not interpret relocation as permission to change requirements or resolve source/spec mismatches. If an additional explicit repository restriction prevents a move and the user's approval does not resolve it, retain the protected files, record the exception, and report migration as partial.

Retain licenses, copyright notices, security/reporting policies, required root README/contribution entry points, and externally required documents. These may become concise routes to authoritative Continuity content where their consumption contract permits. Preserve public/external paths through redirects or short compatibility pointers if needed. Identify these as exceptions, not competing internal documentation. Unknown ownership or deletion safety is a blocker for that file, not permission to remove it.

## 3. Preserve content and choose authoritative homes

Classify protection by actual constraints and consumers, not directory or filename alone. Being referenced as required reading by AGENTS.md does not make ordinary docs permanently immovable; approved migration can update those references while preserving every rule. Conversely, portable specification schemas, shared fixtures, generated expected data, and externally consumed onboarding playbooks may be compatibility inputs. Do not move/delete them as prose cleanup without examining consumers and approved scope. Preserve agent-facing onboarding files such as AGENT_ONBOARDING.md with their instructions intact, and distinguish their audience from contributor discovery files.

Inspect actual source/tests/configuration when reconciling current factual claims. Keep implemented behavior, required specification, proposed work, inferred intent, historical checks, and unknowns distinct. Never rewrite old verification as if it were performed against today's code or invent explanations for discrepancies.

Use core docs for concise overviews and indexes. Put substantial unique detail into meaningful optional locations, for example:

- Setup/architecture and detailed developer guides: `developer/` and relevant area guides.
- Model semantics/schema explanations: `data/model.md` with deeper `data/<area>.md` documents.
- User workflows: `user/usage.md` or additional user guides.
- Durable consequential choices: `decisions/`.
- Future work: `planning/roadmap.md` for selected sequence, `planning/ideas.md` for possibilities, indexed `planning/studies/` for explorations; retain equivalent existing owners and keep status a snapshot.
- UI language/token/component/tool references and visual boards: `design/` with assets/licenses and explicit acceptance/runtime authority; preserve editable design inputs and richer exports.
- Recent turn implementations and human test steps: `implementation-log.md`; older complete records in linked `history/implementation/`, with unresolved human checks retained in status.
- Dated reviews, historical evidence, and superseded designs: clearly labelled `history/` documents with original context and date.

Preserve these responsibilities with clear owners; substantial detail grows only when justified. Preserve assets alongside their consumers and repair relative references. Preserve unique knowledge rather than blindly compressing every old file into core overviews. Avoid dual authoritative copies. When source and specs differ, retain the requirement, describe the source-observed mismatch, and leave product behavior unchanged. Migration does not authorize adopting UI libraries or changing product design.

## 4. Transfer, verify, then remove originals

Work file by file or in coherent groups within the approved scope. Establish a recovery path for originals before removal: existing tracked history or a separate local backup for untracked material. Do not create a commit merely to obtain recovery, and do not place a second live documentation tree inside the normal reading path. Backups may contain private content; do not publish them implicitly.

Record an exact local recovery location, its availability/lifetime, and the comparison base in linked optional migration evidence. Capture preexisting uncommitted edits as well as untracked originals; HEAD alone cannot preserve a dirty file. Use a per-file old/new inventory including assets, tracked/dirty/untracked state, comparison method, allowed differences and reviewed exceptions. Identify changed files individually and derive summary counts from this inventory. If originals are already unavailable, record the gap rather than reconstructing or asserting preservation.

Populate destinations before deleting originals. Maintain the old-to-new checklist with evidence that every meaningful section, requirement, decision, open question, example, historical result, and asset has a destination or an explicitly approved reason for omission. For whole-file moves, compare before/after content from tracked history or backup, isolate path/link and labelled historical-context edits, and review every other change for altered meaning or loss. This targeted diff review can replace a redundant reread when unchanged content is demonstrably preserved; git mv alone does not prove preservation. Record which files/diffs were checked and any gaps before cleanup/completion.

Repair inbound references across project docs, source comments/docstrings, agent instruction files, manifests, documentation builders, CI, and other known consumers. Update only documentation paths/configuration needed for this migration; preserve executable behavior. Validate the actual new links/anchors and consumer commands where safe and applicable. If a required path cannot change, retain a compatibility entry point and explain why.

Remove only the individually approved ordinary documentation files whose knowledge is preserved and references are repaired. Resolve final absolute paths and ensure they remain inside the intended project/documentation scope before deletion. Never perform a blanket recursive delete of `docs/`; it may contain assets, instruction files, or unapproved content. Remove directories only when empty after reviewed file removals. Protected agent files survive even if their containing documentation directory remains.

## 5. Verify ownership, resumption, and completeness

Check populated docs for broken routes, stale old paths, duplicate authorities, authoring leakage, and accidental secret values. Search known old paths and evaluate remaining occurrences: historical mentions and compatibility explanations differ from active broken links. Exercise human setup/resumption and agent feature/cross-subsystem routes. Verify all affected instruction-file references without weakening their rules.

Check link labels and active startup/upkeep instructions against the destination's role: current state/issues belong in status, plans in planning docs, dated claims in labelled history. Replace obsolete active instructions and reconcile broad guarantees with known defects without rewriting historical meaning or locked requirements. File moves and resolving links alone do not establish semantic consolidation. Walk setup/resumption through a named map route, and ensure dependency links select precise route anchors.

Run relevant safe documentation/build checks as prerequisites permit; list skipped checks and scope. Record actual results and code state. Update README navigation, model index, map, and status with the migration's current stopping point, unresolved exceptions, approval scope, and preservation/verification checklist location. Follow the contract's handoff maintenance routine.

Report migrated destinations, removed originals, protected/retained files with reasons and consumers, updated discovery references, actual checks, recovery location, and remaining work. Classify two outcomes: scope completion (complete / partial / blocked) and verification (passed / incomplete / failed). Full migration is complete when all approved ordinary documentation is transferred and cleanup finished; required retained agent files, public entry points, legal notices, or machine-consumed specs/fixtures are expected exceptions and do not alone make it partial. Ordinary docs within scope still awaiting transfer make it partial. Skipped preservation/routing/reference review means verification is incomplete even if all files moved. Do not claim verified full consolidation merely because files were renamed or old docs are linked.

Keep the per-file preservation record and completed walkthroughs in linked optional evidence; status carries concise outcomes, current blockers and the stopping point. Report stage-specific checks/code state, distinguish comment edits from executable behavior changes, and retain exact failed-test/seed information when available. Do not call expected retained artifacts unresolved product decisions unless an actual user decision is needed.

## 6. Clean up this installed prompt after success

After a completed approved migration with required verification passed, remove only the temporary target-project `continuity/migrate.md` supplied for this operation and any temporary links to it, then check surviving routes again. Keep `about.md`, core docs, optional detail, required entry points, and all agent instruction files. Do not delete the framework's canonical `template/continuity/migrate.md`, external/pasted prompts, unrelated files, or a reusable prompt the user chose to retain. Interrupted/partial migration or incomplete required verification keeps the installed prompt for resumption. Generic mentions of an optional prompt in about.md are valid after removal; preserve about.md and do not leave active links to a missing file.
