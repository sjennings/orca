#!/usr/bin/env bash
# Upload one fork-client-release build leg's packaged artifacts into the draft
# release. Invoked under nick-fields/retry so a flaky CDN push retries.
#
# Env: GH_TOKEN, GITHUB_REPOSITORY, TAG, UPLOAD_GLOBS (space-separated globs
# relative to the checkout root, e.g. 'dist/*.dmg dist/latest-mac.yml').
set -euo pipefail
shopt -s nullglob

files=()
for glob in $UPLOAD_GLOBS; do
  files+=("$glob")
done

if (( ${#files[@]} == 0 )); then
  echo "::error::No artifacts matched any of: $UPLOAD_GLOBS"
  exit 1
fi

echo "Uploading ${#files[@]} artifacts to $TAG:"
printf '  %s\n' "${files[@]}"
gh release upload "$TAG" "${files[@]}" --repo "$GITHUB_REPOSITORY" --clobber
