#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <alias-file>"
  exit 1
fi

INPUT="$1"

# Resolve to absolute path first (handles ../ correctly)
ABS_PATH="$(cd "$(dirname "$INPUT")" && pwd -P)/$(basename "$INPUT")"

swift -e '
import Foundation

let path = URL(fileURLWithPath: CommandLine.arguments[1])
do {
    let resolved = try URL(resolvingAliasFileAt: path)
    print(resolved.path)
} catch {
    fputs("Error: \(error)\n", stderr)
    exit(1)
}
' "$ABS_PATH"
