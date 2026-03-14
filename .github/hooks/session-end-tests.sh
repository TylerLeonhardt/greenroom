#!/bin/bash
# Session-end hook: Run the full test suite and typecheck as a final quality gate.
# Input: JSON on stdin with timestamp, cwd, reason fields.
# Output: Ignored by the hook system, but stderr is visible to the agent.
#
# Intentionally omitting -e so the script keeps running even if individual
# commands fail — we want to report results from all quality gates, not bail early.
set -uo pipefail

INPUT=$(cat)

REASON=$(echo "$INPUT" | jq -r '.reason // "unknown"' 2>/dev/null || echo "unknown")
echo "📋 Session ending (reason: $REASON). Running quality gates..." >&2

FAILED=0

# Run the full test suite — all output to stderr so the agent sees it
echo "" >&2
echo "🧪 Running tests (pnpm test)..." >&2
if pnpm test >&2 2>&1; then
	echo "✅ Tests passed." >&2
else
	echo "❌ Tests failed." >&2
	FAILED=1
fi

# Run typecheck — all output to stderr so the agent sees it
echo "" >&2
echo "🔎 Running typecheck (pnpm run typecheck)..." >&2
if pnpm run typecheck >&2 2>&1; then
	echo "✅ Typecheck passed." >&2
else
	echo "❌ Typecheck failed." >&2
	FAILED=1
fi

# Summary
echo "" >&2
if [ "$FAILED" -eq 0 ]; then
	echo "🎉 All quality gates passed!" >&2
else
	echo "⚠️  Some quality gates failed. Please review the output above." >&2
fi

exit 0
