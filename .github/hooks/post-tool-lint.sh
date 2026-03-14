#!/bin/bash
# Post-tool-use hook: Run biome lint on files changed by edit/create tools.
# Input: JSON on stdin with toolName, toolArgs, toolResult fields.
# Output: Ignored by the hook system, but stderr is visible to the agent.
set -uo pipefail

INPUT=$(cat)

TOOL_NAME=$(echo "$INPUT" | jq -r '.toolName' 2>/dev/null || echo "")

# Only lint after edit or create operations
if [ "$TOOL_NAME" != "edit" ] && [ "$TOOL_NAME" != "create" ]; then
	exit 0
fi

# Extract the file path from toolArgs (a JSON string with a "path" field).
# toolArgs is itself a JSON string, so it needs double-parsing.
# Use defensive parsing — malformed input should not crash the hook.
FILE_PATH=$(echo "$INPUT" | jq -r '.toolArgs' 2>/dev/null | jq -r '.path // empty' 2>/dev/null || echo "")

if [ -z "$FILE_PATH" ]; then
	exit 0
fi

# Only lint file types that biome handles
case "$FILE_PATH" in
	*.ts | *.tsx | *.json | *.css) ;;
	*) exit 0 ;;
esac

# Only lint if the file exists (create might have failed)
if [ ! -f "$FILE_PATH" ]; then
	exit 0
fi

echo "🔍 Running lint on $FILE_PATH..." >&2

# Run biome check on the single file. All output goes to stderr so the agent sees it.
# Exit 0 regardless — this hook is informational, not blocking.
if npx biome check "$FILE_PATH" >&2 2>&1; then
	echo "✅ Lint passed: $FILE_PATH" >&2
else
	echo "❌ Lint issues found in $FILE_PATH — please fix before committing." >&2
fi

exit 0
