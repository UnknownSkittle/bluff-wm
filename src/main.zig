const std = @import("std");
const build_options = @import("build_options");
const ConfigYaml = @import("config_yaml.zig");
const Compositor = @import("compositor.zig");
const Scrolling = @import("scrolling.zig");
const ThemeSync = @import("theme_sync.zig");
const Portal = @import("portal.zig");
const XWayland = @import("xwayland.zig");

/// Hard architectural ceiling: 40 MiB idle RSS with a full graphical session.
pub const MAX_IDLE_RSS_BYTES: usize = 40 * 1024 * 1024;

/// Static 2 MiB scratch buffer for zero-fragmentation YAML parsing & IPC formatting.
var scratch_buffer: [2 * 1024 * 1024]u8 = undefined;

fn writeStdout(msg: []const u8) !void {
    const stdout_file = if (@hasDecl(std.fs.File, "stdout"))
        std.fs.File.stdout()
    else
        std.io.getStdOut();
    try stdout_file.writeAll(msg);
}

pub fn main() !void {
    var fba = std.heap.FixedBufferAllocator.init(&scratch_buffer);
    const scratch_alloc = fba.allocator();

    // Main compositor allocator backed by page allocator + deterministic arena per frame.
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const alloc = gpa.allocator();

    const args = try std.process.argsAlloc(alloc);
    defer std.process.argsFree(alloc, args);

    var config_path: ?[]const u8 = null;
    var check_only = false;
    var print_rss = false;

    var i: usize = 1;
    while (i < args.len) : (i += 1) {
        if (std.mem.eql(u8, args[i], "--version") or std.mem.eql(u8, args[i], "-v")) {
            var out_buf: [1024]u8 = undefined;
            const msg = try std.fmt.bufPrint(
                &out_buf,
                "BLUFF {s} by {s} (Zig {s})\n" ++
                    "  xwayland:        {}\n" ++
                    "  blur_shader:     {}\n" ++
                    "  rounded_corners: {}\n" ++
                    "  gtk_qt_sync:     {}\n" ++
                    "  portal:          {s}\n",
                .{
                    build_options.version,
                    build_options.author,
                    @import("builtin").zig_version_string,
                    build_options.xwayland,
                    build_options.blur_shader,
                    build_options.rounded_corners,
                    build_options.gtk_qt_sync,
                    @tagName(build_options.portal),
                },
            );
            try writeStdout(msg);
            return;
        } else if (std.mem.eql(u8, args[i], "--check")) {
            check_only = true;
        } else if (std.mem.eql(u8, args[i], "--print-rss")) {
            print_rss = true;
        } else if (std.mem.eql(u8, args[i], "--config") and i + 1 < args.len) {
            i += 1;
            config_path = args[i];
        }
    }

    const resolved_path = config_path orelse try ConfigYaml.resolveDefaultConfigPath(scratch_alloc);
    var cfg = try ConfigYaml.loadModular(alloc, scratch_alloc, resolved_path);
    defer cfg.deinit(alloc);

    if (check_only) {
        var out_buf: [512]u8 = undefined;
        const msg = try std.fmt.bufPrint(&out_buf, "bluff: modular YAML config OK ({d} binds, {d} imports)\n", .{
            cfg.binds.items.len,
            cfg.import_count,
        });
        try writeStdout(msg);
        return;
    }

    // Opt-in GTK3/GTK4 & Qt5/Qt6 synchronization before spawning default session apps.
    if (comptime build_options.gtk_qt_sync) {
        if (cfg.sync.enabled) {
            try ThemeSync.syncAll(scratch_alloc, cfg.appearance, cfg.sync);
        }
    }

    // Initialize core Wayland display, DRM/KMS + GBM/GLES2 output, and scrolling strip.
    var server = try Compositor.Server.init(alloc, &cfg);
    defer server.deinit();

    // Opt-in lightweight portal environment propagation (no heavy GNOME/KDE daemons).
    try Portal.setupEnvironment(scratch_alloc, server.socket_name, cfg.portal);

    // Opt-in XWayland (lazy initialization only when both built in and enabled in YAML).
    if (comptime build_options.xwayland) {
        if (cfg.xwayland_enabled) {
            try XWayland.prepareLazySocket(server.wl_display);
        }
    }

    // Execute autostart apps (e.g., optional lightweight bar or background daemon).
    try server.spawnAutostart();

    if (print_rss) {
        const rss = readSelfVmRssBytes() catch 0;
        std.log.info("BLUFF idle VmRSS: {d:.2} MiB (limit: 40.00 MiB)", .{
            @as(f64, @floatFromInt(rss)) / (1024.0 * 1024.0),
        });
    }

    // Enter Wayland event loop; SIGUSR1 triggers zero-restart modular YAML reload.
    try server.run();
}

pub fn readSelfVmRssBytes() !usize {
    const file = try std.fs.openFileAbsolute("/proc/self/status", .{});
    defer file.close();
    var buf: [4096]u8 = undefined;
    const n = try file.readAll(&buf);
    var lines = std.mem.splitScalar(u8, buf[0..n], '\n');
    while (lines.next()) |line| {
        if (std.mem.startsWith(u8, line, "VmRSS:")) {
            const trimmed = std.mem.trim(u8, line["VmRSS:".len..], " \t");
            var parts = std.mem.splitScalar(u8, trimmed, ' ');
            if (parts.next()) |kb_str| {
                const kb = try std.fmt.parseInt(usize, kb_str, 10);
                return kb * 1024;
            }
        }
    }
    return 0;
}

test {
    _ = Scrolling;
    _ = ConfigYaml;
    _ = ThemeSync;
}
