#!/usr/bin/env bash
set -euo pipefail

# arch install (yay)

ENABLE_XWAYLAND="false"
PORTAL_TARGET="lwp_minimal"

for arg in "$@"; do
  case "${arg}" in
    --with-xwayland)
      ENABLE_XWAYLAND="true"
      ;;
    --portal=*)
      PORTAL_TARGET="${arg#*=}"
      ;;
    -h|--help)
      echo "BLUFF Arch Linux installer"
      echo "  --with-xwayland       Build and install opt-in XWayland support"
      echo "  --portal=<backend>    none | lwp_minimal | xdg_desktop_portal_wlr"
      exit 0
      ;;
    *)
      echo "Unknown option: ${arg}"
      exit 1
      ;;
  esac
done

if [ "${EUID}" -eq 0 ]; then
  echo "Do not run ./install.sh as root; yay handles sudo prompts safely."
  exit 1
fi

if ! command -v pacman >/dev/null 2>&1; then
  echo "Error: pacman not found. This installer targets Arch Linux."
  exit 1
fi

if ! command -v yay >/dev/null 2>&1; then
  echo "yay not found. Installing yay-bin from AUR first..."
  sudo pacman -S --needed --noconfirm base-devel git
  tmp_yay="$(mktemp -d)"
  trap 'rm -rf "${tmp_yay}"' EXIT
  git clone https://aur.archlinux.org/yay-bin.git "${tmp_yay}/yay-bin"
  (cd "${tmp_yay}/yay-bin" && makepkg -si --noconfirm)
fi

echo "[1/5] Verifying and installing BLUFF build & runtime dependencies via yay..."

CORE_PKGS=(
  zig
  pkgconf
  wayland
  wayland-protocols
  libdrm
  mesa
  libinput
  systemd-libs
  libxkbcommon
  dbus
)

APP_PKGS=(
  alacritty
  thunar
)

# rofi / rofi-wayland
if ! command -v rofi >/dev/null 2>&1; then
  if yay -Si rofi-wayland >/dev/null 2>&1; then
    APP_PKGS+=(rofi-wayland)
  else
    APP_PKGS+=(rofi)
  fi
fi

OPT_PKGS=(
  qt5ct
  qt6ct
)

if [ "${PORTAL_TARGET}" = "xdg_desktop_portal_wlr" ]; then
  OPT_PKGS+=(xdg-desktop-portal xdg-desktop-portal-wlr)
fi

if [ "${ENABLE_XWAYLAND}" = "true" ]; then
  OPT_PKGS+=(xorg-xwayland)
fi

ALL_PKGS=("${CORE_PKGS[@]}" "${APP_PKGS[@]}" "${OPT_PKGS[@]}")
MISSING_PKGS=()

for pkg in "${ALL_PKGS[@]}"; do
  if ! pacman -Qi "${pkg}" >/dev/null 2>&1; then
    MISSING_PKGS+=("${pkg}")
  fi
done

if [ ${#MISSING_PKGS[@]} -gt 0 ]; then
  echo "Installing missing packages with yay: ${MISSING_PKGS[*]}"
  yay -S --needed --noconfirm "${MISSING_PKGS[@]}"
else
  echo "All Arch dependencies are already installed."
fi

echo "[2/5] Verifying pkg-config Wayland/DRM/GLES2 headers..."
for lib in wayland-server libdrm gbm egl glesv2 libinput libudev xkbcommon; do
  if ! pkg-config --exists "${lib}"; then
    echo "Error: pkg-config could not resolve '${lib}'."
    exit 1
  fi
done

echo "[3/5] Checking Zig toolchain and build.zig.zon manifest..."
ZIG_VER="$(zig version)"
echo "Found Zig ${ZIG_VER}"

if ! grep -q '\.fingerprint' build.zig.zon; then
  probe_out="$(zig build --help 2>&1 || true)"
  fp="$(echo "${probe_out}" | sed -n 's/.*suggested value: \(0x[0-9a-fA-F]*\).*/\1/p' | head -n1)"
  if [ -n "${fp}" ]; then
    echo "Adding package fingerprint ${fp} to build.zig.zon..."
    sed -i "s/\.version = \"0.1.0\",/.version = \"0.1.0\",\n    .fingerprint = ${fp},/" build.zig.zon
  fi
fi

echo "[4/5] Running unit tests and building BLUFF (ReleaseSafe, xwayland=${ENABLE_XWAYLAND}, portal=${PORTAL_TARGET})..."
zig build test -Dxwayland="${ENABLE_XWAYLAND}" -Dportal="${PORTAL_TARGET}"
zig build -Doptimize=ReleaseSafe -Dxwayland="${ENABLE_XWAYLAND}" -Dportal="${PORTAL_TARGET}"

echo "[5/5] Installing binary and modular YAML config..."
BIN_DIR="${HOME}/.local/bin"
CONFIG_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/bluff"
mkdir -p "${BIN_DIR}" "${CONFIG_DIR}"

install -m 755 ./zig-out/bin/bluff "${BIN_DIR}/bluff"
cp -n config/*.yaml "${CONFIG_DIR}/" || true

./zig-out/bin/bluff --check --config "${CONFIG_DIR}/bluff.yaml"

echo ""
echo "BLUFF installed successfully!"
echo "  Binary:  ${BIN_DIR}/bluff"
echo "  Config:  ${CONFIG_DIR}/"
echo "  Launch from TTY: ${BIN_DIR}/bluff --print-rss"
