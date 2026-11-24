# BLUFF

**BLUFF** is an ultra-lightweight, resource-obsessed scrolling Wayland compositor written in **Zig** by **Unknown_Skittle**, built for fans of Niri's infinite horizontal scrolling workflow who demand **<= 40 MiB idle RSS** in a full graphical session and sub-2-second compilation.

## Core Properties

- **Language**: Pure Zig (zero authored C files, zero external Zig package bloat).
- **Idle Memory Ceiling**: <= 40 MiB RSS in a full graphical session (`bluff --print-rss`).
- **Scrolling Layout**: 1:1 Niri clone (horizontal infinite strip, column width presets, consume/expel stacking).
- **Default Apps & Keybinds**: `Alacritty` (`Mod+Return`), `Thunar` (`Mod+E`), `Rofi` (`Mod+Space`).
- **Modular YAML**: Split across `bluff.yaml`, `binds.yaml`, `appearance.yaml`, `apps.yaml`, and `sync.yaml`.
- **Visual Shaders**: Opt-in GLES2 SDF rounded corners, crisp outlines, outer padding, per-window opacity, and Kawase blur.
- **GTK & Qt Sync**: Optional live sync generating `gtk-3.0/settings.ini`, `gtk-4.0/gtk.css`, `qt5ct.conf`, and `qt6ct.conf`.
- **Opt-In Everything**: XWayland (`-Dxwayland=true`) and heavy portals are disabled/minimal by default.

## Quick Build (Arch Linux + `yay`)

`./install.sh` verifies and installs all required dependencies via `yay` (`zig`, Wayland/DRM/GLES2 libraries, `alacritty`, `thunar`, `rofi`, `qt5ct`/`qt6ct`), runs Zig unit tests, builds BLUFF, and installs the binary and modular YAML config:

```bash
chmod +x install.sh
./install.sh

# Optional: include opt-in XWayland bridge (+xorg-xwayland)
./install.sh --with-xwayland
```

Manual build command:

```bash
# Minimal <= 30 MiB build (no XWayland, lwp-minimal portal)
zig build -Doptimize=ReleaseSafe -Dxwayland=false -Dportal=lwp_minimal

# Verify idle RSS & config
./zig-out/bin/bluff --check --config ./config/bluff.yaml
./zig-out/bin/bluff --print-rss
```

## Dependencies (Runtime)

- `wayland`, `libdrm`, `libgbm`, `mesa` (EGL + GLESv2), `libinput`, `udev`, `libxkbcommon`
- Optional lightweight portal: `lwp` or `xdg-desktop-portal-wlr`
- Default session apps: `alacritty`, `thunar`, `rofi`
