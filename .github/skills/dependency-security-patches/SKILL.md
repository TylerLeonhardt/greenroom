---
name: dependency-security-patches
description: Focused workflow for patching vulnerable dependencies and proving the advisory is gone
---

# Dependency Security Patch Workflow

Use this workflow for CVE/GHSA dependency updates:

1. Capture the vulnerable package path and advisory before editing:
   `pnpm why <package>` and `pnpm audit --json`.
2. Upgrade the complete framework/package family together, staying within the requested release line.
3. Regenerate `pnpm-lock.yaml` with `pnpm install --lockfile-only`; reject unrelated lockfile
   refreshes and do not bundle opportunistic dependency upgrades.
4. Prove every vulnerable resolution is gone with `pnpm why <package>`, lockfile search, and a
   second `pnpm audit --json` check for the exact advisory ID.
5. Investigate other audit findings separately. Remove an unused vulnerable direct dependency only
   when repository-wide search proves it has no imports; otherwise defer it.
6. Run typecheck, lint, build, unit and integration tests, plus both Playwright CI matrices:
   `pnpm test:e2e:ci` and `pnpm test:e2e:explorer`.
7. Before every commit or push, confirm the feature branch with `git branch --show-current`.
8. Report before/after versions, audit evidence, deferred findings, review dispositions, and CI/PR
   status.
