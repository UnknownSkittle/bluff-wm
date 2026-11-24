const std = @import("std");

pub const PortalBackend = enum {
    none,
    lwp_minimal,
    xdg_desktop_portal_wlr,
};

pub fn build(b: *std.Build) void {
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    // Opt-in feature flags: keep idle RSS <= 40 MiB by stripping unused subsystems at comptime.
    const enable_xwayland = b.option(bool, "xwayland", "Enable opt-in rootless XWayland bridge (+14.2 MiB when active)") orelse false;
    const enable_blur_shader = b.option(bool, "blur-shader", "Compile dual-pass Kawase GLES2 blur shader (+2.1 MiB)") orelse true;
    const enable_rounded_corners = b.option(bool, "rounded-corners", "Compile SDF anti-aliased rounded corner shader (+0.6 MiB)") orelse true;
    const enable_theme_sync = b.option(bool, "gtk-qt-sync", "Enable GTK3/4 and Qt5/6 config synchronization (+0.4 MiB)") orelse true;
    const portal_backend = b.option(PortalBackend, "portal", "Lightweight desktop portal target") orelse .lwp_minimal;

    const options = b.addOptions();
    options.addOption(bool, "xwayland", enable_xwayland);
    options.addOption(bool, "blur_shader", enable_blur_shader);
    options.addOption(bool, "rounded_corners", enable_rounded_corners);
    options.addOption(bool, "gtk_qt_sync", enable_theme_sync);
    options.addOption(PortalBackend, "portal", portal_backend);
    options.addOption([]const u8, "version", "0.1.0");
    options.addOption([]const u8, "author", "Unknown_Skittle");

    const exe_mod = b.createModule(.{
        .root_source_file = b.path("src/main.zig"),
        .target = target,
        .optimize = optimize,
        .strip = optimize != .Debug,
        .link_libc = true,
    });
    exe_mod.addOptions("build_options", options);

    // Pure Zig application linking directly against system Wayland & DRM/GLES2 ABI.
    // Zero C source files compiled in BLUFF.
    exe_mod.linkSystemLibrary("wayland-server", .{});
    exe_mod.linkSystemLibrary("drm", .{});
    exe_mod.linkSystemLibrary("gbm", .{});
    exe_mod.linkSystemLibrary("EGL", .{});
    exe_mod.linkSystemLibrary("GLESv2", .{});
    exe_mod.linkSystemLibrary("input", .{});
    exe_mod.linkSystemLibrary("udev", .{});
    exe_mod.linkSystemLibrary("xkbcommon", .{});

    const exe = b.addExecutable(.{
        .name = "bluff",
        .root_module = exe_mod,
    });

    b.installArtifact(exe);

    // Install modular default YAML configs to share/bluff/config
    b.installDirectory(.{
        .source_dir = b.path("config"),
        .install_dir = .prefix,
        .install_subdir = "share/bluff/config",
    });

    const run_cmd = b.addRunArtifact(exe);
    run_cmd.step.dependOn(b.getInstallStep());
    if (b.args) |args| {
        run_cmd.addArgs(args);
    }

    const run_step = b.step("run", "Run BLUFF compositor");
    run_step.dependOn(&run_cmd.step);

    const test_mod = b.createModule(.{
        .root_source_file = b.path("src/main.zig"),
        .target = target,
        .optimize = optimize,
    });
    test_mod.addOptions("build_options", options);

    const unit_tests = b.addTest(.{
        .root_module = test_mod,
    });

    const test_step = b.step("test", "Run BLUFF unit tests (scrolling layout, modular YAML, memory budget)");
    test_step.dependOn(&b.addRunArtifact(unit_tests).step);
}
