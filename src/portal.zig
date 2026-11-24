const std = @import("std");
const build_options = @import("build_options");

pub const Backend = enum {
    none,
    lwp_minimal,
    xdg_desktop_portal_wlr,
};

/// Lightweight desktop portal activation without pulling in GNOME/KDE portal frameworks.
pub fn setupEnvironment(
    scratch: std.mem.Allocator,
    wayland_display: []const u8,
    backend: Backend,
) !void {
    const active = if (backend == .none) build_options.portal else backend;
    if (active == .none) return;

    const desktop_tag: []const u8 = switch (active) {
        .lwp_minimal => "BLUFF:lwp",
        .xdg_desktop_portal_wlr => "BLUFF:wlroots",
        .none => return,
    };

    const cmd = try std.fmt.allocPrint(
        scratch,
        "dbus-update-activation-environment --systemd WAYLAND_DISPLAY={s} XDG_CURRENT_DESKTOP={s} 2>/dev/null || true",
        .{ wayland_display, desktop_tag },
    );

    var child = std.process.Child.init(&.{ "/bin/sh", "-c", cmd }, scratch);
    child.stdin_behavior = .Ignore;
    child.stdout_behavior = .Ignore;
    child.stderr_behavior = .Ignore;
    _ = child.spawnAndWait() catch {};
}
