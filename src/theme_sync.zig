const std = @import("std");
const ConfigYaml = @import("config_yaml.zig");

/// Synchronizes GTK3, GTK4, Qt5ct, and Qt6ct aesthetics directly with BLUFF's
/// modular YAML appearance & monochrome terminal palette.
pub fn syncAll(
    scratch: std.mem.Allocator,
    appearance: ConfigYaml.AppearanceConfig,
    sync: ConfigYaml.SyncConfig,
) !void {
    const config_home = try resolveXdgConfigHome(scratch);

    if (sync.gtk3) {
        try writeGtk3Settings(scratch, config_home, sync);
    }
    if (sync.gtk4) {
        try writeGtk4Css(scratch, config_home, appearance, sync);
    }
    if (sync.qt5) {
        try writeQtCtConfig(scratch, config_home, "qt5ct", appearance, sync);
    }
    if (sync.qt6) {
        try writeQtCtConfig(scratch, config_home, "qt6ct", appearance, sync);
    }
}

fn resolveXdgConfigHome(scratch: std.mem.Allocator) ![]const u8 {
    if (std.posix.getenv("XDG_CONFIG_HOME")) |dir| return dir;
    if (std.posix.getenv("HOME")) |home| return std.fmt.allocPrint(scratch, "{s}/.config", .{home});
    return "/tmp/bluff-config";
}

fn writeGtk3Settings(
    scratch: std.mem.Allocator,
    config_home: []const u8,
    sync: ConfigYaml.SyncConfig,
) !void {
    const dir = try std.fmt.allocPrint(scratch, "{s}/gtk-3.0", .{config_home});
    try std.fs.cwd().makePath(dir);
    const file_path = try std.fmt.allocPrint(scratch, "{s}/settings.ini", .{dir});

    const body = try std.fmt.allocPrint(
        scratch,
        \\[Settings]
        \\gtk-theme-name={s}
        \\gtk-application-prefer-dark-theme=1
        \\gtk-font-name={s} {d}
        \\gtk-decoration-layout=
        \\gtk-enable-animations=0
        \\
    ,
        .{ sync.monochrome_theme, sync.font_family, sync.font_size },
    );
    try std.fs.cwd().writeFile(.{ .sub_path = file_path, .data = body });
}

fn writeGtk4Css(
    scratch: std.mem.Allocator,
    config_home: []const u8,
    appearance: ConfigYaml.AppearanceConfig,
    sync: ConfigYaml.SyncConfig,
) !void {
    const dir = try std.fmt.allocPrint(scratch, "{s}/gtk-4.0", .{config_home});
    try std.fs.cwd().makePath(dir);
    const file_path = try std.fmt.allocPrint(scratch, "{s}/gtk.css", .{dir});

    const body = try std.fmt.allocPrint(
        scratch,
        \\/* Auto-synced by BLUFF compositor from appearance.yaml & sync.yaml */
        \\window, dialog, popover > contents {{
        \\  background-color: rgba(17, 17, 20, {d:.2});
        \\  color: #f4f4f5;
        \\  border: {d}px solid {s};
        \\  border-radius: {d}px;
        \\  font-family: "{s}", monospace;
        \\}}
        \\button, entry {{
        \\  background-color: #18181b;
        \\  color: #fafafa;
        \\  border: 1px solid #27272a;
        \\  border-radius: {d}px;
        \\}}
        \\
    ,
        .{
            appearance.opacity,
            appearance.outline_width,
            appearance.inactive_outline,
            appearance.corner_radius,
            sync.font_family,
            @min(appearance.corner_radius, 8),
        },
    );
    try std.fs.cwd().writeFile(.{ .sub_path = file_path, .data = body });
}

fn writeQtCtConfig(
    scratch: std.mem.Allocator,
    config_home: []const u8,
    qt_dir: []const u8,
    appearance: ConfigYaml.AppearanceConfig,
    sync: ConfigYaml.SyncConfig,
) !void {
    const dir = try std.fmt.allocPrint(scratch, "{s}/{s}", .{ config_home, qt_dir });
    try std.fs.cwd().makePath(dir);
    const conf_path = try std.fmt.allocPrint(scratch, "{s}/{s}.conf", .{ dir, qt_dir });

    const body = try std.fmt.allocPrint(
        scratch,
        \\[Appearance]
        \\style=Fusion
        \\custom_palette=true
        \\color_scheme_path={s}/{s}/colors/bluff-mono.conf
        \\
        \\[Fonts]
        \\general="{s},{d},-1,5,50,0,0,0,0,0"
        \\fixed="{s},{d},-1,5,50,0,0,0,0,0"
        \\
        \\[Interface]
        \\buttonbox_layout=0
        \\activate_item_on_single_click=1
        \\# Synced corner_radius={d}px outline_width={d}px
        \\
    ,
        .{
            config_home,
            qt_dir,
            sync.font_family,
            sync.font_size,
            sync.font_family,
            sync.font_size,
            appearance.corner_radius,
            appearance.outline_width,
        },
    );
    try std.fs.cwd().writeFile(.{ .sub_path = conf_path, .data = body });
}

test "sync writes gtk4 css matching appearance" {
    var tmp = std.testing.tmpDir(.{});
    defer tmp.cleanup();
    const base = try tmp.dir.realpathAlloc(std.testing.allocator, ".");
    defer std.testing.allocator.free(base);

    try writeGtk4Css(std.testing.allocator, base, .{ .corner_radius = 10, .outline_width = 1 }, .{});
    const out = try tmp.dir.readFileAlloc(std.testing.allocator, "gtk-4.0/gtk.css", 4096);
    defer std.testing.allocator.free(out);
    try std.testing.expect(std.mem.indexOf(u8, out, "border-radius: 10px;") != null);
}
