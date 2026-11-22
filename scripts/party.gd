## The party: what the Party button brings into the office. A disco ball that
## throws coloured light and moving beams, a boombox whose speakers pump with
## the music, and the mess a party leaves behind (cups, bottles, cans, crisps,
## pizza, confetti). The room going dim is lighting.gd's "party" look.
##
##   var party = Party.new(); add_child(party); party.setup(nav, rng)
##   party.update(on, time, dt, beat)   # beat 0..1, or null for a steady fake one
##
## The lights stay in the tree for as long as the scene does and only change
## energy, so switching the party on never rebuilds shaders.
extends Node3D

const Paper := preload("res://scripts/paper.gd")

const BPM := 124.0
const BEAMS := 18
const BALL := { "x": 0.0, "y": 2.72, "z": 0.3, "r": 0.3 }
const BOOMBOX := { "x": 1.8, "z": 1.5, "rot": -0.3 }
const ROOM := { "W": 12.0, "D": 8.0, "HI": 3.6 }
const TILES_U := 28
const TILES_V := 18

const CUP_COLORS := [Color8(0xd4, 0x56, 0x3f), Color8(0xd4, 0x56, 0x3f), Color8(0xd4, 0x56, 0x3f), Color8(0x7d, 0x93, 0xab), Color8(0xfb, 0xf8, 0xf1), Color8(0xd7, 0xba, 0x78)]
const DRINKS := [Color8(0x6b, 0x3a, 0x22), Color8(0x6b, 0x3a, 0x22), Color8(0xd9, 0x8a, 0x2b), Color8(0x7a, 0x22, 0x33), Color8(0xa8, 0xc4, 0x6a)]
const BOTTLES := [
	{ "glass": Color8(0x4f, 0x8a, 0x5b), "drink": Color8(0x6f, 0x8f, 0x3a), "label": Color8(0xf1, 0xe6, 0xc8), "band": Color8(0xd4, 0x56, 0x3f), "foil": Color8(0xd7, 0xba, 0x78) },
	{ "glass": Color8(0xb5, 0x78, 0x3a), "drink": Color8(0xc9, 0x8a, 0x2b), "label": Color8(0xf1, 0xe6, 0xc8), "band": Color8(0x2f, 0x5d, 0x8a), "foil": Color8(0xc9, 0xcc, 0xd2) },
	{ "glass": Color8(0xcf, 0xe0, 0xe0), "drink": Color8(0xe8, 0xd9, 0x8a), "label": Color8(0xfb, 0xf8, 0xf1), "band": Color8(0x93, 0xa8, 0x8c), "foil": Color8(0xc9, 0xcc, 0xd2) },
	{ "glass": Color8(0x6f, 0x9b, 0xb5), "drink": Color8(0x8f, 0xb8, 0xd0), "label": Color8(0xfb, 0xf8, 0xf1), "band": Color8(0xd4, 0x56, 0x3f), "foil": Color8(0xd7, 0xba, 0x78) },
]
# Table tops (world): the desk and the two cafe tables, with spots on them.
const TABLES := [
	{ "x": -3.9, "z": -3.05, "y": 0.76, "spread": [[-0.95, -0.3], [-0.2, 0.25], [0.55, -0.3], [0.45, 0.68], [0.2, 0.75]] },
	{ "x": 3.85, "z": -2.25, "y": 0.755, "spread": [[-0.2, 0.1], [-0.1, -0.22]] },
	{ "x": -3.75, "z": 1.45, "y": 0.755, "spread": [[-0.18, 0.12], [0.15, -0.2]] },
]

const BALL_SHADER := """
shader_type spatial;
render_mode unshaded;
uniform float time = 0.0;
uniform float kick = 0.0;
varying float lit;
vec3 hsl(float h, float s, float l) {
	vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
	return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));
}
void vertex() { lit = 0.78 + 0.22 * normalize(VERTEX).y; }
void fragment() {
	float u = floor(UV.x * 28.0);
	float v = floor(UV.y * 18.0);
	float hue = (u / 28.0) * 2.0 + (v / 18.0) * 1.4 + time * 0.12;
	float twinkle = 0.5 + 0.5 * sin(time * 2.6 + u * 1.3 + v * 2.1);
	float checker = mod(u + v, 2.0);
	float light = (0.3 + 0.32 * twinkle + checker * 0.08 + kick * 0.16) * lit;
	vec3 c = hsl(fract(hue), 0.95, min(0.78, light + 0.1));
	// Dark grout between the mirror tiles.
	vec2 f = fract(UV * vec2(28.0, 18.0));
	float grout = step(0.06, f.x) * step(0.06, f.y);
	ALBEDO = c * mix(0.35, 1.0, grout);
}
"""

var boombox := Vector2(1.8, 1.5)
var fade := 0.0
var beat := 0.0
var intensity := 0.0

var rng: RandomNumberGenerator
var stuff := Node3D.new()        # what shows only while the party is on
var ball: MeshInstance3D
var ball_mat := ShaderMaterial.new()
var boom := Node3D.new()
var woofers: Array = []
var display_mat: StandardMaterial3D
var glow_light := OmniLight3D.new()
var sweep := SpotLight3D.new()
var sweep_target := Vector3.ZERO
var bass := OmniLight3D.new()
var beams: Array = []            # { cone: Node3D, cone_mat, dot: Node3D, dot_mat, spin }
var _from := Vector3(BALL["x"], BALL["y"], BALL["z"])


static func hsl(h: float, s: float, l: float) -> Color:
	h = fposmod(h, 1.0)
	var k := func(n: float) -> float:
		var kk := fposmod(n + h * 12.0, 12.0)
		var a := s * minf(l, 1.0 - l)
		return l - a * maxf(-1.0, minf(kk - 3.0, minf(9.0 - kk, 1.0)))
	return Color(k.call(0.0), k.call(8.0), k.call(4.0))


static func hue_color(h: float, l := 0.55) -> Color:
	return hsl(h, 1.0, l)


static func _additive() -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	m.depth_draw_mode = BaseMaterial3D.DEPTH_DRAW_DISABLED
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	m.disable_fog = true
	return m


static func _see_through(color: Color, alpha: float, rough := 0.25) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(color, alpha)
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.roughness = rough
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	m.depth_draw_mode = BaseMaterial3D.DEPTH_DRAW_DISABLED
	return m


func _r() -> float:
	return rng.randf()


func _pick(list: Array):
	return list[int(_r() * list.size())]


## Build everything. nav: the office NavGrid (mess lands on free floor).
func setup(nav, a_rng: RandomNumberGenerator = null) -> void:
	rng = a_rng if a_rng else RandomNumberGenerator.new()
	name = "Party"
	stuff.visible = false
	add_child(stuff)
	_build_ball()
	_build_boombox()
	_build_mess(nav)
	_build_lights()
	_build_beams()


# ---- Disco ball ----
# A sphere of small mirror tiles. Each tile throws back whatever colour is
# swinging past it: the shader paints the tiles from their row and column, so
# the colours swirl round the ball as it turns and twinkle.

func _build_ball() -> void:
	var g := Node3D.new()
	g.position = _from
	stuff.add_child(g)
	var m := SphereMesh.new()
	m.radius = BALL["r"]
	m.height = BALL["r"] * 2.0
	m.radial_segments = TILES_U
	m.rings = TILES_V
	var sh := Shader.new()
	sh.code = BALL_SHADER
	ball_mat.shader = sh
	ball = MeshInstance3D.new()
	ball.mesh = m
	ball.material_override = ball_mat
	ball.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	g.add_child(ball)
	# The cord up to a little ceiling mount.
	var rise: float = ROOM["HI"] - BALL["y"]
	var ink := Paper.mat(Paper.C.ink)
	Paper.cyl(g, 0.006, 0.006, rise - BALL["r"], Vector3(0, BALL["r"], 0), ink, 6)
	Paper.cyl(g, 0.07, 0.07, 0.04, Vector3(0, rise - 0.04, 0), ink, 16)


# ---- Boombox ----

func _build_boombox() -> void:
	boom.position = Vector3(BOOMBOX["x"], 0, BOOMBOX["z"])
	boom.rotation.y = BOOMBOX["rot"]
	stuff.add_child(boom)
	var shell := Paper.mat(Color8(0x2d, 0x2c, 0x35), "plastic")
	var trim := Paper.mat(Color8(0xb8, 0xbc, 0xc4), "metal")
	var lift := 0.04
	Paper.rbox(boom, Vector3(0.56, 0.27, 0.17), Vector3(0, lift, 0), shell)
	for x in [-0.185, 0.185]:
		var ring := Paper.cyl(boom, 0.105, 0.105, 0.012, Vector3(x, lift + 0.135 - 0.006, 0.085), trim, 32)
		ring.rotation.x = PI / 2
		var cone := Paper.cyl(boom, 0.085, 0.085, 0.02, Vector3(x, lift + 0.135 - 0.01, 0.093), Paper.mat(Color8(0x15, 0x15, 0x1a), "rubber"), 32)
		cone.rotation.x = PI / 2
		var dome := Paper.cyl(boom, 0.03, 0.03, 0.02, Vector3(x, lift + 0.135 - 0.01, 0.103), trim, 16)
		dome.rotation.x = PI / 2
		woofers.append_array([cone, dome])
	Paper.box(boom, Vector3(0.14, 0.1, 0.012), Vector3(0, lift + 0.12, 0.087), Paper.mat(Color8(0x9f, 0xa4, 0xad), "plastic"))
	display_mat = Paper.glow(Color8(0x7d, 0xff, 0x5a))
	var disp := Paper.box(boom, Vector3(0.1, 0.024, 0.006), Vector3(0, lift + 0.21 - 0.012, 0.095), display_mat)
	disp.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	for pair in [[-0.05, Paper.C.coral], [0.0, Paper.C.ochre], [0.05, Paper.C.blue]]:
		var knob := Paper.cyl(boom, 0.014, 0.014, 0.014, Vector3(pair[0], lift + 0.07, 0.092), Paper.mat(pair[1], "plastic"), 12)
		knob.rotation.x = PI / 2
	# Handle (a half ring standing up) and the aerial.
	var handle := Node3D.new()
	handle.position = Vector3(0, lift + 0.27, 0)
	boom.add_child(handle)
	for i in 9:
		var a0 := PI * i / 9.0
		var a1 := PI * (i + 1) / 9.0
		Paper.rod(handle, Vector3(cos(a0) * 0.15, sin(a0) * 0.15 * 0.6, 0), Vector3(cos(a1) * 0.15, sin(a1) * 0.15 * 0.6, 0), 0.012, trim)
	var aerial := Paper.cyl(boom, 0.004, 0.004, 0.3, Vector3(0.24, lift + 0.27, -0.05), trim, 6)
	aerial.rotation.z = -0.35


# ---- The mess ----
# Cups and bottles are party-sized: a little larger than life, so they read
# from the middle of the room. A pivot puts an item at (x, y, z) and scales it.

func _pivot(parent: Node3D, x: float, y: float, z: float, k := 1.6) -> Node3D:
	var g := Node3D.new()
	g.position = Vector3(x, y, z)
	g.scale = Vector3.ONE * k
	parent.add_child(g)
	return g


func _ring(parent: Node3D, radius: float, tube: float, y: float, material: Material) -> void:
	Paper.torus(parent, radius, tube, Vector3(0, y, 0), material)


func _disc(parent: Node3D, r: float, pos: Vector3, material: Material) -> MeshInstance3D:
	var mi := Paper.cyl(parent, r, r, 0.001, pos, material, 18)
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	return mi


func _spill(parent: Node3D, x: float, y: float, z: float, r: float, color: Color) -> void:
	var m := _disc(parent, r, Vector3(x, y + 0.003, z), _see_through(color, 0.55, 0.2))
	m.scale = Vector3(1, 1, 0.6 + _r() * 0.6)
	m.rotation.y = _r() * PI


## A party cup: a shell with a white inside, a rolled rim and ridges; upright
## (maybe with a drink left, maybe crushed) or on its side with a spill.
func _cup(parent: Node3D, fallen: Variant = null) -> void:
	if fallen == null:
		fallen = _r() < 0.4
	var color: Color = _pick(CUP_COLORS)
	var rt := 0.042
	var rb := 0.028
	var h := 0.1
	var wall := 0.0025
	var outer := Paper.mat(color, "plastic", { "double": true })
	var inner := Paper.mat(Color8(0xee, 0xe8, 0xda) if color == Color8(0xfb, 0xf8, 0xf1) else Color8(0xfb, 0xf8, 0xf1), "plastic", { "double": true })
	var g := Node3D.new()
	var body := Node3D.new()
	g.add_child(body)
	Paper.lathe(body, [Vector2(0, 0), Vector2(rb, 0), Vector2(rt, h)], Vector3.ZERO, outer, 20)
	Paper.lathe(body, [Vector2(rt - wall, h), Vector2(rb - wall, wall), Vector2(0, wall)], Vector3.ZERO, inner, 20)
	_ring(body, rt, 0.0032, h, outer)
	for t in [0.3, 0.55]:
		_ring(body, rb + (rt - rb) * t + 0.0012, 0.0018, h * t, outer)
	_ring(body, rb + 0.001, 0.0018, 0.004, outer)
	if fallen:
		g.position = Vector3(0, rt * 0.92, 0)
		g.rotation_order = EULER_ORDER_XYZ
		g.rotation = Vector3(0, _r() * TAU, (1.0 if _r() < 0.5 else -1.0) * (1.35 + _r() * 0.2))
		body.position.y = -h / 2
		_spill(parent, (_r() - 0.5) * 0.12, 0, (_r() - 0.5) * 0.12, 0.05 + _r() * 0.05, Color8(0x7a, 0x4a, 0x2a))
	else:
		if _r() < 0.25:
			body.scale = Vector3(1.14, 0.6, 0.92)   # stepped on
			g.rotation.z = (_r() - 0.5) * 0.3
		elif _r() < 0.5:
			var level := 0.25 + _r() * 0.3
			var drink := StandardMaterial3D.new()
			drink.albedo_color = _pick(DRINKS)
			drink.roughness = 0.25
			_disc(body, rb + (rt - rb) * level - wall - 0.001, Vector3(0, h * level, 0), drink)
	parent.add_child(g)


## A bottle: see-through glass with a shoulder and neck, a paper label, foil
## and a crown cap. Standing or lying, empty or half full.
func _bottle(parent: Node3D, fallen: Variant = null) -> void:
	if fallen == null:
		fallen = _r() < 0.45
	var kind: Dictionary = _pick(BOTTLES)
	var half := _r() < 0.45
	var tall := _r() < 0.4
	var r := 0.03 if tall else 0.036
	var body := 0.2 if tall else 0.14
	var neck := 0.11 if tall else 0.085
	var top := body + neck
	var g := Node3D.new()
	var inside := Node3D.new()   # origin on the bottle's base
	var glass := _see_through(kind["glass"], 0.55, 0.08)
	glass.metallic = 0.1
	var shell := Paper.lathe(inside, [
		Vector2(0, 0), Vector2(r * 0.9, 0), Vector2(r, 0.008), Vector2(r, body), Vector2(r * 0.94, body + 0.02), Vector2(r * 0.7, body + neck * 0.35),
		Vector2(0.0175, body + neck * 0.7), Vector2(0.0148, top - 0.014), Vector2(0.0148, top - 0.006), Vector2(0.0172, top - 0.006), Vector2(0.0172, top),
	], Vector3.ZERO, glass, 24)
	shell.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	if half:
		var level := body * (0.3 + _r() * 0.25)
		var ri := r - 0.003
		var drink := StandardMaterial3D.new()
		drink.albedo_color = kind["drink"]
		drink.roughness = 0.25
		Paper.cyl(inside, ri, ri, level - 0.006, Vector3(0, 0.006, 0), drink, 24)
		var foam := StandardMaterial3D.new()
		foam.albedo_color = Color8(0xf3, 0xea, 0xd2)
		Paper.cyl(inside, ri * 0.98, ri * 0.98, 0.005, Vector3(0, level, 0), foam, 24)
	# The label: a paper wrap with a coloured band and a small round badge.
	Paper.cyl(inside, r + 0.0014, r + 0.0014, 0.07, Vector3(0, 0.056 - 0.035, 0), Paper.mat(kind["label"], "card", { "double": true }), 28)
	Paper.cyl(inside, r + 0.0022, r + 0.0022, 0.02, Vector3(0, 0.058 - 0.01, 0), Paper.mat(kind["band"], "card", { "double": true }), 28)
	var badge := Paper.cyl(inside, 0.012, 0.012, 0.001, Vector3(0, 0.058, r + 0.0032), Paper.mat(kind["label"]), 14)
	badge.rotation.x = PI / 2
	# Neck foil and the crown cap.
	Paper.cyl(inside, 0.0163, 0.0178, 0.03, Vector3(0, top - 0.026 - 0.015, 0), Paper.mat(kind["foil"], "metal", { "double": true }), 16)
	var cap_mat := Paper.mat(Paper.C.ink, "metal")
	Paper.cyl(inside, 0.0178, 0.0178, 0.008, Vector3(0, top, 0), cap_mat, 16)
	_ring(inside, 0.0178, 0.0026, top + 0.001, cap_mat)
	if fallen:
		g.position = Vector3(0, r, 0)
		g.rotation_order = EULER_ORDER_XYZ
		g.rotation = Vector3(0, _r() * TAU, PI / 2)
		inside.position.y = -body / 2
		if half:
			_spill(parent, 0, 0, 0, 0.07 + _r() * 0.04, kind["drink"])
	g.add_child(inside)
	parent.add_child(g)


func _crumple(parent: Node3D) -> void:
	var r := 0.03 + _r() * 0.03
	var m := SphereMesh.new()      # a low-poly ball of paper
	m.radius = r
	m.height = r * 2.0
	m.radial_segments = 5
	m.rings = 3
	var mi := MeshInstance3D.new()
	mi.mesh = m
	mi.material_override = Paper.mat(Paper.C.white if _r() < 0.7 else Paper.C.kraft)
	mi.scale = Vector3(1 + _r() * 0.3, 0.8 + _r() * 0.3, 1 + _r() * 0.3)
	mi.position = Vector3(0, r * 0.8, 0)
	mi.rotation = Vector3(_r() * 3, _r() * 3, _r() * 3)
	parent.add_child(mi)


func _can(parent: Node3D) -> void:
	var g := Node3D.new()
	var color: Color = _pick([Color8(0xc9, 0xcc, 0xd2), Paper.C.coral, Paper.C.blue, Color8(0x93, 0xa8, 0x8c)])
	var h := 0.115
	var r := 0.033
	var m := Paper.mat(color, "metal")
	if _r() < 0.5:
		g.position = Vector3(0, r, 0)
		g.rotation_order = EULER_ORDER_XYZ
		g.rotation = Vector3(0, _r() * TAU, PI / 2)
		Paper.cyl(g, r, r, h, Vector3(0, -h / 2, 0), m, 14)
	else:
		Paper.cyl(g, r, r, h * (0.7 if _r() < 0.3 else 1.0), Vector3.ZERO, m, 14)
	parent.add_child(g)


func _crisps(parent: Node3D) -> void:
	var color: Color = _pick([Paper.C.coral, Paper.C.blue, Paper.C.ochre])
	var m := Paper.box(parent, Vector3(0.14, 0.012, 0.2), Vector3(0, 0.006, 0), Paper.mat(color, "plastic"))
	m.rotation = Vector3((_r() - 0.5) * 0.2, _r() * TAU, (_r() - 0.5) * 0.2)


## A wedge of pizza with its point at the origin: cheese, a crust along the
## outer edge, pepperoni and maybe basil and an olive. Angles as in sin/cos (x, z).
func _pizza_slice(radius: float, from: float, arc: float) -> Node3D:
	var g := Node3D.new()
	var pts := PackedVector2Array([Vector2.ZERO])
	var n := 8
	for i in n + 1:
		var a := from + arc * i / n
		pts.append(Vector2(sin(a) * radius, -cos(a) * radius))   # laid flat below: local -y becomes +z
	var wedge := Paper.polygon(g, pts, Vector3(0, 0.014, 0), Paper.mat(Color8(0xe9, 0xb9, 0x57), "satin", { "double": true }))
	wedge.rotation.x = -PI / 2
	var crust := Paper.mat(Color8(0xc9, 0x87, 0x46))
	for i in n:
		var a0 := from + arc * i / n
		var a1 := from + arc * (i + 1) / n
		Paper.rod(g, Vector3(sin(a0) * radius, 0.012, cos(a0) * radius), Vector3(sin(a1) * radius, 0.012, cos(a1) * radius), 0.0145, crust)
	var mid := from + arc / 2.0
	var topping := func(rho: float, da: float, r: float, color: Color) -> MeshInstance3D:
		var a := mid + da
		return Paper.cyl(g, r, r, 0.005, Vector3(sin(a) * rho, 0.0145, cos(a) * rho), Paper.mat(color), 14)
	topping.call(radius * 0.55, -arc * 0.1, 0.017, Color8(0xb3, 0x40, 0x2e))
	topping.call(radius * 0.8, arc * 0.12, 0.017, Color8(0xb3, 0x40, 0x2e))
	if _r() < 0.6:
		topping.call(radius * 0.38, arc * 0.15, 0.011, Color8(0x4f, 0x7a, 0x3a)).scale = Vector3(1.3, 1, 0.8)   # basil
	if _r() < 0.5:
		topping.call(radius * 0.7, -arc * 0.2, 0.009, Color8(0x2d, 0x2c, 0x2a))                                # olive
	# Browned cheese blisters.
	for i in 3:
		var a := from + arc * (0.15 + _r() * 0.7)
		var rho := radius * (0.3 + _r() * 0.5)
		_disc(g, 0.008 + _r() * 0.006, Vector3(sin(a) * rho, 0.0145, cos(a) * rho), _see_through(Color8(0xc9, 0x89, 0x2f), 0.7, 0.8))
	return g


## A cardboard pizza box, lid propped open, a logo on the lid and grease on
## the tray, with a few slices left (and one that got away).
func _pizza_box(parent: Node3D, x: float, z: float) -> void:
	var g := Node3D.new()
	g.position = Vector3(x, 0, z)
	g.rotation.y = _r() * TAU
	var kraft := Paper.mat(Color8(0xe3, 0xcf, 0xa6))
	var inner := Paper.mat(Color8(0xcd, 0xb8, 0x8c))
	var S := 0.4
	var wall := 0.008
	var H := 0.042
	Paper.box(g, Vector3(S, 0.006, S), Vector3.ZERO, inner)
	Paper.box(g, Vector3(S, H, wall), Vector3(0, 0, S / 2 - wall / 2), kraft)
	Paper.box(g, Vector3(S, H, wall), Vector3(0, 0, -S / 2 + wall / 2), kraft)
	Paper.box(g, Vector3(wall, H, S - 2 * wall), Vector3(S / 2 - wall / 2, 0, 0), kraft)
	Paper.box(g, Vector3(wall, H, S - 2 * wall), Vector3(-S / 2 + wall / 2, 0, 0), kraft)
	for i in 5:
		_disc(g, 0.03 + _r() * 0.05, Vector3((_r() - 0.5) * 0.3, 0.0065, (_r() - 0.5) * 0.3), _see_through(Color8(0x7a, 0x55, 0x30), 0.3, 0.9))
	var pie := Node3D.new()
	pie.position.y = 0.006
	var left := 2 + int(_r() * 3)
	var start := _r() * TAU
	for i in left:
		pie.add_child(_pizza_slice(0.17, start + i * (PI / 4), PI / 4 - 0.03))
	g.add_child(pie)
	# The lid, hinged at the back and propped open.
	var hinge := Node3D.new()
	hinge.position = Vector3(0, H, -S / 2)
	hinge.rotation.x = -(1.45 + _r() * 0.25)
	Paper.box(hinge, Vector3(S, 0.008, S), Vector3(0, 0, S / 2), kraft)
	var red := Paper.mat(Color8(0xd4, 0x56, 0x3f))
	Paper.cyl(hinge, 0.085, 0.085, 0.002, Vector3(0, 0.008, S / 2), red, 24)
	Paper.cyl(hinge, 0.06, 0.06, 0.002, Vector3(0, 0.01, S / 2), Paper.mat(Color8(0xfb, 0xf8, 0xf1)), 24)
	Paper.cyl(hinge, 0.035, 0.035, 0.002, Vector3(0, 0.012, S / 2), red, 24)
	for dz in [-0.14, 0.14]:
		Paper.box(hinge, Vector3(0.2, 0.002, 0.014), Vector3(0, 0.01, S / 2 + dz), red)
	g.add_child(hinge)
	parent.add_child(g)
	var stray := _pizza_slice(0.2, -0.35, 0.7)
	stray.position = Vector3(S * 0.7, 0, S * 0.2)
	stray.rotation.y = _r() * TAU
	g.add_child(stray)


## Confetti: one multimesh of tiny flat pieces on the free floor.
func _confetti(parent: Node3D, nav, count := 180) -> void:
	var piece := PlaneMesh.new()
	piece.size = Vector2(0.06, 0.03)
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.vertex_color_use_as_albedo = true
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	piece.material = m
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = true
	mm.mesh = piece
	mm.instance_count = count
	for i in count:
		var p: Vector2 = nav.random_free(rng)
		var basis := Basis.from_euler(Vector3((_r() - 0.5) * 0.3, _r() * TAU, (_r() - 0.5) * 0.3))
		mm.set_instance_transform(i, Transform3D(basis, Vector3(p.x + (_r() - 0.5) * 0.2, 0.006 + _r() * 0.004, p.y + (_r() - 0.5) * 0.2)))
		mm.set_instance_color(i, hsl(_r(), 0.9, 0.6))
	var mmi := MultiMeshInstance3D.new()
	mmi.multimesh = mm
	mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	parent.add_child(mmi)


func _build_mess(nav) -> void:
	var g := Node3D.new()
	g.name = "PartyMess"
	stuff.add_child(g)
	var floor_at := func() -> Vector2: return nav.random_free(rng)
	var jitter := func() -> float: return (_r() - 0.5) * 0.12
	for i in 12:
		var p: Vector2 = floor_at.call()
		_cup(_pivot(g, p.x + jitter.call(), 0, p.y + jitter.call()))
	for i in 8:
		var p: Vector2 = floor_at.call()
		_bottle(_pivot(g, p.x, 0, p.y))
	for i in 14:
		var p: Vector2 = floor_at.call()
		_crumple(_pivot(g, p.x + jitter.call(), 0, p.y + jitter.call()))
	for i in 5:
		var p: Vector2 = floor_at.call()
		_can(_pivot(g, p.x, 0, p.y))
	for i in 4:
		var p: Vector2 = floor_at.call()
		_crisps(_pivot(g, p.x, 0, p.y))
	for i in 2:
		var p: Vector2 = floor_at.call()
		_pizza_box(_pivot(g, 0, 0, 0, 1.3), p.x / 1.3, p.y / 1.3)
	# On the desk and the cafe tables: a cup, a bottle or two, a tipped cup.
	for t in TABLES:
		var spread: Array = t["spread"]
		for i in spread.size():
			var x: float = t["x"] + spread[i][0]
			var z: float = t["z"] + spread[i][1]
			if i % 3 == 1:
				_bottle(_pivot(g, x, t["y"], z, 1.3), false)
			else:
				_cup(_pivot(g, x, t["y"], z, 1.3), i % 3 == 2 and _r() < 0.7)
		_crumple(_pivot(g, t["x"] + (_r() - 0.5) * 0.3, t["y"], t["z"] + (_r() - 0.5) * 0.3, 1.3))
	_confetti(g, nav)


# ---- Lights and beams ----

func _build_lights() -> void:
	# The light the ball throws: one colour that drifts, one that sweeps the room.
	glow_light.position = _from + Vector3(0, -0.15, 0)
	glow_light.omni_range = 12.0
	glow_light.omni_attenuation = 1.4
	glow_light.light_energy = 0.0
	add_child(glow_light)
	sweep.position = _from + Vector3(0, -0.1, 0)
	sweep.spot_range = 12.0
	sweep.spot_angle = rad_to_deg(0.55)
	sweep.spot_angle_attenuation = 0.85
	sweep.light_energy = 0.0
	add_child(sweep)
	# A pink glow from the boombox itself.
	bass.position = Vector3(BOOMBOX["x"], 0.4, BOOMBOX["z"] + 0.3)
	bass.omni_range = 2.4
	bass.light_color = Color8(0xff, 0x3d, 0x81)
	bass.light_energy = 0.0
	add_child(bass)


func _build_beams() -> void:
	var cone_mesh := CylinderMesh.new()   # apex at the top, opening downward
	cone_mesh.top_radius = 0.0
	cone_mesh.bottom_radius = 1.0
	cone_mesh.height = 1.0
	cone_mesh.radial_segments = 10
	cone_mesh.rings = 1
	cone_mesh.cap_top = false
	cone_mesh.cap_bottom = false
	var dot_mesh := QuadMesh.new()
	dot_mesh.size = Vector2(2, 2)
	for i in BEAMS:
		var cone := Node3D.new()
		var cone_mat := _additive()
		var cmi := MeshInstance3D.new()
		cmi.mesh = cone_mesh
		cmi.material_override = cone_mat
		cmi.position.y = -0.5            # apex at the node's origin
		cmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		cmi.extra_cull_margin = 16.0
		cone.add_child(cmi)
		stuff.add_child(cone)
		var dot := MeshInstance3D.new()
		var dot_mat := _additive()
		dot_mat.albedo_texture = Paper.blob_texture()
		dot.mesh = dot_mesh
		dot.material_override = dot_mat
		dot.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		stuff.add_child(dot)
		beams.append({ "cone": cone, "cone_mat": cone_mat, "dot": dot, "dot_mat": dot_mat, "spin": i * (TAU / BEAMS) + (i % 2) * 0.6 })


## Where a ray from the ball meets the floor, ceiling or a wall: [t, normal].
func _hit(d: Vector3) -> Array:
	var t := INF
	var normal := Vector3.UP
	var ceil_y: float = ROOM["HI"] - 0.03
	var hx: float = ROOM["W"] / 2.0 - 0.03
	var hz: float = ROOM["D"] / 2.0 - 0.03
	var tests: Array = []
	if d.y < -1e-3: tests.append([(0.0 - _from.y) / d.y, Vector3(0, 1, 0)])
	elif d.y > 1e-3: tests.append([(ceil_y - _from.y) / d.y, Vector3(0, -1, 0)])
	if d.x > 1e-3: tests.append([(hx - _from.x) / d.x, Vector3(-1, 0, 0)])
	elif d.x < -1e-3: tests.append([(-hx - _from.x) / d.x, Vector3(1, 0, 0)])
	if d.z > 1e-3: tests.append([(hz - _from.z) / d.z, Vector3(0, 0, -1)])
	elif d.z < -1e-3: tests.append([(-hz - _from.z) / d.z, Vector3(0, 0, 1)])
	for test in tests:
		if test[0] > 0.0 and test[0] < t:
			t = test[0]
			normal = test[1]
	return [t, normal]


static func _rotation_between(a: Vector3, b: Vector3) -> Basis:
	var axis := a.cross(b)
	var dot := clampf(a.dot(b), -1.0, 1.0)
	if axis.length() < 1e-6:
		return Basis() if dot > 0.0 else Basis(Vector3.RIGHT, PI)
	return Basis(axis.normalized(), acos(dot))


func update(on: bool, time: float, dt: float, a_beat: Variant = null) -> void:
	fade += ((1.0 if on else 0.0) - fade) * minf(1.0, dt * 3.0)
	if not on and fade < 0.01:
		fade = 0.0
	var f := fade
	stuff.visible = on or f > 0.0
	if f == 0.0:
		glow_light.light_energy = 0.0
		sweep.light_energy = 0.0
		bass.light_energy = 0.0
		intensity = 0.0
		return

	# Without music (sound off) the lights keep time on their own.
	var period := 60.0 / BPM
	var kick: float = a_beat if a_beat != null else exp(-(fmod(time, period) / period) * 7.0)
	beat = kick

	var hue := time * 0.07
	glow_light.light_color = hue_color(hue)
	glow_light.light_energy = f * (0.45 + kick * 0.9)
	sweep.light_color = hue_color(hue + 0.5)
	sweep.light_energy = f * (3.0 + kick * 2.5)
	var a := time * 0.5
	sweep_target = Vector3(BALL["x"] + cos(a) * 3.4, 0, BALL["z"] + sin(a * 1.3) * 2.2)
	sweep.basis = Basis.looking_at(sweep_target - sweep.position, Vector3.FORWARD if absf((sweep_target - sweep.position).normalized().y) > 0.99 else Vector3.UP)
	bass.light_color = hue_color(hue + 0.15)
	bass.light_energy = f * kick * 1.5
	intensity = glow_light.light_energy

	# The ball turns and sparkles.
	ball.rotation.y = time * 0.6
	ball_mat.set_shader_parameter("time", time)
	ball_mat.set_shader_parameter("kick", kick)

	# Beams swing about under the ball: down, sideways and up.
	for i in beams.size():
		var b: Dictionary = beams[i]
		var theta: float = time * (0.45 + (i % 3) * 0.12) * (-1.0 if i % 2 else 1.0) + b["spin"]
		var phi := PI * (0.5 + 0.42 * sin(time * (0.25 + (i % 5) * 0.06) + i * 2.4))
		var dir := Vector3(sin(phi) * cos(theta), cos(phi), sin(phi) * sin(theta))
		var hit := _hit(dir)
		var length: float = hit[0]
		var normal: Vector3 = hit[1]
		var colour := hue_color(hue + float(i) / BEAMS, 0.6)
		var end := 0.1 + length * 0.025
		var cone: Node3D = b["cone"]
		cone.position = _from
		cone.basis = _rotation_between(Vector3.DOWN, dir) * Basis.from_scale(Vector3(end, length, end))
		(b["cone_mat"] as StandardMaterial3D).albedo_color = Color(colour, f * (0.06 + kick * 0.05))
		var dot: MeshInstance3D = b["dot"]
		dot.position = _from + dir * length + normal * 0.012
		dot.basis = _rotation_between(Vector3.BACK, normal) * Basis.from_scale(Vector3.ONE * (0.4 + kick * 0.08))
		(b["dot_mat"] as StandardMaterial3D).albedo_color = Color(colour, f * (0.22 + kick * 0.12))

	# The speakers pump.
	for w in woofers:
		w.scale = Vector3(1 + kick * 0.1, 1, 1 + kick * 0.1)
	display_mat.albedo_color = hue_color(hue + 0.3, 0.45 + kick * 0.15)
	boom.position.y = kick * 0.004
