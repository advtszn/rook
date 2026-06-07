#!/usr/bin/env sh
set -eu

REPO="advtszn/rook"
BINARY_NAME="rook"

get_arch() {
  arch=$(uname -m)
  case "$arch" in
    x86_64|amd64) echo "x64" ;;
    arm64|aarch64) echo "arm64" ;;
    *) echo "Unsupported architecture: $arch" >&2; exit 1 ;;
  esac
}

get_platform() {
  os=$(uname -s | tr '[:upper:]' '[:lower:]')
  case "$os" in
    linux) echo "linux" ;;
    darwin) echo "darwin" ;;
    mingw*|msys*|cygwin*) echo "windows" ;;
    *) echo "Unsupported OS: $os" >&2; exit 1 ;;
  esac
}

uninstall() {
  platform=$(get_platform)

  if [ "$platform" = "windows" ]; then
    install_dir="${ROOK_INSTALL_DIR:-$USERPROFILE/.rook/bin}"
    target="${install_dir}/${BINARY_NAME}.exe"
  else
    install_dir="${ROOK_INSTALL_DIR:-/usr/local/bin}"
    target="${install_dir}/${BINARY_NAME}"
  fi

  if [ ! -f "$target" ]; then
    echo "rook is not installed at ${target}"
    exit 1
  fi

  if [ ! -w "$install_dir" ]; then
    echo "Removing ${target} (requires sudo)..."
    sudo rm "$target"
  else
    rm "$target"
  fi

  echo "rook has been uninstalled."
}

main() {
  if [ "${1:-}" = "--uninstall" ]; then
    uninstall
    return
  fi

  platform=$(get_platform)
  arch=$(get_arch)
  artifact="rook-${platform}-${arch}"

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

  echo "Installing rook ${version} (${platform}/${arch})..."

  tmpdir=$(mktemp -d)
  trap 'rm -rf "$tmpdir"' EXIT

  if [ "$platform" = "windows" ]; then
    url="https://github.com/${REPO}/releases/download/${version}/${artifact}.zip"
    echo "Downloading ${url}"
    curl -fSL# "$url" -o "${tmpdir}/${artifact}.zip"
    unzip -q "${tmpdir}/${artifact}.zip" -d "$tmpdir"

    install_dir="${ROOK_INSTALL_DIR:-$USERPROFILE/.rook/bin}"
    mkdir -p "$install_dir"
    cp "${tmpdir}/${artifact}.exe" "${install_dir}/${BINARY_NAME}.exe"

    echo "Installed rook to ${install_dir}/${BINARY_NAME}.exe"
    echo "Add ${install_dir} to your PATH if it's not already there."
  else
    url="https://github.com/${REPO}/releases/download/${version}/${artifact}.tar.gz"
    echo "Downloading ${url}"
    curl -fSL# "$url" -o "${tmpdir}/${artifact}.tar.gz"
    tar -xzf "${tmpdir}/${artifact}.tar.gz" -C "$tmpdir"

    install_dir="${ROOK_INSTALL_DIR:-/usr/local/bin}"
    if [ ! -w "$install_dir" ]; then
      echo "Installing to ${install_dir} (requires sudo)..."
      sudo install -m 755 "${tmpdir}/${artifact}" "${install_dir}/${BINARY_NAME}"
    else
      install -m 755 "${tmpdir}/${artifact}" "${install_dir}/${BINARY_NAME}"
    fi

    echo "Installed rook to ${install_dir}/${BINARY_NAME}"
  fi

  echo "Run 'rook' to get started."
}

main "$@"
