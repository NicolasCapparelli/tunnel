# Working on Tunnel

- Leave manual and visual testing to the user unless they explicitly authorize it for the task. Do not launch an emulator, inspect screenshots, or interactively exercise the app without that authorization.
- Automated unit tests, typechecks, and compilation/build checks are allowed. Keep verification proportional to the change and avoid repeated checks without a new reason.
- Use the vendored Aurora core and the appropriate web/native adapter. Preserve one shared core instance and the stable theme contract.
- Windows and Android are the first targets. macOS follows; remote-network transport, account auth, and attachments are future features.

Before project work, read the project-root `continuity/agent/instructions.md`, `continuity/status.md`, and complete `continuity/agent/map.md`; reuse unchanged loaded context and follow relevant routes into source. Before ending every user-facing turn, update the implementation log and capture changed planning intent; follow the contract's UI design reading rules. Before every otherwise-authorized commit and every handoff, review changes, update affected Continuity documentation alongside implementation, and review status and changed links. Unaffected documents need no ceremonial edit. Follow all applicable repository instructions.
