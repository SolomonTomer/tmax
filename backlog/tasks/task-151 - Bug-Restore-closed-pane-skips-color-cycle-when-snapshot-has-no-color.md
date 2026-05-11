---
id: TASK-151
title: 'Bug: Restore closed pane skips color cycle when snapshot has no color'
status: Done
assignee: []
created_date: '2026-05-11 05:59'
updated_date: '2026-05-11 09:07'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
restorePaneFromSnapshot in src/renderer/state/terminal-store.ts called createTerminal (which auto-cycles a color when autoColorTabs is on) then unconditionally overwrote tabColor with snap.tabColor. When the saved snapshot had no color (e.g. pane created while autoColorTabs was off), the restored pane ended up colorless even with auto-color now enabled. Fix: tabColor: snap.tabColor ?? fresh.tabColor.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Restoring a closed pane with a saved color keeps that exact color
- [x] #2 Restoring a closed pane with no saved color while autoColorTabs is on assigns a least-used palette color (consistent with new tabs)
- [x] #3 Restoring a closed pane while autoColorTabs is off stays colorless
- [x] #4 Workspace restore path also benefits (same restorePaneFromSnapshot is reused per pane)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
$Follow-up after first manual test: openCopilotSession / openClaudeCodeSession (the "Sessions" window restore path) also bypassed the cycle because openAiSession built the TerminalInstance without setting tabColor. Extracted pickNextTabColor helper from createTerminal and applied it in both createTerminal and openAiSession. restorePaneFromSnapshot already inherits via createTerminal.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Changed 	abColor: snap.tabColor to 	abColor: snap.tabColor ?? fresh.tabColor in restorePaneFromSnapshot (src/renderer/state/terminal-store.ts). createTerminal already runs the correct per-workspace least-used color cycle gated by autoColorTabs; the prior code threw that result away. With the nullish-coalesce, saved colors win when present, and a colorless snapshot inherits the freshly cycled color. Behavior when autoColorTabs is off is preserved (fresh.tabColor is undefined). One-line behavioral fix plus an explanatory comment; no test coverage added because the repo has no unit-test framework and adding e2e color-cycle scaffolding was out of scope.

$Follow-up: Sessions-window restore (openAiSession) also bypassed the color cycle. Extracted pickNextTabColor helper (per-workspace least-used cycle, autoColorTabs-gated) and applied it in createTerminal and openAiSession. All three pane-creation paths (Ctrl+T new tab, Ctrl+Shift+T undo close, Sessions window open) now share one cycling implementation.
<!-- SECTION:FINAL_SUMMARY:END -->
