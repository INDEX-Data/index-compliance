#!/bin/bash
# Copy control definition files from src/data/ to supabase/functions/_shared/controls/
# Run this before deploying Edge Functions.

set -e

SRC="src/data"
DEST="supabase/functions/_shared/controls"

mkdir -p "$DEST"

for file in cmmc-l2-controls nist-csf-controls nist-800-171-controls hipaa-controls finra-controls ferpa-controls; do
  if [ -f "$SRC/${file}.ts" ]; then
    echo "Copying $file.ts..."
    # Copy and fix imports for Deno compatibility
    sed 's/from "\.\.\/types\.js"/from "..\/types.ts"/g; s/from "\.\.\/constants\.js"/from "..\/constants.ts"/g' \
      "$SRC/${file}.ts" > "$DEST/${file}.ts"
  fi
done

echo "Done. Control files copied to $DEST/"
