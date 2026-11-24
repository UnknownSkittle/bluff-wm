const std = @import("std");

pub const CenterMode = enum {
    never,
    always,
    on_overflow,
};

pub const StripGeometry = struct {
    viewport_width: u32,
    viewport_height: u32,
    outer_padding: u16,
    column_gap: u16,
    center_focused_column: CenterMode,
};

pub const WindowNode = struct {
    id: u64,
    app_id: []const u8,
    title: []const u8,
    height_weight: f32 = 1.0,
    fullscreen: bool = false,
};

pub const Column = struct {
    width_fraction: f32 = 0.5,
    maximized: bool = false,
    windows: std.ArrayListUnmanaged(WindowNode) = .{},
};

pub const Rect = struct {
    x: i32,
    y: i32,
    w: u32,
    h: u32,
};

/// Infinite horizontal scrolling strip engine modeled 1:1 after Niri's layout ergonomics.
pub const Strip = struct {
    alloc: std.mem.Allocator,
    geom: StripGeometry,
    columns: std.ArrayListUnmanaged(Column) = .{},
    focused_col: usize = 0,
    focused_win: usize = 0,
    current_scroll_x: f32 = 0.0,
    target_scroll_x: f32 = 0.0,
    next_id: u64 = 1,

    const presets = [_]f32{ 0.3333, 0.5, 0.6667 };

    pub fn init(alloc: std.mem.Allocator, geom: StripGeometry) Strip {
        return .{ .alloc = alloc, .geom = geom };
    }

    pub fn deinit(self: *Strip) void {
        for (self.columns.items) |*col| {
            col.windows.deinit(self.alloc);
        }
        self.columns.deinit(self.alloc);
    }

    pub fn updateGeometry(self: *Strip, geom: StripGeometry) void {
        self.geom = geom;
        self.recomputeTargetScroll();
    }

    pub fn addWindowNewColumn(self: *Strip, app_id: []const u8, title: []const u8, width_fraction: f32) !u64 {
        const id = self.next_id;
        self.next_id += 1;

        var col = Column{ .width_fraction = width_fraction };
        try col.windows.append(self.alloc, .{
            .id = id,
            .app_id = app_id,
            .title = title,
        });

        const insert_idx = if (self.columns.items.len == 0) 0 else @min(self.focused_col + 1, self.columns.items.len);
        try self.columns.insert(self.alloc, insert_idx, col);
        self.focused_col = insert_idx;
        self.focused_win = 0;
        self.recomputeTargetScroll();
        return id;
    }

    pub fn closeFocused(self: *Strip) void {
        if (self.columns.items.len == 0) return;
        var col = &self.columns.items[self.focused_col];
        if (col.windows.items.len == 0) return;

        _ = col.windows.orderedRemove(self.focused_win);
        if (col.windows.items.len == 0) {
            col.windows.deinit(self.alloc);
            _ = self.columns.orderedRemove(self.focused_col);
            if (self.focused_col >= self.columns.items.len and self.columns.items.len > 0) {
                self.focused_col = self.columns.items.len - 1;
            }
            self.focused_win = 0;
        } else if (self.focused_win >= col.windows.items.len) {
            self.focused_win = col.windows.items.len - 1;
        }
        self.recomputeTargetScroll();
    }

    pub fn focusColumnDelta(self: *Strip, delta: isize) void {
        if (self.columns.items.len == 0) return;
        const max_idx: isize = @intCast(self.columns.items.len - 1);
        const cur: isize = @intCast(self.focused_col);
        const next: usize = @intCast(std.math.clamp(cur + delta, 0, max_idx));
        if (next != self.focused_col) {
            self.focused_col = next;
            const win_len = self.columns.items[next].windows.items.len;
            self.focused_win = if (win_len == 0) 0 else @min(self.focused_win, win_len - 1);
            self.recomputeTargetScroll();
        }
    }

    pub fn focusWindowDelta(self: *Strip, delta: isize) void {
        if (self.columns.items.len == 0) return;
        const col = &self.columns.items[self.focused_col];
        if (col.windows.items.len == 0) return;
        const max_idx: isize = @intCast(col.windows.items.len - 1);
        const cur: isize = @intCast(self.focused_win);
        self.focused_win = @intCast(std.math.clamp(cur + delta, 0, max_idx));
    }

    pub fn moveFocusedColumn(self: *Strip, delta: isize) void {
        if (self.columns.items.len < 2) return;
        const max_idx: isize = @intCast(self.columns.items.len - 1);
        const cur: isize = @intCast(self.focused_col);
        const target: usize = @intCast(std.math.clamp(cur + delta, 0, max_idx));
        if (target == self.focused_col) return;
        std.mem.swap(Column, &self.columns.items[self.focused_col], &self.columns.items[target]);
        self.focused_col = target;
        self.recomputeTargetScroll();
    }

    pub fn consumeIntoFocusedColumn(self: *Strip) !void {
        if (self.focused_col + 1 >= self.columns.items.len) return;
        var next_col = &self.columns.items[self.focused_col + 1];
        if (next_col.windows.items.len == 0) return;
        const win = next_col.windows.orderedRemove(0);
        try self.columns.items[self.focused_col].windows.append(self.alloc, win);
        if (next_col.windows.items.len == 0) {
            next_col.windows.deinit(self.alloc);
            _ = self.columns.orderedRemove(self.focused_col + 1);
        }
        self.recomputeTargetScroll();
    }

    pub fn expelFromFocusedColumn(self: *Strip) !void {
        if (self.columns.items.len == 0) return;
        var col = &self.columns.items[self.focused_col];
        if (col.windows.items.len <= 1) return;
        const win = col.windows.orderedRemove(self.focused_win);
        var new_col = Column{ .width_fraction = col.width_fraction };
        try new_col.windows.append(self.alloc, win);
        try self.columns.insert(self.alloc, self.focused_col + 1, new_col);
        self.focused_col += 1;
        self.focused_win = 0;
        self.recomputeTargetScroll();
    }

    pub fn cyclePresetWidth(self: *Strip) void {
        if (self.columns.items.len == 0) return;
        var col = &self.columns.items[self.focused_col];
        col.maximized = false;
        for (presets, 0..) |p, idx| {
            if (@abs(col.width_fraction - p) < 0.05) {
                col.width_fraction = presets[(idx + 1) % presets.len];
                self.recomputeTargetScroll();
                return;
            }
        }
        col.width_fraction = presets[0];
        self.recomputeTargetScroll();
    }

    pub fn toggleMaximizeColumn(self: *Strip) void {
        if (self.columns.items.len == 0) return;
        var col = &self.columns.items[self.focused_col];
        col.maximized = !col.maximized;
        self.recomputeTargetScroll();
    }

    pub fn toggleFullscreenFocused(self: *Strip) void {
        if (self.columns.items.len == 0) return;
        var col = &self.columns.items[self.focused_col];
        if (col.windows.items.len == 0) return;
        col.windows.items[self.focused_win].fullscreen = !col.windows.items[self.focused_win].fullscreen;
    }

    pub fn isAnimating(self: *const Strip) bool {
        return @abs(self.target_scroll_x - self.current_scroll_x) > 0.5;
    }

    pub fn stepAnimation(self: *Strip, dt: f32) void {
        const diff = self.target_scroll_x - self.current_scroll_x;
        if (@abs(diff) <= 0.5) {
            self.current_scroll_x = self.target_scroll_x;
            return;
        }
        const factor = 1.0 - @exp(-18.0 * dt);
        self.current_scroll_x += diff * factor;
    }

    pub fn columnWidthPx(self: *const Strip, col: Column) u32 {
        const usable: f32 = @floatFromInt(self.geom.viewport_width -| (@as(u32, self.geom.outer_padding) * 2));
        if (col.maximized) return @intFromFloat(@max(120.0, usable));
        return @intFromFloat(@max(120.0, usable * col.width_fraction));
    }

    pub fn recomputeTargetScroll(self: *Strip) void {
        if (self.columns.items.len == 0) {
            self.target_scroll_x = 0;
            return;
        }
        const pad: f32 = @floatFromInt(self.geom.outer_padding);
        const gap: f32 = @floatFromInt(self.geom.column_gap);
        const view_w: f32 = @floatFromInt(self.geom.viewport_width);

        var col_x: f32 = pad;
        for (self.columns.items[0..self.focused_col]) |col| {
            col_x += @as(f32, @floatFromInt(self.columnWidthPx(col))) + gap;
        }
        const focused_w: f32 = @floatFromInt(self.columnWidthPx(self.columns.items[self.focused_col]));

        switch (self.geom.center_focused_column) {
            .always => {
                self.target_scroll_x = @max(0.0, col_x + (focused_w * 0.5) - (view_w * 0.5));
            },
            .never, .on_overflow => {
                const left_bound = self.target_scroll_x + pad;
                const right_bound = self.target_scroll_x + view_w - pad;
                if (col_x < left_bound) {
                    self.target_scroll_x = @max(0.0, col_x - pad);
                } else if (col_x + focused_w > right_bound) {
                    self.target_scroll_x = @max(0.0, (col_x + focused_w + pad) - view_w);
                }
            },
        }
    }
};

test "scrolling strip column navigation and preset widths" {
    var strip = Strip.init(std.testing.allocator, .{
        .viewport_width = 1920,
        .viewport_height = 1080,
        .outer_padding = 16,
        .column_gap = 12,
        .center_focused_column = .on_overflow,
    });
    defer strip.deinit();

    _ = try strip.addWindowNewColumn("Alacritty", "alacritty", 0.5);
    _ = try strip.addWindowNewColumn("Thunar", "thunar", 0.5);
    try std.testing.expectEqual(@as(usize, 2), strip.columns.items.len);
    try std.testing.expectEqual(@as(usize, 1), strip.focused_col);

    strip.focusColumnDelta(-1);
    try std.testing.expectEqual(@as(usize, 0), strip.focused_col);

    strip.cyclePresetWidth();
    try std.testing.expect(@abs(strip.columns.items[0].width_fraction - 0.6667) < 0.01);
}
