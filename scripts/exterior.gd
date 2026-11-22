## The view outside: trees, a street, card buildings and a sky with clouds,
## beyond the back and right walls, seen only through the windows.
##
## Godot has no stencil portal for this, so the street is real geometry
## standing outside the closed room: the walls hide it, and the windows show
## it. The office is one floor up, so the street is a storey below the room
## floor and the windows look down on treetops and over the lower roofs.
##
##   var outside := Exterior.new(); add_child(outside); outside.setup(Layout.ROOM)
##   outside.update(night, sky_colour, moon)   # night 0 (day) .. 1
extends Node3D

const Paper := preload("res://scripts/paper.gd")

const STOREY := 4.2
const SKY_RADIUS := 100.0
const TREE_GREENS := [Color8(0x7d, 0x9a, 0x62), Color8(0x6f, 0x8f, 0x5a), Color8(0x8a, 0xa5, 0x6c), Color8(0x76, 0x94, 0x6a)]
const BARK := Color8(0x8f, 0x75, 0x58)
# Wall colour, glass tint, shop accent.
const FACADES := [
	[Color8(0xef, 0xe6, 0xd3), Color8(0xbc, 0xd4, 0xe6), Color8(0xd4, 0x76, 0x5f)],
	[Color8(0xe6, 0xbf, 0xae), Color8(0xc9, 0xdb, 0xe8), Color8(0x7d, 0x93, 0xab)],
	[Color8(0xc3, 0xd0, 0xd6), Color8(0xe9, 0xf1, 0xf6), Color8(0xd7, 0xba, 0x78)],
	[Color8(0xe7, 0xd6, 0xa8), Color8(0xbc, 0xd4, 0xe6), Color8(0x93, 0xa8, 0x8c)],
	[Color8(0xcf, 0xd8, 0xc4), Color8(0xd9, 0xe7, 0xef), Color8(0xb9, 0x8a, 0x6b)],
]
const PALE := Color8(0xdf, 0xe8, 0xee)

const SKY_SHADER := """
shader_type spatial;
render_mode unshaded, cull_disabled, fog_disabled;
uniform sampler2D clouds : source_color, filter_linear, repeat_enable;
uniform vec4 sky : source_color = vec4(0.59, 0.75, 0.92, 1.0);
uniform vec4 cloud_tint : source_color = vec4(1.0);
void fragment() {
	float a = texture(clouds, UV).a;
	ALBEDO = mix(sky.rgb, cloud_tint.rgb, a);
}
"""

var _glow: Array = []        # building materials whose emission follows the dark
var _bulbs: Array = []       # street lamp bulbs
var _sky_mat: ShaderMaterial
var _moon: MeshInstance3D
var _stars: MeshInstance3D
var _seed := 1


## Repeatable random numbers; state lives in a one-item array so lambdas can share it.
static func _lcg(st: Array) -> float:
	st[0] = (st[0] * 9301 + 49297) % 233280
	return st[0] / 233280.0


func _rnd() -> float:
	_seed = (_seed * 9301 + 49297) % 233280
	return _seed / 233280.0


## Build the street round the room. room: { W, D, HI, T }.
func setup(room: Dictionary) -> void:
	name = "Exterior"
	for c in get_children():
		c.queue_free()
	_glow.clear()
	_bulbs.clear()
	var W: float = room["W"]
	var D: float = room["D"]
	var T: float = room["T"]
	position.y = -STOREY
	# Window positions must match the room's windows.
	_side(0.0, D / 2 + T, -34.0, 34.0, [-3.8, 0.0, 3.9], 0.0)           # behind the back wall
	_side(-PI / 2, W / 2 + T, -24.0, 34.0, [0.4], 0.015)                 # beyond the right wall
	_build_sky()
	Paper.no_shadows(self)


# ---- Textures ----

static func _hex(img: Image, r: Rect2, c: Color) -> void:
	var rr := Rect2i(r).intersection(Rect2i(0, 0, img.get_width(), img.get_height()))
	if rr.size.x > 0 and rr.size.y > 0:
		img.fill_rect(rr, c)


static func _blend(img: Image, r: Rect2, c: Color) -> void:
	# Alpha-blend a flat colour over a rectangle (small rectangles only).
	var rr := Rect2i(r).intersection(Rect2i(0, 0, img.get_width(), img.get_height()))
	if rr.size.x <= 0 or rr.size.y <= 0:
		return
	var patch := Image.create(rr.size.x, rr.size.y, false, Image.FORMAT_RGBA8)
	patch.fill(c)
	img.blend_rect(patch, Rect2i(Vector2i.ZERO, rr.size), rr.position)


var _facades := {}

## Facade tile: two bays by two storeys (6 m x 6.4 m). `lit` paints the
## night-time emission map: lit windows on black.
func _facade(kind: int, lit: bool) -> Texture2D:
	var key := "%d-%s" % [kind, lit]
	if _facades.has(key):
		return _facades[key]
	var glass: Color = FACADES[kind][1]
	var st := [kind * 97 + 11]
	var rnd := func() -> float: return _lcg(st)
	var wins: Array = []
	for y in [26, 154]:
		for x in [32, 160]:
			wins.append({ "x": x, "y": y, "blind": rnd.call() * 0.6, "on": rnd.call() < 0.55, "warm": rnd.call() < 0.7 })
	var tex := Paper.image_texture(256, 256, func(img: Image):
		img.fill(Color.BLACK if lit else Color.WHITE)
		if not lit:
			for i in 26:
				_blend(img, Rect2(rnd.call() * 256, 0, 2 + rnd.call() * 7, 256), Color(0.35, 0.31, 0.25, 0.02 + rnd.call() * 0.035))
			for y in [0, 128]:
				_blend(img, Rect2(0, y + 122, 256, 2), Color(0.24, 0.2, 0.17, 0.3))
				_blend(img, Rect2(0, y + 124, 256, 4), Color(1, 1, 1, 0.5))
		var W := 64
		var H := 80
		for w in wins:
			var x: int = w["x"]
			var y: int = w["y"]
			if lit:
				if not w["on"]:
					continue
				_hex(img, Rect2(x, y, W, H), Color8(0xff, 0xd8, 0x8a) if w["warm"] else Color8(0xff, 0xee, 0xc4))
				_hex(img, Rect2(x, y, W, H * w["blind"]), Color8(0x40, 0x38, 0x28))
				continue
			_blend(img, Rect2(x - 5, y - 5, W + 10, H + 8), Color(0.16, 0.13, 0.11, 0.28))
			_hex(img, Rect2(x - 3, y - 3, W + 6, H + 6), Color8(0xf3, 0xed, 0xe0))
			# Glass: dark room above, sky below.
			for band in 8:
				var t := band / 7.0
				var col := Color8(0x46, 0x53, 0x5e).lerp(Color8(0x6d, 0x81, 0x91), minf(1.0, t / 0.55)) if t < 0.55 else Color8(0x6d, 0x81, 0x91).lerp(glass, (t - 0.55) / 0.45)
				_hex(img, Rect2(x, y + H * band / 8.0, W, H / 8.0 + 1), col)
			_hex(img, Rect2(x, y, W, H * w["blind"]), Color8(0xe9, 0xdf, 0xca))
			_blend(img, Rect2(x, y + H * w["blind"], W, 3), Color(0.16, 0.13, 0.11, 0.22))
			_hex(img, Rect2(x + W / 2 - 2, y, 4, H), Color8(0xf3, 0xed, 0xe0))
			_hex(img, Rect2(x, y + H * 0.38, W, 3), Color8(0xf3, 0xed, 0xe0))
			_hex(img, Rect2(x - 8, y + H + 3, W + 16, 6), Color8(0xf7, 0xf2, 0xe6))
			_blend(img, Rect2(x - 6, y + H + 9, W + 12, 4), Color(0.16, 0.13, 0.11, 0.3)))
	_facades[key] = tex
	return tex


## Shopfront tile for the ground floor (6 m x 3 m).
func _shop(accent: Color, lit: bool) -> Texture2D:
	var key := "shop-%s-%s" % [accent.to_html(), lit]
	if _facades.has(key):
		return _facades[key]
	var panes := [Rect2(12, 40, 88, 62), Rect2(112, 40, 78, 62), Rect2(204, 40, 40, 80)]
	var tex := Paper.image_texture(256, 128, func(img: Image):
		img.fill(Color.BLACK if lit else Color8(0xef, 0xe7, 0xd6))
		if lit:
			_hex(img, panes[0], Color8(0xff, 0xdf, 0x9a))
			_hex(img, panes[1], Color8(0xff, 0xdf, 0x9a))
			_hex(img, panes[2], Color8(0xb8, 0x9a, 0x5e))
			return
		_hex(img, Rect2(0, 0, 256, 30), accent)
		for x in range(0, 256, 24):
			_blend(img, Rect2(x, 18, 12, 12), Color(1, 1, 1, 0.35))
		_blend(img, Rect2(0, 30, 256, 5), Color(0.16, 0.13, 0.11, 0.3))
		for p in panes:
			_hex(img, p.grow(3), Color8(0xf3, 0xed, 0xe0))
			_hex(img, Rect2(p.position, Vector2(p.size.x, p.size.y / 2)), Color8(0x3d, 0x48, 0x52))
			_hex(img, Rect2(p.position + Vector2(0, p.size.y / 2), Vector2(p.size.x, p.size.y / 2)), Color8(0x7b, 0x8f, 0x9c))
		_hex(img, Rect2(0, 108, 200, 20), Color8(0xcf, 0xc5, 0xb2)))
	_facades[key] = tex
	return tex


func _street_texture() -> Texture2D:
	return Paper.image_texture(256, 64, func(img: Image):
		img.fill(Color8(0x9d, 0xa4, 0xa6))
		_hex(img, Rect2(0, 30, 256 * 0.55, 4), Color8(0xf4, 0xef, 0xe5)))


## Soft cumulus clouds on clear, for the sky drum (white with alpha).
func _cloud_texture() -> Texture2D:
	var w := 1024
	var h := 256
	var puff := Image.create(32, 32, false, Image.FORMAT_RGBA8)
	for y in 32:
		for x in 32:
			var r := Vector2(x - 15.5, y - 15.5).length() / 16.0
			var a := 0.0 if r >= 1.0 else (1.0 - 0.25 * r / 0.55 if r < 0.55 else 0.75 * (1.0 - (r - 0.55) / 0.45))
			puff.set_pixel(x, y, Color(1, 1, 1, a * 0.85))
	var st := [41]
	var rnd := func() -> float: return _lcg(st)
	var img := Image.create(w, h, false, Image.FORMAT_RGBA8)
	img.fill(Color(1, 1, 1, 0))
	# Haze thickening toward the horizon (0.87 of the way down).
	for y in h:
		var t := float(y) / h
		var a := 0.0
		if t > 0.3:
			a = lerpf(0.0, 0.14, clampf((t - 0.3) / 0.4, 0, 1)) + lerpf(0.0, 0.36, clampf((t - 0.7) / 0.17, 0, 1)) + lerpf(0.0, 0.1, clampf((t - 0.87) / 0.13, 0, 1))
		img.fill_rect(Rect2i(0, y, w, 1), Color(1, 1, 1, a))
	for i in 26:
		var cx: float = 70 + rnd.call() * (w - 140)
		var base: float = h * (0.34 + rnd.call() * 0.47)
		var half: float = 25 + rnd.call() * 45
		var tall: float = 8 + rnd.call() * 13
		var far: float = (base / h - 0.34) / 0.47
		var k := 1.0 - far * 0.55
		for j in 16:
			var t: float = rnd.call() * 2 - 1
			var bulge := 1.0 - t * t
			var r: float = (7 + rnd.call() * 13 * bulge + 4) * k
			var size := maxi(2, int(r * 2))
			var p := puff.duplicate() as Image
			p.resize(size, size, Image.INTERPOLATE_BILINEAR)
			var px := int(cx + t * half * k - r)
			var py := int(base - rnd.call() * tall * k * bulge - r)
			img.blend_rect(p, Rect2i(0, 0, size, size), Vector2i(px, py))
	img.generate_mipmaps()
	return ImageTexture.create_from_image(img)


# ---- Materials ----

func _card(color: Color, opts := {}) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = color
	m.roughness = 0.95
	m.disable_receive_shadows = true
	if opts.has("map"):
		m.albedo_texture = opts["map"]
	if opts.has("triplanar"):
		m.uv1_triplanar = true
		m.uv1_scale = opts["triplanar"]
		m.texture_repeat = true
	if opts.has("uv"):
		m.uv1_scale = opts["uv"]
		m.texture_repeat = true
	if opts.has("emission_map"):
		m.emission_enabled = true
		m.emission_texture = opts["emission_map"]
		m.emission = Color.BLACK
		_glow.append(m)
	return m


func _ink_edges(mi: MeshInstance3D) -> void:
	# The street's heavier lines: a slightly larger dark shell, front faces culled.
	var hull := StandardMaterial3D.new()
	hull.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	hull.albedo_color = Paper.C["ink"]
	hull.cull_mode = BaseMaterial3D.CULL_FRONT
	hull.grow = true
	hull.grow_amount = 0.03
	mi.material_overlay = hull


# ---- Pieces ----

## A clump of leaves: a low-poly ball, lighter on top.
func _lump(parent: Node3D, pos: Vector3, r: float, green: Color, squash := 1.0) -> void:
	var m := SphereMesh.new()
	m.radius = r
	m.height = r * 2.0 * squash
	m.radial_segments = 9
	m.rings = 5
	var mat := _card(green.lerp(Color8(0xb5, 0xc8, 0x8e), _rnd() * 0.18).darkened(_rnd() * 0.12))
	var mi := Paper._add(parent, m, mat, pos)
	mi.rotation = Vector3(_rnd(), _rnd() * TAU, _rnd() * 0.5)


func _tree(parent: Node3D, x: float, z: float, h: float, seed: int) -> void:
	var g := Node3D.new()
	g.position = Vector3(x, 0, z)
	parent.add_child(g)
	var bark := _card(BARK)
	var trunk := Paper.cyl(g, 0.07 * h / 4, 0.17 * h / 4, h * 0.5, Vector3.ZERO, bark, 8)
	_ink_edges(trunk)
	for i in 3:
		var a := TAU * i / 3.0 + seed
		var length := h * (0.24 + _rnd() * 0.08)
		Paper.rod(g, Vector3(0, h * 0.42, 0), Vector3(sin(a) * length * 0.6, h * 0.42 + length * 0.75, cos(a) * length * 0.6), 0.04 * h / 4, bark)
	var green: Color = TREE_GREENS[seed % TREE_GREENS.size()]
	_lump(g, Vector3(0, h * 0.68, 0), h * 0.24, green)
	for i in 9:
		var a := TAU * i / 9.0 + _rnd()
		var out := h * (0.17 + _rnd() * 0.08)
		_lump(g, Vector3(sin(a) * out, h * (0.54 + _rnd() * 0.2), cos(a) * out), h * (0.12 + _rnd() * 0.06), green, 0.85)
	for i in 4:
		var a := _rnd() * TAU
		var out := h * (0.06 + _rnd() * 0.07)
		_lump(g, Vector3(sin(a) * out, h * (0.82 + _rnd() * 0.1), cos(a) * out), h * (0.1 + _rnd() * 0.05), green)


func _bush(parent: Node3D, x: float, z: float, s: float) -> void:
	var g := Node3D.new()
	g.position = Vector3(x, 0, z)
	parent.add_child(g)
	_lump(g, Vector3(0, s * 0.55, 0), s, Color8(0x74, 0x91, 0x5f), 0.75)
	_lump(g, Vector3(s * 0.7, s * 0.42, s * 0.1), s * 0.7, Color8(0x6c, 0x8a, 0x58), 0.75)
	_lump(g, Vector3(-s * 0.65, s * 0.45, -s * 0.1), s * 0.75, Color8(0x7b, 0x98, 0x65), 0.75)


func _building(parent: Node3D, x: float, z: float, w: float, d: float, h: float, kind: int, haze := 0.0) -> void:
	kind = kind % FACADES.size()
	var base: Color = FACADES[kind][0]
	var accent: Color = FACADES[kind][2]
	var color := base.lerp(PALE, haze)
	# A facade tile covers 6 m x 6.4 m (two bays, two storeys).
	var wall := _card(color, { "map": _facade(kind, false), "emission_map": _facade(kind, true), "triplanar": Vector3(1.0 / 6.0, 1.0 / 6.4, 1.0 / 6.0) })
	var b := Paper.box(parent, Vector3(w, h, d), Vector3(x, 0, z), wall)
	_ink_edges(b)
	var dim := Color(base.r * 0.9, base.g * 0.9, base.b * 0.9)
	var trim := _card(dim.lerp(PALE, haze))
	var parapet := Paper.box(parent, Vector3(w + 0.36, 0.45, d + 0.36), Vector3(x, h - 0.12, z), trim)
	_ink_edges(parapet)
	if haze == 0.0:
		var front := _card(Color.WHITE, { "map": _shop(accent, false), "emission_map": _shop(accent, true), "triplanar": Vector3(1.0 / 6.0, 1.0 / 3.0, 1.0 / 6.0) })
		var shop := Paper.box(parent, Vector3(w + 0.14, 3.0, d + 0.14), Vector3(x, 0, z), front)
		_ink_edges(shop)
	if kind % 2 == 0:
		_ink_edges(Paper.cyl(parent, 0.9, 0.9, 1.6, Vector3(x + w * 0.2, h + 0.3, z), _card(Color8(0x9a, 0x84, 0x68).lerp(PALE, haze)), 16))
	else:
		_ink_edges(Paper.box(parent, Vector3(w * 0.3, 1.4, d * 0.3), Vector3(x - w * 0.18, h + 0.3, z), trim))


func _street_lamp(parent: Node3D, x: float, z: float) -> void:
	Paper.cyl(parent, 0.06, 0.08, 4.2, Vector3(x, 0, z), _card(Color8(0x5d, 0x60, 0x64)), 8)
	var bulb := Paper.glow(Color8(0xef, 0xe9, 0xdc))
	Paper.sphere(parent, 0.22, Vector3(x, 4.25, z), bulb, 12)
	_bulbs.append(bulb)


func _ground(parent: Node3D, w: float, d: float, pos: Vector3, mat: Material) -> void:
	var m := PlaneMesh.new()
	m.size = Vector2(w, d)
	Paper._add(parent, m, mat, pos)


## One side of the street scene. Local frame: -Z points away from the room,
## X runs along the wall; `wall` is the outer wall face distance.
func _side(rotation_y: float, wall: float, from: float, to: float, windows: Array, lift: float) -> void:
	var g := Node3D.new()
	g.rotation.y = rotation_y
	g.position.y = lift
	add_child(g)
	var span := to - from
	var mid := (from + to) / 2.0
	_seed = int(round(wall * 13))

	_ground(g, span, 60, Vector3(mid, -0.01, -wall - 30), _card(Color8(0xa9, 0xbd, 0x8a)))
	_ground(g, span, 2.4, Vector3(mid, 0.0, -wall - 8.2), _card(Color8(0xe4, 0xdc, 0xcb)))
	_ground(g, span, 7, Vector3(mid, 0.005, -wall - 13), _card(Color.WHITE, { "map": _street_texture(), "uv": Vector3(span / 4.0, 1, 1) }))
	_ground(g, span, 2.4, Vector3(mid, 0.0, -wall - 17.7), _card(Color8(0xe4, 0xdc, 0xcb)))

	# Hedge just outside, then trees between the windows, so each window frames the street.
	var x := from + 0.8
	while x < to:
		_bush(g, x, -wall - 0.9 - _rnd() * 0.4, 0.45 + _rnd() * 0.25)
		x += 1.5 + _rnd()
	x = from + 2.0
	while x < to:
		var clear := true
		for wx in windows:
			if absf(x - wx) < 2.2:
				clear = false
		if clear:
			_tree(g, x, -wall - 3.5 - _rnd() * 2.5, 5.2 + _rnd() * 1.8, int(_rnd() * 100))
		x += 3.5 + _rnd() * 3.0
	x = from + 2.0
	while x < to:
		_street_lamp(g, x, -wall - 9.6)
		x += 9.0

	# Across the street: low shops and mid-rise blocks with gaps for sky.
	x = from + 2.0
	var k := int(_rnd() * 5)
	while x < to - 2.0:
		var w := 6.0 + _rnd() * 6.0
		var h := 6.4 + _rnd() * 2.8 if _rnd() < 0.72 else 11.0 + _rnd() * 4.0
		var off := absf(x + w / 2.0)
		if off < 11.0:
			h = minf(h, 5.4)
		elif off < 18.0:
			h = minf(h, 7.6)
		_building(g, x + w / 2.0, -wall - 27.0 - _rnd() * 3.0, w, 9.0, h, k)
		x += w + 2.5 + _rnd() * 4.0
		k += 1
	# Far skyline, paler with distance.
	x = from - 14.0
	k = 2
	while x < to + 14.0:
		var w := 9.0 + _rnd() * 8.0
		_building(g, x + w / 2.0, -wall - 62.0 - _rnd() * 8.0, w, 12.0, 9.0 + _rnd() * 15.0, k, 0.45)
		x += w + 3.0 + _rnd() * 5.0
		k += 1


func _build_sky() -> void:
	# The sky drum: the sky colour, with clouds and haze painted on.
	var drum := CylinderMesh.new()
	drum.top_radius = SKY_RADIUS
	drum.bottom_radius = SKY_RADIUS
	drum.height = 84.0
	drum.radial_segments = 48
	drum.rings = 1
	drum.cap_top = false
	drum.cap_bottom = false
	_sky_mat = ShaderMaterial.new()
	var sh := Shader.new()
	sh.code = SKY_SHADER
	_sky_mat.shader = sh
	_sky_mat.set_shader_parameter("clouds", _cloud_texture())
	var sky := Paper._add(self, drum, _sky_mat, Vector3(0, 37, 0))
	sky.name = "Sky"
	# A lid over the top, in the sky colour, so looking up never sees the void.
	var lid := PlaneMesh.new()
	lid.size = Vector2(SKY_RADIUS * 2.2, SKY_RADIUS * 2.2)
	lid.flip_faces = true
	Paper._add(self, lid, _sky_mat, Vector3(0, 78, 0))

	# The moon, with a halo and a few craters.
	var mtex := Paper.image_texture(128, 128, func(img: Image):
		img.fill(Color(1, 1, 1, 0))
		for y in 128:
			for x in 128:
				var r := Vector2(x - 63.5, y - 63.5).length() / 64.0
				var c := Color(0.92, 0.94, 1.0, 0.0)
				if r < 0.52:
					c = Color8(0xf6, 0xf3, 0xe6)
				elif r < 1.0:
					c.a = 0.55 * (1.0 - (r - 0.52) / 0.48) * (1.0 - (r - 0.52) / 0.48)
				img.set_pixel(x, y, c)
		for cr in [[-0.05, -0.05, 0.045], [0.06, 0.02, 0.06], [-0.02, 0.08, 0.03], [0.05, -0.09, 0.025]]:
			var cx: float = 64 + cr[0] * 128
			var cy: float = 64 + cr[1] * 128
			var rr: float = cr[2] * 128
			for y in range(int(cy - rr), int(cy + rr) + 1):
				for x in range(int(cx - rr), int(cx + rr) + 1):
					if Vector2(x - cx, y - cy).length() <= rr:
						img.set_pixel(x, y, Color8(0xd2, 0xcf, 0xc2)))
	var mm := StandardMaterial3D.new()
	mm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mm.albedo_texture = mtex
	mm.albedo_color = Color(1, 1, 1, 0)
	mm.disable_fog = true
	var mq := QuadMesh.new()
	mq.size = Vector2(12, 12)
	_moon = Paper._add(self, mq, mm, Vector3(0.5, 12.5, -88))
	_moon.name = "Moon"
	# The quad faces +Z: turn that toward the room.
	_moon.basis = Basis.looking_at(_moon.position - Vector3(0, 6, 0))
	_moon.visible = false

	# Stars over the back and right windows.
	var st := [77]
	var rnd := func() -> float: return _lcg(st)
	var pts := PackedVector3Array()
	for i in 320:
		var az: float = PI + (rnd.call() - 0.5) * 2.2 if rnd.call() < 0.7 else PI / 2 + (rnd.call() - 0.5) * 1.6
		var el: float = 0.12 + rnd.call() * 0.75
		var r := 92.0
		pts.append(Vector3(sin(az) * cos(el) * r, sin(el) * r + 6.0, cos(az) * cos(el) * r))
	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = pts
	var star_mesh := ArrayMesh.new()
	star_mesh.add_surface_from_arrays(Mesh.PRIMITIVE_POINTS, arrays)
	var sm := StandardMaterial3D.new()
	sm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	sm.use_point_size = true
	sm.point_size = 2.2
	sm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	sm.albedo_color = Color8(0xff, 0xf6, 0xdc, 0)
	sm.disable_fog = true
	_stars = Paper._add(self, star_mesh, sm, Vector3.ZERO)
	_stars.name = "Stars"
	_stars.extra_cull_margin = 200.0
	_stars.visible = false


## night: 0 (day) .. 1 (night); sky: the current sky colour; moon: show the
## moon and stars whatever the light (night and the party).
func update(night: float, sky: Color, moon := false) -> void:
	var lit := clampf(night, 0.0, 1.0)
	var glow := Color(1.3 * lit, 1.2 * lit, 0.95 * lit)
	for m in _glow:
		m.emission = glow
	for m in _bulbs:
		m.albedo_color = Color8(0xef, 0xe9, 0xdc).lerp(Color8(0xff, 0xd2, 0x7a), lit)
	if _sky_mat:
		_sky_mat.set_shader_parameter("sky", sky)
		_sky_mat.set_shader_parameter("cloud_tint", sky.lerp(Color.WHITE, 0.8 - 0.55 * lit))
	var dark := maxf(lit * lit, 1.0 if moon else 0.0)
	if _moon:
		(_moon.material_override as StandardMaterial3D).albedo_color.a = dark
		_moon.visible = dark > 0.01
	if _stars:
		(_stars.material_override as StandardMaterial3D).albedo_color.a = dark * 0.9
		_stars.visible = dark > 0.01
