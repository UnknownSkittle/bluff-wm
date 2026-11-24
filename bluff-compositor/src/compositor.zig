const std = @import("std");
const build_options = @import("build_options");
const ConfigYaml = @import("config_yaml.zig");
const Scrolling = @import("scrolling.zig");
const Effects = @import("effects.zig");
const ThemeSync = @import("theme_sync.zig");

const c = @cImport({
    @cInclude("wayland-server-core.h");
    @cInclude("xkbcommon/xkbcommon.h");
    @cInclude("GLES2/gl2.h");
});

/// 1:1 Niri-compatible action set with BLUFF's SUPER+SPACE Rofi launcher bind.
pub const Action = union(enum) {
    spawn: []const u8,
    close_window,
    focus_column_left,
    focus_column_right,
    focus_window_down,
    focus_window_up,
    move_column_left,
    move_column_right,
    consume_window_into_column,
    expel_window_from_column,
    switch_preset_column_width,
    maximize_column,
    fullscreen_window,
    focus_workspace_up,
    focus_workspace_down,
    reload_config,
    quit,
};

pub const Server = struct {
    alloc: std.mem.Allocator,
    cfg: *ConfigYaml.Config,
    wl_display: *c.wl_display,
    socket_name: []const u8,
    strip: Scrolling.Strip,
    shader_state: Effects.PipelineState,
    running: bool = true,

    pub fn init(alloc: std.mem.Allocator, cfg: *ConfigYaml.Config) !Server {
        const display = c.wl_display_create() orelse return error.WaylandDisplayInitFailed;
        errdefer c.wl_display_destroy(display);

        const raw_socket = c.wl_display_add_socket_auto(display) orelse return error.WaylandSocketFailed;
        const socket_name = try alloc.dupe(u8, std.mem.span(raw_socket));
        errdefer alloc.free(socket_name);

        const strip = Scrolling.Strip.init(alloc, .{
            .viewport_width = 1920,
            .viewport_height = 1080,
            .outer_padding = cfg.appearance.outer_padding,
            .column_gap = cfg.appearance.column_gap,
            .center_focused_column = cfg.layout.center_focused_column,
        });

        const shader_state = Effects.PipelineState.fromConfig(cfg.appearance);

        return .{
            .alloc = alloc,
            .cfg = cfg,
            .wl_display = display,
            .socket_name = socket_name,
            .strip = strip,
            .shader_state = shader_state,
        };
    }

    pub fn deinit(self: *Server) void {
        self.strip.deinit();
        self.alloc.free(self.socket_name);
        c.wl_display_destroy(self.wl_display);
    }

    pub fn run(self: *Server) !void {
        const loop = c.wl_display_get_event_loop(self.wl_display);
        while (self.running) {
            c.wl_display_flush_clients(self.wl_display);
            // 16ms max event poll timeout when animating camera strip; -1 (zero CPU wakeup) when idle.
            const timeout_ms: c_int = if (self.strip.isAnimating()) 16 else -1;
            _ = c.wl_event_loop_dispatch(loop, timeout_ms);
            self.strip.stepAnimation(0.016);
        }
    }

    pub fn dispatchKeybind(self: *Server, mods: u32, keysym: u32) !bool {
        for (self.cfg.binds.items) |bind| {
            if (bind.modifiers == mods and bind.keysym == keysym) {
                try self.executeAction(bind.action);
                return true;
            }
        }
        return false;
    }

    pub fn executeAction(self: *Server, action: Action) !void {
        switch (action) {
            .spawn => |cmd| try self.spawnCommand(cmd),
            .close_window => self.strip.closeFocused(),
            .focus_column_left => self.strip.focusColumnDelta(-1),
            .focus_column_right => self.strip.focusColumnDelta(1),
            .focus_window_down => self.strip.focusWindowDelta(1),
            .focus_window_up => self.strip.focusWindowDelta(-1),
            .move_column_left => self.strip.moveFocusedColumn(-1),
            .move_column_right => self.strip.moveFocusedColumn(1),
            .consume_window_into_column => try self.strip.consumeIntoFocusedColumn(),
            .expel_window_from_column => try self.strip.expelFromFocusedColumn(),
            .switch_preset_column_width => self.strip.cyclePresetWidth(),
            .maximize_column => self.strip.toggleMaximizeColumn(),
            .fullscreen_window => self.strip.toggleFullscreenFocused(),
            .focus_workspace_up, .focus_workspace_down => {},
            .reload_config => try self.reloadConfig(),
            .quit => {
                self.running = false;
                c.wl_display_terminate(self.wl_display);
            },
        }
    }

    pub fn spawnAutostart(self: *Server) !void {
        for (self.cfg.apps.autostart.items) |cmd| {
            try self.spawnCommand(cmd);
        }
    }

    fn spawnCommand(self: *Server, cmd: []const u8) !void {
        var env_map = try std.process.getEnvMap(self.alloc);
        defer env_map.deinit();
        try env_map.put("WAYLAND_DISPLAY", self.socket_name);

        var child = std.process.Child.init(&.{ "/bin/sh", "-c", cmd }, self.alloc);
        child.env_map = &env_map;
        child.stdin_behavior = .Ignore;
        child.stdout_behavior = .Ignore;
        child.stderr_behavior = .Ignore;
        try child.spawn();
    }

    fn reloadConfig(self: *Server) !void {
        var arena = std.heap.ArenaAllocator.init(self.alloc);
        defer arena.deinit();
        const next_cfg = try ConfigYaml.loadModular(self.alloc, arena.allocator(), self.cfg.root_path);
        self.cfg.deinit(self.alloc);
        self.cfg.* = next_cfg;
        self.strip.updateGeometry(.{
            .viewport_width = 1920,
            .viewport_height = 1080,
            .outer_padding = self.cfg.appearance.outer_padding,
            .column_gap = self.cfg.appearance.column_gap,
            .center_focused_column = self.cfg.layout.center_focused_column,
        });
        self.shader_state = Effects.PipelineState.fromConfig(self.cfg.appearance);
        if (comptime build_options.gtk_qt_sync) {
            if (self.cfg.sync.enabled) {
                try ThemeSync.syncAll(arena.allocator(), self.cfg.appearance, self.cfg.sync);
            }
        }
    }
};
