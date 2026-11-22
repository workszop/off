## A character as their zine sprite printed on a cardboard cut-out standing
## in the room. The artwork is shown unlit and unchanged; only the card moves.
##
## - The card turns about its vertical axis to face the camera.
## - Which drawing is shown depends on the character's heading relative to
##   the camera: toward you = front, away = back, otherwise three-quarter,
##   mirrored when they face left.
## - Changing view flips the card like a real cut-out, showing its kraft back
##   and edge for a moment.
## - Walk frames: humans [walk_01, idle, walk_03, idle], the ghost walk 1-4,
##   one cycle per 800 ms. Party: an eight-frame front/back dance at 124 BPM.
## - Art loads in stages (idle, walk, dance) on background threads; until a
##   frame arrives the card shows the view's idle drawing.
extends Node3D

const SPRITE_ROOT := "res://assets/sprites/zine"
const VIEWS := ["front", "threequarter", "back"]
const FRAME_W := 640.0
const FRAME_H := 960.0
const BASE_PX := 52.0
const PX := 1.62 / 863.0
const SCALE := { "andy": 1.0, "jazz": 1.0, "olex": 1.0, "ghost": 0.72, "margo": 1.0 }
const STEP_CYCLE_S := 0.8
const DANCE_BEAT_S := 60.0 / 124.0
const DANCE_FRAMES := ["dance_01", "dance_02", "dance_03", "dance_04", "dance_05", "dance_06", "dance_07", "dance_08"]
const DANCE_CYCLE_BEATS := 4.0
const FRONT_CONE := 0.788    # cos(38 degrees)
const HYSTERESIS := 0.08
const FLIP_S := 0.22
const BOARD := 0.004
const KRAFT := Color8(0xc7, 0xa4, 0x77)
const KRAFT_EDGE := Color8(0xa9, 0x84, 0x57)

const SHADER_BODY := """
uniform sampler2D tex : source_color, filter_linear_mipmap_anisotropic;
uniform vec4 tint : source_color = vec4(1.0);
uniform bool flat_fill = false;
uniform vec4 flat_color : source_color = vec4(1.0);
uniform bool mirror = false;
uniform float opacity = 1.0;
void fragment() {
	vec2 uv = mirror ? vec2(1.0 - UV.x, UV.y) : UV;
	vec4 t = texture(tex, uv);
	if (t.a < 0.5) discard;
	ALBEDO = (flat_fill ? flat_color.rgb : t.rgb) * tint.rgb;
	#ALPHA
}
"""

static var _shader_solid: Shader
static var _shader_fade: Shader
static var _requested := {}   # path -> true once a threaded load was asked for
static var _loaded := {}      # path -> Texture2D (or null if it failed)

var type := "andy"
var heading := 0.0
var dancing := false
var view := "front"
var frame := "idle"
var mirror := false

var _turn: Node3D
var _card: Node3D
var _front: MeshInstance3D
var _rear: MeshInstance3D
var _layers: Array = []
var _blob: MeshInstance3D
var _mats: Array = []          # every ShaderMaterial, for tint and opacity
var _flip := 1.0
var _pending: Variant = null
var _gait := 0.0
var _dance_clock := 0.0
var _seed := 0.0
var _speed := 0.0
var _opacity := 1.0
var _names: Array


static func _shader(fade: bool) -> Shader:
	if fade and _shader_fade == null:
		_shader_fade = Shader.new()
		_shader_fade.code = "shader_type spatial;\nrender_mode unshaded, cull_disabled, depth_draw_always;\n" + SHADER_BODY.replace("#ALPHA", "ALPHA = opacity;")
	elif not fade and _shader_solid == null:
		_shader_solid = Shader.new()
		_shader_solid.code = "shader_type spatial;\nrender_mode unshaded, cull_disabled;\n" + SHADER_BODY.replace("#ALPHA", "")
	return _shader_fade if fade else _shader_solid


static func sprite_path(t: String, v: String, f: String) -> String:
	var folder := "margo-v3" if t == "margo" else t
	return "%s/%s/%s_%s.webp" % [SPRITE_ROOT, folder, v, f]


static func _request(path: String) -> void:
	if _requested.has(path):
		return
	_requested[path] = true
	if ResourceLoader.exists(path):
		ResourceLoader.load_threaded_request(path)
	else:
		_loaded[path] = null


## The texture at `path` if it has arrived, else null. Polls the loader.
static func texture(path: String) -> Texture2D:
	if _loaded.has(path):
		return _loaded[path]
	if not _requested.has(path):
		return null
	var status := ResourceLoader.load_threaded_get_status(path)
	if status == ResourceLoader.THREAD_LOAD_LOADED:
		_loaded[path] = ResourceLoader.load_threaded_get(path)
		return _loaded[path]
	if status == ResourceLoader.THREAD_LOAD_FAILED or status == ResourceLoader.THREAD_LOAD_INVALID_RESOURCE:
		_loaded[path] = null
	return null


func setup(t: String) -> void:
	type = t
	name = t.capitalize()
	_names = ["walk_01", "walk_02", "walk_03", "walk_04"] if type == "ghost" else ["walk_01", "idle", "walk_03", "idle"]
	_seed = randf() * 10.0
	_gait = randf() * STEP_CYCLE_S
	var s: float = SCALE[type]
	var w := FRAME_W * PX * s
	var h := FRAME_H * PX * s
	var quad := QuadMesh.new()
	quad.size = Vector2(w, h)
	quad.center_offset = Vector3(0, h / 2 - BASE_PX * PX * s, 0)

	_turn = Node3D.new()
	add_child(_turn)
	_card = Node3D.new()
	_card.rotation_order = EULER_ORDER_XYZ
	_turn.add_child(_card)

	_front = _printed(quad)
	_card.add_child(_front)
	for i in range(1, 4):
		var back := i == 3
		var m := _material(KRAFT if back else KRAFT_EDGE, true)
		var layer := MeshInstance3D.new()
		layer.mesh = quad
		layer.material_override = m
		layer.position.z = -BOARD * (i / 3.0)
		layer.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		_card.add_child(layer)
		_layers.append(layer)
	_rear = _printed(quad)
	_rear.rotation.y = PI
	_rear.position.z = -BOARD - 0.001
	_rear.visible = false
	_card.add_child(_rear)

	_blob = MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(0.62 * s + (0.15 if type == "ghost" else 0.0), 0.34 * s)
	_blob.mesh = pm
	var bm := StandardMaterial3D.new()
	bm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	bm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	bm.albedo_texture = preload("res://scripts/paper.gd").blob_texture()
	bm.albedo_color = Color(0.235, 0.176, 0.118, 0.55)
	bm.depth_draw_mode = BaseMaterial3D.DEPTH_DRAW_DISABLED
	_blob.material_override = bm
	_blob.position.y = 0.006
	_blob.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(_blob)


func _material(flat: Color, flat_fill: bool) -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = _shader(false)
	m.set_shader_parameter("flat_fill", flat_fill)
	m.set_shader_parameter("flat_color", flat)
	_mats.append(m)
	return m


func _printed(quad: QuadMesh) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.mesh = quad
	mi.material_override = _material(Color.WHITE, false)
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	return mi


# ---- Staged loading ----

func _load_frames(frames: Array, views := VIEWS) -> void:
	for v in views:
		for f in frames:
			_request(sprite_path(type, v, f))


func load_idle() -> void:
	_load_frames(["idle"])


func load_walk() -> void:
	var walk: Array = []
	for n in _names:
		if n != "idle" and not walk.has(n):
			walk.append(n)
	_load_frames(walk)


func load_dance() -> void:
	_load_frames(DANCE_FRAMES, ["front", "back"])
	_load_frames(["idle"], ["back"])


func load_all() -> void:
	load_idle()
	load_walk()


## True once the given stage's frames have all arrived (or failed).
func stage_ready(stage: String) -> bool:
	var frames: Array
	var views := VIEWS
	match stage:
		"idle": frames = ["idle"]
		"walk": frames = _names.filter(func(n): return n != "idle")
		"dance":
			frames = DANCE_FRAMES
			views = ["front", "back"]
	for v in views:
		for f in frames:
			var p := sprite_path(type, v, f)
			if not _requested.has(p):
				return false
			texture(p)  # polls the loader
			if not _loaded.has(p):
				return false
	return true


func _ready_tex(v: String, f: String) -> Texture2D:
	var t := texture(sprite_path(type, v, f))
	if t != null:
		return t
	return texture(sprite_path(type, v, "idle"))


# ---- Look ----

## Multiply the artwork by a colour (time-of-day light). White = as drawn.
func set_tint(c: Color) -> void:
	for m in _mats:
		m.set_shader_parameter("tint", c)


## Fade the whole cut-out (staff at the door, the ghost materialising).
func set_opacity(a: float) -> void:
	if a == _opacity:
		return
	var was_fading := _opacity < 1.0
	_opacity = a
	var fading := a < 1.0
	if fading != was_fading:
		for m in _mats:
			m.shader = _shader(fading)
		_front.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF if fading else GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	for m in _mats:
		m.set_shader_parameter("opacity", a)
	visible = a > 0.0


func set_dancing(on: bool) -> void:
	if dancing == on:
		return
	dancing = on
	_dance_clock = 0.0
	if on:
		view = "front"
		mirror = false
		_pending = null
		_flip = 1.0
		load_dance()
	else:
		frame = "idle"
		_card.position.y = 0.0
		_card.rotation = Vector3.ZERO
		_card.scale = Vector3.ONE
		_rear.visible = false
		for l in _layers:
			l.visible = true


static func dance_motion(beat: float) -> Vector2:
	var phase := fposmod(beat, 4.0)
	var flight := fmod(phase, 2.0) / 0.7
	var progress := maxf(0.0, (phase - 2.0) / 2.0)
	var jump := 0.22 * 4.0 * flight * (1.0 - flight) if flight < 1.0 else 0.0
	return Vector2(jump, progress * progress * (3.0 - 2.0 * progress) * TAU)


static func _pick_view(current: String, toward: float) -> String:
	var front := FRONT_CONE - HYSTERESIS if current == "front" else FRONT_CONE + HYSTERESIS
	var back := -(FRONT_CONE - HYSTERESIS) if current == "back" else -(FRONT_CONE + HYSTERESIS)
	if toward > front:
		return "front"
	if toward < back:
		return "back"
	return "threequarter"


func _set_tex(mi: MeshInstance3D, t: Texture2D) -> void:
	var m: ShaderMaterial = mi.material_override
	if m.get_shader_parameter("tex") != t:
		m.set_shader_parameter("tex", t)


func update_card(time: float, dt: float, speed: float, cam_pos: Vector3) -> void:
	_speed += (speed - _speed) * minf(1.0, dt * 8.0)
	var k := _speed
	# Face the camera (yaw only).
	var to_cam := Vector2(cam_pos.x - global_position.x, cam_pos.z - global_position.z)
	_turn.rotation.y = atan2(to_cam.x, to_cam.y)
	to_cam = to_cam.normalized()
	var fx := sin(heading)
	var fz := cos(heading)
	var toward := fx * to_cam.x + fz * to_cam.y
	var rightward := fx * to_cam.y - fz * to_cam.x
	var walking := _speed > 0.15
	var active_dance := dancing and not walking
	var want := "front" if active_dance else _pick_view(view, toward)
	var want_mirror := false if active_dance else (want == "threequarter" and rightward < 0.0)
	if want != view or want_mirror != mirror:
		if _pending == null or _pending["view"] != want or _pending["mirror"] != want_mirror:
			_pending = { "view": want, "mirror": want_mirror }
			if _flip >= 1.0:
				_flip = 0.0
	elif _pending != null and _flip < 0.5:
		_pending = null
	if _flip < 1.0:
		var before := _flip < 0.5
		_flip = minf(1.0, _flip + dt / FLIP_S)
		if before and _flip >= 0.5 and _pending != null:
			view = _pending["view"]
			mirror = _pending["mirror"]
			_pending = null
	var f := _flip
	var flip_y := ((f if f < 0.5 else f - 1.0) * PI * (-1.0 if mirror else 1.0)) if f < 1.0 else 0.0
	for m in _mats:
		m.set_shader_parameter("mirror", mirror)

	_gait += dt * minf(1.0, k * 1.5)
	var p := (_gait / STEP_CYCLE_S) * TAU
	var dancing_now := dancing and not walking
	if dancing_now:
		_dance_clock = fmod(_dance_clock + dt, DANCE_BEAT_S * DANCE_CYCLE_BEATS)
	var frame_s := DANCE_BEAT_S * DANCE_CYCLE_BEATS / DANCE_FRAMES.size()
	if dancing_now:
		frame = DANCE_FRAMES[int(_dance_clock / frame_s) % DANCE_FRAMES.size()]
	elif walking:
		frame = _names[int((_gait / STEP_CYCLE_S) * _names.size()) % _names.size()]
	else:
		frame = "idle"
	var t := _ready_tex("front" if dancing_now else view, frame)
	if t != null:
		_set_tex(_front, t)
		for l in _layers:
			_set_tex(l, t)
	var rear_ready := false
	if dancing_now:
		var bt := _ready_tex("back", frame)
		rear_ready = bt != null
		_rear.visible = rear_ready
		if bt != null:
			_set_tex(_rear, bt)
		for l in _layers:
			l.visible = not rear_ready
	else:
		_rear.visible = false
		for l in _layers:
			l.visible = true
	_front.visible = t != null

	var dance_phase := _dance_clock / DANCE_BEAT_S * TAU
	var motion := dance_motion(_dance_clock / DANCE_BEAT_S)
	if dancing_now:
		flip_y = motion.y if rear_ready else 0.0
	var bob: float
	if dancing_now:
		bob = motion.x + absf(sin(dance_phase)) * 0.018
	elif type == "ghost":
		bob = 0.04 + sin(time * 1.6 + _seed) * 0.03
	else:
		bob = absf(sin(p)) * 0.025 * k
	_card.position.y = bob
	var roll: float
	if dancing_now:
		roll = sin(dance_phase) * deg_to_rad(4.0)
	else:
		roll = sin(p) * deg_to_rad(1.6) * k + sin(time * 0.9 + _seed) * deg_to_rad(0.4) * (1.0 - k)
	_card.rotation = Vector3(0, flip_y, roll)
	var sy := 1.0 + sin(dance_phase * 2.0) * 0.012 if dancing_now else 1.0 + sin(time * 2.1 + _seed) * 0.005 * (1.0 - k)
	_card.scale = Vector3(1, sy, 1)
	var bm: StandardMaterial3D = _blob.material_override
	bm.albedo_color.a = maxf(0.12, (0.7 - bob * 4.0) if type == "ghost" else (1.0 - bob * 2.0)) * _opacity * 0.55


## The card's mesh nodes, for picking with a ray.
func pick_shapes() -> Array:
	return [_front]
