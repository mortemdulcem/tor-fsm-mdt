---
name: GitHub repository content policy
description: Which non-code assets belong in the tor-fsm-mdt GitHub repository and how to push when stored PATs fail.
---

Keep the GitHub repository code-focused: remove DOC/DOCX/PDF and visual assets, including thesis and experiment figures. Preserve only `client/public/favicon.png` because the running app uses it.

**Why:** The user explicitly chose a code-only GitHub repository on 2026-08-26. Leaving download routes or UI controls for removed documents creates broken behavior.

**How to apply:** Before pushing, scan the complete remote tree as well as the local tree because remote-only assets may exist. Remove stale routes and UI links together with their files.

Stored PAT secrets may be rejected even if they worked previously. Prefer the Replit GitHub OAuth connection and Git Data API. Base commits on the current remote tree and update the branch with `force: false`.

**Why:** Both stored PATs returned invalid-token errors, while the existing Replit GitHub connection had repository write permission and succeeded.

**How to apply:** Filter deletion entries against the remote tree before creating a Git tree; GitHub returns `GitRPC::BadObjectState` when a null-SHA deletion targets a path absent from the base tree.