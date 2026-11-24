const std = @import("std");
const Compositor = @import("compositor.zig");
const Scrolling = @import("scrolling.zig");
const Portal = @import("portal.zig");

pub const AppearanceConfig = struct {
    corner_radius: u16 = 8,
    outline_width: u16 = 1,
    active_outline: []const u8 = "#FAFAFA",
    inactive_outline: []const u8 = "#27272A",
    outer_padding: u16 = 14,
    column_gap: u16 = 12,
    opacity: f32 = 0.96,
    blur_enabled: bool = true,
    blur_radius: u16 = 10,
    blur_passes: u8 = 2,
};

pub const LayoutConfig = struct {
    default_column_width: f32 = 0.5,
    center_focused_column: Scrolling.CenterMode = .on_overflow,
};

pub const AppsConfig = struct {
    terminal: []const u8 = "alacritty",
    file_manager: []const u8 = "thunar",
    launcher: []const u8 = "rofi -show drun",
    autostart: std.ArrayListUnmanaged([]const u8) = .{},
};

pub const SyncConfig = struct {
    enabled: bool = true,
    gtk3: bool = true,
    gtk4: bool = true,
    qt5: bool = true,
    qt6: bool = true,
    font_family: []const u8 = "JetBrains Mono",
    font_size: u8 = 10,
    monochrome_theme: []const u8 = "bluff-mono-dark",
};

pub const Keybind = struct {
    modifiers: u32,
    keysym: u32,
    action: Compositor.Action,
};

pub const Config = struct {
    root_path: []const u8,
    import_count: usize = 0,
    xwayland_enabled: bool = false,
    portal: Portal.Backend = .lwp_minimal,
    appearance: AppearanceConfig = .{},
    layout: LayoutConfig = .{},
    apps: AppsConfig = .{},
    sync: SyncConfig = .{},
    binds: std.ArrayListUnmanaged(Keybind) = .{},

    pub fn deinit(self: *Config, alloc: std.mem.Allocator) void {
        alloc.free(self.root_path);
        self.apps.autostart.deinit(alloc);
        self.binds.deinit(alloc);
    }
};

pub fn resolveDefaultConfigPath(scratch: std.mem.Allocator) ![]const u8 {
    if (std.posix.getenv("XDG_CONFIG_HOME")) |xdg| {
        return std.fmt.allocPrint(scratch, "{s}/bluff/bluff.yaml", .{xdg});
    }
    if (std.posix.getenv("HOME")) |home| {
        return std.fmt.allocPrint(scratch, "{s}/.config/bluff/bluff.yaml", .{home});
    }
    return "/etc/bluff/bluff.yaml";
}

/// Streaming zero-bloat modular YAML loader supporting `imports:` across split files.
/// Avoids libyaml dependency to keep idle binary + heap footprint minimal.
pub fn loadModular(alloc: std.mem.Allocator, scratch: std.mem.Allocator, root_path: []const u8) !Config {
    var cfg = Config{ .root_path = try alloc.dupe(u8, root_path) };
    errdefer cfg.deinit(alloc);

    const root_dir = std.fs.path.dirname(root_path) orelse ".";
    const content = std.fs.cwd().readFileAlloc(scratch, root_path, 256 * 1024) catch |err| switch (err) {
        error.FileNotFound => {
            try appendDefaultNiriBinds(alloc, &cfg);
            return cfg;
        },
        else => return err,
    };

    try parseYamlModule(alloc, scratch, &cfg, root_dir, content);
    if (cfg.binds.items.len == 0) {
        try appendDefaultNiriBinds(alloc, &cfg);
    }
    return cfg;
}

fn parseYamlModule(
    alloc: std.mem.Allocator,
    scratch: std.mem.Allocator,
    cfg: *Config,
    base_dir: []const u8,
    source: []const u8,
) !void {
    var section: []const u8 = "";
    var lines = std.mem.splitScalar(u8, source, '\n');

    while (lines.next()) |raw_line| {
        const no_comment = if (std.mem.indexOfScalar(u8, raw_line, '#')) |idx| raw_line[0..idx] else raw_line;
        const trimmed = std.mem.trim(u8, no_comment, " \t\r");
        if (trimmed.len == 0) continue;

        // Top-level YAML section header (zero indentation, ends with ':')
        if (raw_line.len > 0 and raw_line[0] != ' ' and raw_line[0] != '-' and trimmed[trimmed.len - 1] == ':') {
            section = trimmed[0 .. trimmed.len - 1];
            continue;
        }

        // Handle modular `imports:` entries (e.g. `- binds.yaml`)
        if (std.mem.eql(u8, section, "imports") and std.mem.startsWith(u8, trimmed, "- ")) {
            const rel = std.mem.trim(u8, trimmed[2..], " \"'");
            const mod_path = try std.fs.path.join(scratch, &.{ base_dir, rel });
            if (std.fs.cwd().readFileAlloc(scratch, mod_path, 256 * 1024)) |mod_src| {
                cfg.import_count += 1;
                try parseYamlModule(alloc, scratch, cfg, base_dir, mod_src);
            } else |_| {}
            continue;
        }

        if (std.mem.indexOfScalar(u8, trimmed, ':')) |colon_idx| {
            const key = std.mem.trim(u8, trimmed[0..colon_idx], " \"'-");
            const val = std.mem.trim(u8, trimmed[colon_idx + 1 ..], " \"'");

            if (std.mem.eql(u8, section, "appearance")) {
                if (std.mem.eql(u8, key, "corner_radius")) cfg.appearance.corner_radius = std.fmt.parseInt(u16, val, 10) catch cfg.appearance.corner_radius;
                if (std.mem.eql(u8, key, "outline_width")) cfg.appearance.outline_width = std.fmt.parseInt(u16, val, 10) catch cfg.appearance.outline_width;
                if (std.mem.eql(u8, key, "outer_padding")) cfg.appearance.outer_padding = std.fmt.parseInt(u16, val, 10) catch cfg.appearance.outer_padding;
                if (std.mem.eql(u8, key, "column_gap")) cfg.appearance.column_gap = std.fmt.parseInt(u16, val, 10) catch cfg.appearance.column_gap;
                if (std.mem.eql(u8, key, "opacity")) cfg.appearance.opacity = std.fmt.parseFloat(f32, val) catch cfg.appearance.opacity;
                if (std.mem.eql(u8, key, "blur_enabled")) cfg.appearance.blur_enabled = std.mem.eql(u8, val, "true");
                if (std.mem.eql(u8, key, "blur_radius")) cfg.appearance.blur_radius = std.fmt.parseInt(u16, val, 10) catch cfg.appearance.blur_radius;
            } else if (std.mem.eql(u8, section, "opt_in")) {
                if (std.mem.eql(u8, key, "xwayland")) cfg.xwayland_enabled = std.mem.eql(u8, val, "true");
                if (std.mem.eql(u8, key, "portal")) {
                    if (std.mem.eql(u8, val, "none")) cfg.portal = .none;
                    if (std.mem.eql(u8, val, "lwp-minimal")) cfg.portal = .lwp_minimal;
                    if (std.mem.eql(u8, val, "xdg-desktop-portal-wlr")) cfg.portal = .xdg_desktop_portal_wlr;
                }
            } else if (std.mem.eql(u8, section, "sync")) {
                if (std.mem.eql(u8, key, "enabled")) cfg.sync.enabled = std.mem.eql(u8, val, "true");
                if (std.mem.eql(u8, key, "gtk3")) cfg.sync.gtk3 = std.mem.eql(u8, val, "true");
                if (std.mem.eql(u8, key, "gtk4")) cfg.sync.gtk4 = std.mem.eql(u8, val, "true");
                if (std.mem.eql(u8, key, "qt5")) cfg.sync.qt5 = std.mem.eql(u8, val, "true");
                if (std.mem.eql(u8, key, "qt6")) cfg.sync.qt6 = std.mem.eql(u8, val, "true");
            }
        }
    }
}

fn appendDefaultNiriBinds(alloc: std.mem.Allocator, cfg: *Config) !void {
    const MOD_SUPER: u32 = 1 << 6;
    const MOD_SHIFT: u32 = 1 << 0;
    try cfg.binds.appendSlice(alloc, &.{
        .{ .modifiers = MOD_SUPER, .keysym = 0x0020, .action = .{ .spawn = "rofi -show drun" } },
        .{ .modifiers = MOD_SUPER, .keysym = 0xff0d, .action = .{ .spawn = "alacritty" } },
        .{ .modifiers = MOD_SUPER, .keysym = 'e', .action = .{ .spawn = "thunar" } },
        .{ .modifiers = MOD_SUPER, .keysym = 'q', .action = .close_window },
        .{ .modifiers = MOD_SUPER, .keysym = 'h', .action = .focus_column_left },
        .{ .modifiers = MOD_SUPER, .keysym = 'l', .action = .focus_column_right },
        .{ .modifiers = MOD_SUPER, .keysym = 'j', .action = .focus_window_down },
        .{ .modifiers = MOD_SUPER, .keysym = 'k', .action = .focus_window_up },
        .{ .modifiers = MOD_SUPER | MOD_SHIFT, .keysym = 'h', .action = .move_column_left },
        .{ .modifiers = MOD_SUPER | MOD_SHIFT, .keysym = 'l', .action = .move_column_right },
        .{ .modifiers = MOD_SUPER, .keysym = 'r', .action = .switch_preset_column_width },
        .{ .modifiers = MOD_SUPER, .keysym = 'f', .action = .maximize_column },
        .{ .modifiers = MOD_SUPER | MOD_SHIFT, .keysym = 'f', .action = .fullscreen_window },
        .{ .modifiers = MOD_SUPER | MOD_SHIFT, .keysym = 'e', .action = .quit },
    });
}

test "parse modular appearance yaml" {
    var cfg = Config{ .root_path = "bluff.yaml" };
    defer cfg.deinit(std.testing.allocator);

    const sample =
        \\appearance:
        \\  corner_radius: 12
        \\  outline_width: 2
        \\  opacity: 0.90
        \\  blur_enabled: true
        \\  blur_radius: 14
    ;
    try parseYamlModule(std.testing.allocator, std.testing.allocator, &cfg, ".", sample);
    try std.testing.expectEqual(@as(u16, 12), cfg.appearance.corner_radius);
    try std.testing.expectEqual(@as(u16, 2), cfg.appearance.outline_width);
    try std.testing.expectEqual(@as(u16, 14), cfg.appearance.blur_radius);
}
