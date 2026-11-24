const std = @import("std");
const build_options = @import("build_options");
const ConfigYaml = @import("config_yaml.zig");

pub const PipelineState = struct {
    corner_radius: f32,
    outline_width: f32,
    opacity: f32,
    blur_enabled: bool,
    blur_radius: f32,
    blur_passes: u8,

    pub fn fromConfig(app: ConfigYaml.AppearanceConfig) PipelineState {
        return .{
            .corner_radius = if (comptime build_options.rounded_corners) @floatFromInt(app.corner_radius) else 0.0,
            .outline_width = @floatFromInt(app.outline_width),
            .opacity = app.opacity,
            .blur_enabled = (comptime build_options.blur_shader) and app.blur_enabled,
            .blur_radius = if (comptime build_options.blur_shader) @floatFromInt(app.blur_radius) else 0.0,
            .blur_passes = app.blur_passes,
        };
    }
};

/// GLES2 SDF rounded-corner + outline + per-surface opacity fragment shader.
/// Stripped completely from binary when `-Drounded-corners=false`.
pub const surface_fragment_shader: []const u8 = if (build_options.rounded_corners)
    \\precision mediump float;
    \\varying vec2 v_texcoord;
    \\uniform sampler2D u_tex;
    \\uniform vec2 u_size;
    \\uniform float u_radius;
    \\uniform float u_outline_w;
    \\uniform vec4 u_outline_color;
    \\uniform float u_opacity;
    \\
    \\float roundedBoxSDF(vec2 center_pos, vec2 half_size, float radius) {
    \\    return length(max(abs(center_pos) - half_size + radius, 0.0)) - radius;
    \\}
    \\
    \\void main() {
    \\    vec2 px = v_texcoord * u_size;
    \\    vec2 half_size = u_size * 0.5;
    \\    float d = roundedBoxSDF(px - half_size, half_size, u_radius);
    \\    float alpha = 1.0 - smoothstep(-0.75, 0.75, d);
    \\    vec4 texel = texture2D(u_tex, v_texcoord);
    \\    float border_mask = smoothstep(-u_outline_w - 0.75, -u_outline_w + 0.75, d);
    \\    vec3 rgb = mix(texel.rgb, u_outline_color.rgb, border_mask * step(0.1, u_outline_w));
    \\    gl_FragColor = vec4(rgb, texel.a * u_opacity * alpha);
    \\}
else
    \\precision mediump float;
    \\varying vec2 v_texcoord;
    \\uniform sampler2D u_tex;
    \\uniform float u_opacity;
    \\void main() {
    \\    vec4 texel = texture2D(u_tex, v_texcoord);
    \\    gl_FragColor = vec4(texel.rgb, texel.a * u_opacity);
    \\}
;

/// Dual-pass Kawase blur GLES2 fragment shader.
/// Stripped completely when `-Dblur-shader=false`.
pub const kawase_downsample_shader: []const u8 = if (build_options.blur_shader)
    \\precision mediump float;
    \\varying vec2 v_texcoord;
    \\uniform sampler2D u_tex;
    \\uniform vec2 u_halfpixel;
    \\uniform float u_offset;
    \\void main() {
    \\    vec4 sum = texture2D(u_tex, v_texcoord) * 4.0;
    \\    sum += texture2D(u_tex, v_texcoord - u_halfpixel * u_offset);
    \\    sum += texture2D(u_tex, v_texcoord + u_halfpixel * u_offset);
    \\    sum += texture2D(u_tex, v_texcoord + vec2(u_halfpixel.x, -u_halfpixel.y) * u_offset);
    \\    sum += texture2D(u_tex, v_texcoord - vec2(u_halfpixel.x, -u_halfpixel.y) * u_offset);
    \\    gl_FragColor = sum / 8.0;
    \\}
else
    "";
