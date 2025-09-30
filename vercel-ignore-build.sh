#!/bin/bash
msg="$VERCEL_GIT_COMMIT_MESSAGE"

if [[ ! "$msg" =~ ^(feat:|fix:) ]]; then
  echo "🛑 Skipping deploy: commit does not start with 'feat:' or 'fix:'"
  exit 0
fi

echo "✅ Commit message OK: deploying..."
exit 1
