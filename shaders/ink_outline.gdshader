// The ink contours: one pass over the finished picture that draws a line
// wherever depth or facing changes, at about the same width near and far.
// Drawn on a full-screen quad parented to the camera (see office.gd).
shader_type spatial;
render_mode unshaded, cull_disabled, depth_draw_never, depth_test_disabled, fog_disabled, shadows_disabled;

uniform sampler2D screen_tex : hint_screen_texture, filter_linear_mipmap;
uniform sampler2D depth_tex : hint_depth_texture, filter_nearest;
uniform sampler2D normal_tex : hint_normal_roughness_texture, filter_nearest;
uniform vec4 ink : source_color = vec4(0.16, 0.157, 0.14, 1.0);
uniform float width = 1.2;           // pixels
uniform float depth_edge = 0.06;     // relative depth jump that counts as an edge
uniform float normal_edge = 0.55;    // facing change that counts as an edge
uniform float strength = 0.85;
uniform float far_fade = 22.0;       // metres: lines fade out beyond this (the street)

void vertex() {
	POSITION = vec4(VERTEX.xy * 2.0, 1.0, 1.0);
}

float linear_depth(vec2 uv, mat4 inv_proj) {
	float d = texture(depth_tex, uv).r;
	vec4 v = inv_proj * vec4(uv * 2.0 - 1.0, d, 1.0);
	return -v.z / v.w;
}

vec3 normal_at(vec2 uv) {
	return texture(normal_tex, uv).xyz * 2.0 - 1.0;
}

void fragment() {
	vec2 px = width / VIEWPORT_SIZE;
	vec2 uv = SCREEN_UV;
	float d0 = linear_depth(uv, INV_PROJECTION_MATRIX);
	vec3 n0 = normal_at(uv);
	float edge = 0.0;
	vec2 offs[4] = { vec2(px.x, 0.0), vec2(-px.x, 0.0), vec2(0.0, px.y), vec2(0.0, -px.y) };
	for (int i = 0; i < 4; i++) {
		float d = linear_depth(uv + offs[i], INV_PROJECTION_MATRIX);
		// Only the nearer side of an edge draws, so lines stay one stroke wide.
		if ((d - d0) / d0 > depth_edge) edge = 1.0;
		if (dot(n0, normal_at(uv + offs[i])) < 1.0 - normal_edge && d >= d0 * 0.999) edge = max(edge, 0.8);
	}
	edge *= strength * (1.0 - smoothstep(far_fade * 0.6, far_fade, d0));
	vec3 col = texture(screen_tex, uv).rgb;
	ALBEDO = mix(col, ink.rgb, edge);
}
