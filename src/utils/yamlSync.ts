import type {
  BluffAppearance,
  MemoryBreakdownRow,
  OptInFlags,
  PortalBackend,
  YamlModuleName,
} from '../types/bluff';

export function buildYamlFiles(
  appearance: BluffAppearance,
  optIn: OptInFlags,
): Record<YamlModuleName, string> {
  const bluffYaml = `# BLUFF — Ultra-Lightweight Scrolling Wayland Compositor
# Author: Unknown_Skittle
# Target Idle RSS: <= 40 MiB (full graphical session)

meta:
  name: BLUFF
  author: Unknown_Skittle
  max_idle_rss_mib: 40

imports:
  - binds.yaml
  - appearance.yaml
  - apps.yaml
  - sync.yaml

layout:
  default_column_width: 0.5
  center_focused_column: on_overflow
  preset_column_widths:
    - 0.3333
    - 0.5000
    - 0.6667

opt_in:
  xwayland: ${optIn.xwayland}
  portal: ${optIn.portal}
`;

  const appearanceYaml = `# BLUFF Visual & Shader Effects (Minimalist Monochrome Terminal)
appearance:
  corner_radius: ${appearance.cornerRadius}
  outline_width: ${appearance.outlineWidth}
  active_outline: "${appearance.activeOutline}"
  inactive_outline: "${appearance.inactiveOutline}"
  outer_padding: ${appearance.outerPadding}
  column_gap: ${appearance.columnGap}
  opacity: ${appearance.opacity.toFixed(2)}
  blur_enabled: ${appearance.blurEnabled && optIn.blurShader}
  blur_radius: ${appearance.blurRadius}
  blur_passes: ${appearance.blurPasses}
`;

  const bindsYaml = `# 1:1 Niri keybind clone — launcher bound to SUPER+SPACE (ROFI)
binds:
  - key: Mod+Space
    action: spawn
    args: "rofi -show drun -theme bluff-mono"
  - key: Mod+Return
    action: spawn
    args: "alacritty"
  - key: Mod+E
    action: spawn
    args: "thunar"
  - key: Mod+Q
    action: close_window

  - key: Mod+Left
    action: focus_column_left
  - key: Mod+Right
    action: focus_column_right
  - key: Mod+H
    action: focus_column_left
  - key: Mod+L
    action: focus_column_right
  - key: Mod+Down
    action: focus_window_down
  - key: Mod+Up
    action: focus_window_up
  - key: Mod+J
    action: focus_window_down
  - key: Mod+K
    action: focus_window_up

  - key: Mod+Shift+Left
    action: move_column_left
  - key: Mod+Shift+Right
    action: move_column_right
  - key: Mod+Comma
    action: consume_window_into_column
  - key: Mod+Period
    action: expel_window_from_column

  - key: Mod+R
    action: switch_preset_column_width
  - key: Mod+F
    action: maximize_column
  - key: Mod+Shift+F
    action: fullscreen_window
  - key: Mod+Shift+R
    action: reload_config
  - key: Mod+Shift+E
    action: quit
`;

  const appsYaml = `# BLUFF Default Applications
apps:
  terminal: alacritty
  file_manager: thunar
  launcher: "rofi -show drun -theme bluff-mono"
  autostart:
    - "alacritty"
`;

  const syncYaml = `# Opt-in GTK3/GTK4 and Qt5/Qt6 Theme Synchronization
sync:
  enabled: ${optIn.gtkQtSync}
  gtk3: ${optIn.gtk3}
  gtk4: ${optIn.gtk4}
  qt5: ${optIn.qt5}
  qt6: ${optIn.qt6}
  font_family: "JetBrains Mono"
  font_size: 10
  monochrome_theme: "bluff-mono-dark"
`;

  return {
    'bluff.yaml': bluffYaml,
    'appearance.yaml': appearanceYaml,
    'binds.yaml': bindsYaml,
    'apps.yaml': appsYaml,
    'sync.yaml': syncYaml,
  };
}

export function applyYamlEditsToState(
  fileName: YamlModuleName,
  content: string,
  prevAppearance: BluffAppearance,
  prevOptIn: OptInFlags,
): {appearance: BluffAppearance; optIn: OptInFlags} {
  const appearance = {...prevAppearance};
  const optIn = {...prevOptIn};

  const lines = content.split('\n');
  for (const raw of lines) {
    const clean = raw.split('#')[0].trim();
    const colon = clean.indexOf(':');
    if (colon === -1) continue;
    const key = clean.slice(0, colon).trim();
    const val = clean.slice(colon + 1).trim().replace(/^["']|["']$/g, '');

    if (fileName === 'appearance.yaml') {
      if (key === 'corner_radius' && !Number.isNaN(Number(val))) {
        appearance.cornerRadius = Math.max(0, Math.min(24, Math.round(Number(val))));
      } else if (key === 'outline_width' && !Number.isNaN(Number(val))) {
        appearance.outlineWidth = Math.max(0, Math.min(4, Math.round(Number(val))));
      } else if (key === 'outer_padding' && !Number.isNaN(Number(val))) {
        appearance.outerPadding = Math.max(0, Math.min(28, Math.round(Number(val))));
      } else if (key === 'column_gap' && !Number.isNaN(Number(val))) {
        appearance.columnGap = Math.max(0, Math.min(28, Math.round(Number(val))));
      } else if (key === 'opacity' && !Number.isNaN(Number(val))) {
        appearance.opacity = Math.max(0.55, Math.min(1, Number(val)));
      } else if (key === 'blur_enabled') {
        appearance.blurEnabled = val === 'true';
      } else if (key === 'blur_radius' && !Number.isNaN(Number(val))) {
        appearance.blurRadius = Math.max(0, Math.min(20, Math.round(Number(val))));
      } else if (key === 'active_outline' && /^#[0-9a-fA-F]{6}$/.test(val)) {
        appearance.activeOutline = val;
      }
    } else if (fileName === 'bluff.yaml') {
      if (key === 'xwayland') optIn.xwayland = val === 'true';
      if (
        key === 'portal' &&
        (val === 'none' || val === 'lwp-minimal' || val === 'xdg-desktop-portal-wlr')
      ) {
        optIn.portal = val as PortalBackend;
      }
    } else if (fileName === 'sync.yaml') {
      if (key === 'enabled') optIn.gtkQtSync = val === 'true';
      if (key === 'gtk3') optIn.gtk3 = val === 'true';
      if (key === 'gtk4') optIn.gtk4 = val === 'true';
      if (key === 'qt5') optIn.qt5 = val === 'true';
      if (key === 'qt6') optIn.qt6 = val === 'true';
    }
  }

  return {appearance, optIn};
}

export function buildGtkQtSyncArtifacts(
  appearance: BluffAppearance,
  optIn: OptInFlags,
): Array<{target: string; enabled: boolean; content: string}> {
  const gtk3 = `[Settings]
gtk-theme-name=bluff-mono-dark
gtk-application-prefer-dark-theme=1
gtk-font-name=JetBrains Mono 10
gtk-decoration-layout=
gtk-enable-animations=0
`;

  const gtk4 = `/* Auto-synced by BLUFF compositor from appearance.yaml & sync.yaml */
window, dialog, popover > contents {
  background-color: rgba(17, 17, 20, ${appearance.opacity.toFixed(2)});
  color: #f4f4f5;
  border: ${appearance.outlineWidth}px solid ${appearance.inactiveOutline};
  border-radius: ${appearance.cornerRadius}px;
  font-family: "JetBrains Mono", monospace;
}

button, entry {
  background-color: #18181b;
  color: #fafafa;
  border: 1px solid #27272a;
  border-radius: ${Math.min(appearance.cornerRadius, 8)}px;
}
`;

  const qt5 = `[Appearance]
style=Fusion
custom_palette=true
color_scheme_path=~/.config/qt5ct/colors/bluff-mono.conf

[Fonts]
general="JetBrains Mono,10,-1,5,50,0,0,0,0,0"
fixed="JetBrains Mono,10,-1,5,50,0,0,0,0,0"

[Interface]
buttonbox_layout=0
activate_item_on_single_click=1
# Synced corner_radius=${appearance.cornerRadius}px outline_width=${appearance.outlineWidth}px active=${appearance.activeOutline}
`;

  const qt6 = `[Appearance]
style=Fusion
custom_palette=true
color_scheme_path=~/.config/qt6ct/colors/bluff-mono.conf

[Fonts]
general="JetBrains Mono,10,-1,5,50,0,0,0,0,0"
fixed="JetBrains Mono,10,-1,5,50,0,0,0,0,0"

[Interface]
buttonbox_layout=0
activate_item_on_single_click=1
# Synced corner_radius=${appearance.cornerRadius}px outline_width=${appearance.outlineWidth}px opacity=${appearance.opacity.toFixed(2)}
`;

  return [
    {target: '~/.config/gtk-3.0/settings.ini', enabled: optIn.gtkQtSync && optIn.gtk3, content: gtk3},
    {target: '~/.config/gtk-4.0/gtk.css', enabled: optIn.gtkQtSync && optIn.gtk4, content: gtk4},
    {target: '~/.config/qt5ct/qt5ct.conf', enabled: optIn.gtkQtSync && optIn.qt5, content: qt5},
    {target: '~/.config/qt6ct/qt6ct.conf', enabled: optIn.gtkQtSync && optIn.qt6, content: qt6},
  ];
}

export function computeMemoryBreakdown(
  appearance: BluffAppearance,
  optIn: OptInFlags,
): {rows: MemoryBreakdownRow[]; totalMib: number} {
  const portalMib =
    optIn.portal === 'none' ? 0 : optIn.portal === 'lwp-minimal' ? 1.1 : 2.6;

  const rows: MemoryBreakdownRow[] = [
    {
      subsystem: 'BLUFF Core Binary (.text + .rodata)',
      allocator: 'ELF / Zig ReleaseSafe',
      mib: 2.4,
      enabled: true,
      note: 'Pure Zig compositor with zero C source bloat',
    },
    {
      subsystem: 'Wayland Display + DRM/KMS + GBM/EGL',
      allocator: 'System shared libs + Mesa GLES2',
      mib: 16.8,
      enabled: true,
      note: 'Single output framebuffer + damage ring',
    },
    {
      subsystem: 'libinput + libxkbcommon Keymap',
      allocator: 'Seat & XKB state',
      mib: 4.1,
      enabled: true,
      note: '1:1 Niri keybind table and input device handle',
    },
    {
      subsystem: 'Scratch Arena + Modular YAML Config',
      allocator: 'Static FixedBufferAllocator (2 MiB)',
      mib: 2.0,
      enabled: true,
      note: 'Zero heap fragmentation on live reload',
    },
    {
      subsystem: 'Scrolling Strip Layout Engine',
      allocator: 'GPA Unmanaged ArrayLists',
      mib: 0.9,
      enabled: true,
      note: 'Column nodes and spring viewport state',
    },
    {
      subsystem: 'Rounded Corners SDF Shader',
      allocator: 'comptime -Drounded-corners',
      mib: 0.6,
      enabled: optIn.roundedCorners,
      note: 'Compiled out completely when disabled',
    },
    {
      subsystem: 'Dual-Pass Kawase Blur FBO',
      allocator: 'comptime -Dblur-shader',
      mib: 2.1,
      enabled: optIn.blurShader && appearance.blurEnabled,
      note: 'Half-res offscreen FBO only allocated when active',
    },
    {
      subsystem: 'GTK3/4 & Qt5/6 Sync Writer',
      allocator: 'comptime -Dgtk-qt-sync',
      mib: 0.4,
      enabled: optIn.gtkQtSync,
      note: 'Writes INI/CSS/QtCt on startup and reload',
    },
    {
      subsystem: `Desktop Portal (${optIn.portal})`,
      allocator: 'comptime -Dportal',
      mib: portalMib,
      enabled: optIn.portal !== 'none',
      note: 'Avoids heavyweight GNOME/KDE portal daemons',
    },
    {
      subsystem: 'Rootless XWayland Bridge',
      allocator: 'comptime -Dxwayland',
      mib: 14.2,
      enabled: optIn.xwayland,
      note: 'Opt-in legacy X11 server; pushes idle session above 40 MiB when active',
    },
  ];

  const totalMib = Number(
    rows
      .filter((r) => r.enabled)
      .reduce((acc, r) => acc + r.mib, 0)
      .toFixed(1),
  );

  return {rows, totalMib};
}

export function formatZigBuildCommand(optIn: OptInFlags): string {
  const portalEnum = optIn.portal.replaceAll('-', '_');
  return [
    'zig build -Doptimize=ReleaseSafe',
    `-Dxwayland=${optIn.xwayland}`,
    `-Dblur-shader=${optIn.blurShader}`,
    `-Drounded-corners=${optIn.roundedCorners}`,
    `-Dgtk-qt-sync=${optIn.gtkQtSync}`,
    `-Dportal=${portalEnum}`,
  ].join(' \\\n  ');
}
