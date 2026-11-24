export type PortalBackend = 'none' | 'lwp-minimal' | 'xdg-desktop-portal-wlr';

export type WorkspaceTab = 'session' | 'config' | 'source' | 'reference';

export type YamlModuleName =
  | 'bluff.yaml'
  | 'binds.yaml'
  | 'appearance.yaml'
  | 'apps.yaml'
  | 'sync.yaml';

export interface BluffAppearance {
  cornerRadius: number;
  outlineWidth: number;
  activeOutline: string;
  inactiveOutline: string;
  outerPadding: number;
  columnGap: number;
  opacity: number;
  blurEnabled: boolean;
  blurRadius: number;
  blurPasses: number;
}

export interface OptInFlags {
  xwayland: boolean;
  blurShader: boolean;
  roundedCorners: boolean;
  gtkQtSync: boolean;
  portal: PortalBackend;
  gtk3: boolean;
  gtk4: boolean;
  qt5: boolean;
  qt6: boolean;
}

export type AppKind = 'alacritty' | 'thunar' | 'btop' | 'foot' | 'imv' | 'zathura';

export interface WindowInstance {
  id: string;
  app: AppKind;
  title: string;
  fullscreen: boolean;
}

export interface StripColumn {
  id: string;
  widthFraction: number;
  maximized: boolean;
  windows: WindowInstance[];
}

export interface RofiEntry {
  app: AppKind;
  name: string;
  exec: string;
  category: string;
}

export interface KeybindSpec {
  id: string;
  keys: string;
  niriOriginal: string;
  action: string;
  description: string;
  category: 'Apps & Launcher' | 'Scrolling Navigation' | 'Column & Stack' | 'Sizing' | 'Session';
  changedFromNiri?: boolean;
}

export interface SourceFileItem {
  path: string;
  size: number;
  language: string;
  content: string;
}

export interface MemoryBreakdownRow {
  subsystem: string;
  allocator: string;
  mib: number;
  enabled: boolean;
  note: string;
}

export const DEFAULT_APPEARANCE: BluffAppearance = {
  cornerRadius: 8,
  outlineWidth: 1,
  activeOutline: '#FAFAFA',
  inactiveOutline: '#27272A',
  outerPadding: 14,
  columnGap: 12,
  opacity: 0.96,
  blurEnabled: true,
  blurRadius: 10,
  blurPasses: 2,
};

export const DEFAULT_OPT_IN: OptInFlags = {
  xwayland: false,
  blurShader: true,
  roundedCorners: true,
  gtkQtSync: true,
  portal: 'lwp-minimal',
  gtk3: true,
  gtk4: true,
  qt5: true,
  qt6: true,
};

export const ROFI_CATALOG: RofiEntry[] = [
  {app: 'alacritty', name: 'Alacritty', exec: 'alacritty', category: 'Terminal'},
  {app: 'thunar', name: 'Thunar', exec: 'thunar', category: 'File Manager'},
  {app: 'btop', name: 'btop++', exec: 'alacritty -e btop', category: 'System Monitor'},
  {app: 'foot', name: 'Foot', exec: 'foot', category: 'Terminal'},
  {app: 'imv', name: 'imv', exec: 'imv', category: 'Image Viewer'},
  {app: 'zathura', name: 'Zathura', exec: 'zathura', category: 'Document Reader'},
];

export const NIRI_CLONE_KEYBINDS: KeybindSpec[] = [
  {
    id: 'rofi',
    keys: 'Super + Space',
    niriOriginal: 'Mod+D (fuzzel)',
    action: 'spawn "rofi -show drun -theme bluff-mono"',
    description: 'Open Rofi application launcher',
    category: 'Apps & Launcher',
    changedFromNiri: true,
  },
  {
    id: 'alacritty',
    keys: 'Super + Return',
    niriOriginal: 'Mod+T / Mod+Return',
    action: 'spawn "alacritty"',
    description: 'Launch Alacritty terminal emulator',
    category: 'Apps & Launcher',
  },
  {
    id: 'thunar',
    keys: 'Super + E',
    niriOriginal: 'Custom spawn',
    action: 'spawn "thunar"',
    description: 'Launch Thunar file manager',
    category: 'Apps & Launcher',
  },
  {
    id: 'close',
    keys: 'Super + Q',
    niriOriginal: 'Mod+Q',
    action: 'close_window',
    description: 'Close focused window',
    category: 'Apps & Launcher',
  },
  {
    id: 'focus-left',
    keys: 'Super + H / Left',
    niriOriginal: 'Mod+H / Left',
    action: 'focus_column_left',
    description: 'Pan viewport and focus previous column',
    category: 'Scrolling Navigation',
  },
  {
    id: 'focus-right',
    keys: 'Super + L / Right',
    niriOriginal: 'Mod+L / Right',
    action: 'focus_column_right',
    description: 'Pan viewport and focus next column',
    category: 'Scrolling Navigation',
  },
  {
    id: 'focus-down',
    keys: 'Super + J / Down',
    niriOriginal: 'Mod+J / Down',
    action: 'focus_window_down',
    description: 'Focus window below inside current column',
    category: 'Scrolling Navigation',
  },
  {
    id: 'focus-up',
    keys: 'Super + K / Up',
    niriOriginal: 'Mod+K / Up',
    action: 'focus_window_up',
    description: 'Focus window above inside current column',
    category: 'Scrolling Navigation',
  },
  {
    id: 'move-left',
    keys: 'Super + Shift + H / Left',
    niriOriginal: 'Mod+Shift+H / Left',
    action: 'move_column_left',
    description: 'Swap focused column leftward in strip',
    category: 'Column & Stack',
  },
  {
    id: 'move-right',
    keys: 'Super + Shift + L / Right',
    niriOriginal: 'Mod+Shift+L / Right',
    action: 'move_column_right',
    description: 'Swap focused column rightward in strip',
    category: 'Column & Stack',
  },
  {
    id: 'consume',
    keys: 'Super + Comma',
    niriOriginal: 'Mod+Comma',
    action: 'consume_window_into_column',
    description: 'Pull adjacent window into current column stack',
    category: 'Column & Stack',
  },
  {
    id: 'expel',
    keys: 'Super + Period',
    niriOriginal: 'Mod+Period',
    action: 'expel_window_from_column',
    description: 'Eject focused window into its own column',
    category: 'Column & Stack',
  },
  {
    id: 'preset-width',
    keys: 'Super + R',
    niriOriginal: 'Mod+R',
    action: 'switch_preset_column_width',
    description: 'Cycle column width preset (1/3, 1/2, 2/3)',
    category: 'Sizing',
  },
  {
    id: 'maximize-col',
    keys: 'Super + F',
    niriOriginal: 'Mod+F',
    action: 'maximize_column',
    description: 'Maximize column across visible strip width',
    category: 'Sizing',
  },
  {
    id: 'fullscreen',
    keys: 'Super + Shift + F',
    niriOriginal: 'Mod+Shift+F',
    action: 'fullscreen_window',
    description: 'Toggle true fullscreen on focused window',
    category: 'Sizing',
  },
  {
    id: 'reload',
    keys: 'Super + Shift + R',
    niriOriginal: 'Reload config',
    action: 'reload_config',
    description: 'Hot-reload modular YAML and re-sync GTK/Qt',
    category: 'Session',
  },
  {
    id: 'quit',
    keys: 'Super + Shift + E',
    niriOriginal: 'Mod+Shift+E',
    action: 'quit',
    description: 'Exit BLUFF Wayland session cleanly',
    category: 'Session',
  },
];
