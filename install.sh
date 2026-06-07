#!/usr/bin/env sh
set -eu

REPO="advtszn/rook"
INSTALL_DIR="${ROOK_INSTALL_DIR:-/usr/local/bin}"
BINARY_NAME="rook"

get_arch() {
  arch=$(uname -m)
  case "$arch" in
    x86_64|amd64) echo "x64" ;;
    arm64|aarch64) echo "arm64" ;;
    *) echo "Unsupported architecture: $arch" >&2; exit 1 ;;
  esac
}

get_os() {
  os=$(uname -s | tr '[:upper:]' '[:lower:]')
  case "$os" in
    linux) echo "linux" ;;
    darwin) echo "darwin" ;;
    *) echo "Unsupported OS: $os" >&2; exit 1 ;;
  esac
}

main() {
  os=$(get_os)
  arch=$(get_arch)
  artifact="rook-${os}-${arch}"

  if [ -n "${1:-}" ]; then
    version="$1"
  else
    version=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" \
      | grep '"tag_name"' | head -1 | cut -d'"' -f4)
  fi

  if [ -z "$version" ]; then
    echo "Error: could not determine latest version" >&2
    exit 1
  fi

  url="https://github.com/${REPO}/releases/download/${version}/${artifact}.tar.gz"

  echo "Installing rook ${version} (${os}/${arch})..."

  tmpdir=$(mktemp -d)
  trap 'rm -rf "$tmpdir"' EXIT

  curl -fsSL "$url" -o "${tmpdir}/${artifact}.tar.gz"
  tar -xzf "${tmpdir}/${artifact}.tar.gz" -C "$tmpdir"

  if [ ! -w "$INSTALL_DIR" ]; then
    echo "Installing to ${INSTALL_DIR} (requires sudo)..."
    sudo install -m 755 "${tmpdir}/${artifact}" "${INSTALL_DIR}/${BINARY_NAME}"
  else
    install -m 755 "${tmpdir}/${artifact}" "${INSTALL_DIR}/${BINARY_NAME}"
  fi

  echo "Installed rook to ${INSTALL_DIR}/${BINARY_NAME}"
  echo "Run 'rook' to get started."
}

main "$@"
