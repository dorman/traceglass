#!/usr/bin/env bash
# @polsia:user-owned — local wrapper; never a remote-shell installer.
# Run the locally downloaded native installer. This wrapper deliberately does
# not download, interpret, or pipe remote content into a shell.
set -eo pipefail

if [[ ! -t 0 ]]; then
  echo "error: do not pipe install.sh from the network into a shell." >&2
  echo "       Download the signed, target-matched loglens-installer binary first." >&2
  exit 1
fi

script_dir="$(CDPATH= cd -- "$(dirname "$BASH_SOURCE")" && pwd)"
installer="$script_dir/../loglens-installer"
if [[ -n "$LOGLENS_INSTALLER_PATH" ]]; then
  installer="$LOGLENS_INSTALLER_PATH"
fi

if [[ ! -f "$installer" || ! -x "$installer" ]]; then
  echo "error: native installer not found or not executable: $installer" >&2
  echo "       Download the installer from the published GitHub Release, then run it locally." >&2
  exit 1
fi

exec "$installer" "$@"
