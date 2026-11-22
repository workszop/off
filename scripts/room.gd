## The room: a paper diorama on a card base. Gridded paper floor, four card
## walls with windows and a door, the four zone mats with their handwritten
## labels, a pinboard, wall art (posters.gd), a ceiling with card light
## panels, the hallway behind the door, and a wall clock that keeps time.
##
## The room is closed, so no view from inside leads out into empty space.
extends Node3D

const Paper := preload("res://scripts/paper.gd")
const Layout := preload("res://scripts/layout.gd")
const Posters := preload("res://scripts/posters.gd")
const Furniture := preload("res://scripts/furniture.gd")
const C := Paper.C

const ROOM := Layout.ROOM
const DOOR := Layout.DOOR

const ZONES := [
	{ "label": "focus corner", "color": Color8(0xbd, 0xce, 0xd1), "rect": [-5.8, -3.85, -0.85, -1.15], "rot": -0.012, "seed": 1 },
	{ "label": "coffee nook", "color": Color8(0xd8, 0xa0, 0x8d), "rect": [2.75, -3.85, 5.8, -0.85], "rot": 0.014, "seed": 2 },
	{ "label": "thinking wall", "color": Color8(0xd7, 0xba, 0x78), "rect": [-5.8, -0.1, -2.55, 3.1], "rot": 0.01, "seed": 3, "align": "right" },
	{ "label": "soft landing", "color": Color8(0xb8, 0xc7, 0xaf), "rect": [1.25, -0.05, 5.8, 3.45], "rot": -0.01, "seed": 4 },
]

var walls := {}            # name -> Node3D in the wall's own frame (x along, y up, +z into the room)
var panels: Array = []     # ceiling panel materials, their glow set by lighting.gd
var glass_mat: StandardMaterial3D
var _hour_hand: Node3D
var _minute_hand: Node3D
var _second_hand: Node3D


func build() -> void:
	_build_base()
	_build_mats()
	var W: float = ROOM["W"]
	var D: float = ROOM["D"]
	var T: float = ROOM["T"]
	var win := func(x: float, w := 2.4) -> Dictionary: return { "x": x, "w": w, "y0": 0.85, "y1": 2.3 }
	_build_wall("back", W + 2 * T, Vector3(0, 0, -D / 2 - T / 2), 0.0, [], [win.call(-3.8), win.call(0.0), win.call(3.9)])
	_build_wall("front", W + 2 * T, Vector3(0, 0, D / 2 + T / 2), PI, [{ "x": DOOR["x"], "w": DOOR["w"], "h": DOOR["h"] }], [])
	_build_wall("left", D, Vector3(-W / 2 - T / 2, 0, 0), PI / 2, [], [])
	_build_wall("right", D, Vector3(W / 2 + T / 2, 0, 0), -PI / 2, [], [win.call(0.4, 3.0)])

	# The door leaf, swung open into the room (the front wall's local X is mirrored).
	var hinge := Node3D.new()
	hinge.position = Vector3(DOOR["x"] - DOOR["w"] / 2.0, 0, T / 2)
	hinge.rotation.y = DOOR["swing"]
	walls["front"].add_child(hinge)
	Paper.box(hinge, Vector3(DOOR["leaf"], DOOR["h"] - 0.04, 0.04), Vector3(DOOR["leaf"] / 2.0, 0, 0.02), Paper.mat(C["card_deep"], "satin"))
	Paper.cyl(hinge, 0.025, 0.025, 0.05, Vector3(0.86, 1.0, 0.06), Paper.mat(C["steel"], "metal")).rotation.x = PI / 2

	var clock := _wall_clock()
	clock.position = Vector3(2.0, 2.0, T / 2 + 0.005)
	walls["back"].add_child(clock)

	var board := _pinboard()
	board.position = Vector3(1.4, 1.0, T / 2 + 0.02)
	walls["left"].add_child(board)

	Posters.hang_wall_art(walls["front"], walls["left"], T)
	_build_ceiling()
	_build_hall()


# ---- Floor ----

func _build_base() -> void:
	var W: float = ROOM["W"]
	var D: float = ROOM["D"]
	var side := Paper.mat(C["kraft"])
	Paper.box(self, Vector3(W + 0.5, 0.3, D + 0.5), Vector3(0, -0.305, 0), side)  # just under the floor: no z-fighting
	# The gridded paper floor: one tile texture, repeated a metre at a time.
	var tex := Paper.image_texture(256, 256, func(img: Image):
		img.fill(Color8(0xf2, 0xec, 0xdf))
		var rng := RandomNumberGenerator.new()
		rng.seed = 11
		for y in 256:
			for x in 256:
				var n := (rng.randf() - 0.5) * 0.04
				var c := img.get_pixel(x, y)
				img.set_pixel(x, y, Color(c.r + n, c.g + n, c.b + n))
		var line := Color(0.63, 0.7, 0.7, 0.55)
		img.fill_rect(Rect2i(0, 0, 256, 2), line)
		img.fill_rect(Rect2i(0, 0, 2, 256), line))
	var floor_mat := StandardMaterial3D.new()
	floor_mat.albedo_texture = tex
	floor_mat.roughness = 0.95
	floor_mat.uv1_scale = Vector3(W, D, 1)
	floor_mat.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC
	var floor_mesh := PlaneMesh.new()
	floor_mesh.size = Vector2(W, D)
	var fl := MeshInstance3D.new()
	fl.mesh = floor_mesh
	fl.material_override = floor_mat
	fl.name = "Floor"
	add_child(fl)
	# The floor darkens a little toward the walls.
	for e in [[Vector3(0, 0.004, -D / 2 + 0.3), Vector2(W, 0.6)], [Vector3(0, 0.004, D / 2 - 0.3), Vector2(W, 0.6)],
			[Vector3(-W / 2 + 0.3, 0.004, 0), Vector2(0.6, D)], [Vector3(W / 2 - 0.3, 0.004, 0), Vector2(0.6, D)]]:
		Paper.contact_shadow(self, e[1].x * 1.6 if e[1].x < 1 else e[1].x, e[1].y * 1.6 if e[1].y < 1 else e[1].y, 0.12, e[0] - Vector3(0, 0.008, 0))


# ---- Zone mats ----

func _jagged_rect(w: float, h: float, seed: int) -> PackedVector2Array:
	var st := [seed * 7919]  # lambdas copy captured locals: keep the state in an array
	var rnd := func() -> float:
		st[0] = (st[0] * 9301 + 49297) % 233280
		return st[0] / 233280.0
	var pts := PackedVector2Array()
	var corners := [Vector2(-w / 2, -h / 2), Vector2(w / 2, -h / 2), Vector2(w / 2, h / 2), Vector2(-w / 2, h / 2)]
	for k in 4:
		var a: Vector2 = corners[k]
		var b: Vector2 = corners[(k + 1) % 4]
		var n := maxi(2, roundi(a.distance_to(b) / 0.35))
		var normal := Vector2(-(b.y - a.y), b.x - a.x).normalized()
		for i in n:
			pts.append(a.lerp(b, float(i) / n) + normal * (rnd.call() - 0.5) * 0.09)
	return pts


func _build_mats() -> void:
	var caveat := load("res://assets/fonts/Caveat-Variable.woff2")
	for i in ZONES.size():
		var z: Dictionary = ZONES[i]
		var r: Array = z["rect"]
		var w: float = r[2] - r[0]
		var d: float = r[3] - r[1]
		var holder := Node3D.new()
		holder.position = Vector3((r[0] + r[2]) / 2.0, 0.003 + i * 0.0006, (r[1] + r[3]) / 2.0)
		holder.rotation.y = z["rot"]
		add_child(holder)
		var flat := Node3D.new()
		flat.rotation.x = -PI / 2
		holder.add_child(flat)
		var mat := Paper.mat(z["color"], "card", { "double": true })
		var m := Paper.polygon(flat, _jagged_rect(w, d, z["seed"]), Vector3.ZERO, mat)
		m.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		# Faint ruled lines across the mat.
		var ruled := Paper.mat(Color(1, 1, 1, 0.32), "card", { "unshaded": false })
		ruled.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		var y := -d / 2 + 0.33
		while y < d / 2 - 0.05:
			Paper.plane(flat, w - 0.06, 0.012, Vector3(0, y, 0.001), ruled)
			y += 0.33
		# The label on the front edge, nearest the camera.
		var label := Label3D.new()
		label.text = z["label"]
		label.font = caveat
		label.font_size = 96
		label.pixel_size = 0.0045
		label.modulate = Color(0.16, 0.157, 0.14, 0.62)
		label.outline_size = 0
		label.shaded = true
		label.double_sided = false
		label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT if z.get("align") == "right" else HORIZONTAL_ALIGNMENT_LEFT
		# Label3D is centred on its position: shift it by half its width.
		var half: float = caveat.get_string_size(z["label"], HORIZONTAL_ALIGNMENT_LEFT, -1, label.font_size).x * label.pixel_size / 2.0
		var lx := w / 2 - 0.24 - half if z.get("align") == "right" else -w / 2 + 0.24 + half
		label.position = Vector3(lx, -d / 2 + 0.3, 0.002)
		label.name = "Label"
		flat.add_child(label)


# ---- Walls ----

func _build_wall(name_: String, length: float, pos: Vector3, rot_y: float, doors: Array, windows: Array) -> void:
	var g := Node3D.new()
	g.name = "Wall_" + name_
	g.position = pos
	g.rotation.y = rot_y
	add_child(g)
	walls[name_] = g
	var H: float = ROOM["HI"]
	var T: float = ROOM["T"]
	var mat := Paper.mat(Color8(0xec, 0xe3, 0xd1))
	# Openings as [x0, x1, y0, y1] in the wall's frame.
	var holes: Array = []
	for d in doors:
		holes.append([d["x"] - d["w"] / 2.0, d["x"] + d["w"] / 2.0, 0.0, minf(d["h"], H - 0.05)])
	for w in windows:
		holes.append([w["x"] - w["w"] / 2.0, w["x"] + w["w"] / 2.0, w["y0"], w["y1"]])
	holes.sort_custom(func(a, b): return a[0] < b[0])
	var x := -length / 2.0
	var pieces: Array = []
	for h in holes:
		if h[0] > x:
			pieces.append([x, h[0], 0.0, H])
		if h[2] > 0.0:
			pieces.append([h[0], h[1], 0.0, h[2]])
		pieces.append([h[0], h[1], h[3], H])
		x = h[1]
	if x < length / 2.0:
		pieces.append([x, length / 2.0, 0.0, H])
	for p in pieces:
		var mi := Paper.box(g, Vector3(p[1] - p[0], p[3] - p[2], T), Vector3((p[0] + p[1]) / 2.0, p[2], 0), mat)
		# Under a ceiling the light comes from above: the walls cast no shadow.
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	for w in windows:
		_window_frame(g, w)
	# Coloured paper skirting strip along the inside.
	Paper.box(g, Vector3(length, 0.08, 0.004), Vector3(0, 0, T / 2 + 0.002), Paper.mat(C["card_deep"]))


func _window_frame(parent: Node3D, win: Dictionary) -> void:
	var T: float = ROOM["T"]
	var frame := Paper.mat(C["white"], "satin")
	var cx: float = win["x"]
	var w: float = win["w"]
	var h: float = win["y1"] - win["y0"]
	var t := 0.05
	var lip := 0.012
	Paper.box(parent, Vector3(w + 0.08, t, T + 0.04), Vector3(cx, win["y0"] - t + lip, 0), frame)
	Paper.box(parent, Vector3(w + 0.08, t, T + 0.02), Vector3(cx, win["y1"] - lip, 0), frame)
	Paper.box(parent, Vector3(t, h, T + 0.02), Vector3(cx - w / 2 - t / 2 + lip, win["y0"], 0), frame)
	Paper.box(parent, Vector3(t, h, T + 0.02), Vector3(cx + w / 2 + t / 2 - lip, win["y0"], 0), frame)
	Paper.box(parent, Vector3(0.035, h, 0.04), Vector3(cx, win["y0"], 0), frame)
	Paper.box(parent, Vector3(w, 0.035, 0.04), Vector3(cx, win["y0"] + h * 0.55, 0), frame)
	if glass_mat == null:
		glass_mat = StandardMaterial3D.new()
		glass_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		glass_mat.albedo_color = Color(0.85, 0.92, 1.0, 0.08)
		glass_mat.roughness = 0.05
		glass_mat.metallic_specular = 0.9
	var pane := Paper.plane(parent, w, h, Vector3(cx, win["y0"] + h / 2, -0.01), glass_mat)
	pane.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF


# ---- Wall decorations ----

func _wall_clock() -> Node3D:
	var g := Node3D.new()
	g.name = "Clock"
	var face := Paper.cyl(g, 0.22, 0.22, 0.03, Vector3(0, 0, 0), Paper.mat(C["white"]), 48)
	face.rotation.x = PI / 2
	face.position = Vector3(0, 0, 0.015)
	var ink := Paper.mat(C["ink"])
	for i in 12:
		var a := TAU * i / 12.0
		var tick := Paper.box(g, Vector3(0.012, 0.045 if i % 3 == 0 else 0.025, 0.004), Vector3.ZERO, ink)
		tick.position = Vector3(sin(a) * 0.18, cos(a) * 0.18, 0.032)
		tick.rotation.z = -a
	var hand := func(length: float, width: float, m: Material) -> Node3D:
		var pivot := Node3D.new()
		pivot.position.z = 0.036
		g.add_child(pivot)
		Paper.box(pivot, Vector3(width, length, 0.006), Vector3(0, -0.02, 0), m)
		return pivot
	_hour_hand = hand.call(0.11, 0.016, ink)
	_minute_hand = hand.call(0.16, 0.01, ink)
	_second_hand = hand.call(0.17, 0.004, Paper.mat(C["coral"]))
	return g


func set_clock(hour: int, minute: int, second: int) -> void:
	if _hour_hand == null:
		return
	var m := minute + second / 60.0
	var h := (hour % 12) + m / 60.0
	_hour_hand.rotation.z = -(h / 12.0) * TAU
	_minute_hand.rotation.z = -(m / 60.0) * TAU
	_second_hand.rotation.z = -(second / 60.0) * TAU


func _pinboard() -> Node3D:
	var g := Node3D.new()
	Paper.box(g, Vector3(1.2, 0.8, 0.03), Vector3.ZERO, Paper.mat(Color8(0xc9, 0xa2, 0x6d)))
	for f in [[0.0, -0.02, 1.26, 0.03], [0.0, 0.79, 1.26, 0.03], [-0.615, 0.0, 0.03, 0.82], [0.615, 0.0, 0.03, 0.82]]:
		Paper.box(g, Vector3(f[2], f[3], 0.045), Vector3(f[0], f[1], 0), Paper.mat(C["white"]))
	for n in [[-0.36, 0.5, C["ochre"], 0.08], [-0.05, 0.56, C["white"], -0.06], [0.3, 0.48, C["mat_coral"], 0.05],
			[-0.3, 0.17, C["mat_blue"], -0.04], [0.08, 0.2, C["mat_sage"], 0.1], [0.38, 0.14, C["white"], -0.08]]:
		var note := Paper.plane(g, 0.2, 0.2, Vector3(n[0], n[1] + 0.1, 0.017), Paper.mat(n[2]))
		note.rotation.z = n[3]
		Paper.sphere(g, 0.012, Vector3(n[0], n[1] + 0.18, 0.03), Paper.mat(C["coral"]), 8)
	return g


# ---- Ceiling and hallway ----

func _build_ceiling() -> void:
	var W: float = ROOM["W"]
	var D: float = ROOM["D"]
	var T: float = ROOM["T"]
	var H: float = ROOM["HI"]
	var c := Paper.box(self, Vector3(W + 2 * T, 0.05, D + 2 * T), Vector3(0, H, 0), Paper.mat(C["white"]))
	c.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	c.name = "Ceiling"
	# Card light panels, two rows of three. Their glow is set by lighting.gd.
	var panel := Paper.mat(C["white"], "card", { "emissive": Color8(0x3a, 0x36, 0x2c), "unique": true })
	panels.append(panel)
	for x in [-3.9, 0.0, 3.9]:
		for z in [-2.0, 2.0]:
			Paper.box(self, Vector3(1.6, 0.05, 0.7), Vector3(x, H - 0.05, z), panel).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF


# The corridor behind the door in the front wall: a closed box, longer than
# any view through the doorway reaches.
func _build_hall() -> void:
	var D: float = ROOM["D"]
	var T: float = ROOM["T"]
	var g := Node3D.new()
	g.name = "Hall"
	add_child(g)
	var door := -float(DOOR["x"])
	var x0 := door - 4.4
	var x1 := door + 3.0
	var length := x1 - x0
	var mid := (x0 + x1) / 2.0
	var d := 1.9
	var h := 2.6
	var t := 0.06
	var z0 := D / 2 + T
	var far := z0 + d
	var wall := Paper.mat(C["card"])
	var white := Paper.mat(C["white"])
	Paper.box(g, Vector3(length, 0.04, d), Vector3(mid, -0.04, z0 + d / 2), Paper.mat(C["card_deep"]))
	Paper.box(g, Vector3(length, t, d), Vector3(mid, h, z0 + d / 2), white)
	Paper.box(g, Vector3(length, h, t), Vector3(mid, 0, far + t / 2), wall)
	Paper.box(g, Vector3(t, h, d), Vector3(x0 - t / 2, 0, z0 + d / 2), wall)
	Paper.box(g, Vector3(t, h, d), Vector3(x1 + t / 2, 0, z0 + d / 2), wall)
	Paper.box(g, Vector3(length, 0.95, 0.012), Vector3(mid, 0, far - 0.006), Paper.mat(C["mat_sage"]))
	Paper.box(g, Vector3(length, 0.045, 0.03), Vector3(mid, 0.95, far - 0.015), white)
	Paper.box(g, Vector3(length, 0.09, 0.02), Vector3(mid, 0, far - 0.02), white)
	Paper.box(g, Vector3(1.0, 0.012, 0.6), Vector3(door, 0, z0 + 0.42), Paper.mat(C["mat_ochre"]))
	Paper.box(g, Vector3(1.1, 0.04, 0.45), Vector3(door, h - 0.04, z0 + d / 2), Paper.mat(C["white"], "card", { "emissive": Color8(0x3a, 0x36, 0x2c) }))
	var hall_light := OmniLight3D.new()
	hall_light.position = Vector3(door, h - 0.3, z0 + d / 2)
	hall_light.light_energy = 0.6
	hall_light.omni_range = 3.5
	g.add_child(hall_light)
	# Another office's door, closed, further along the far wall.
	var other := door + 1.75
	Paper.box(g, Vector3(1.04, 2.12, 0.03), Vector3(other, 0, far - 0.015), white)
	Paper.box(g, Vector3(0.9, 2.05, 0.04), Vector3(other, 0, far - 0.03), Paper.mat(C["card_deep"]))
	Paper.cyl(g, 0.025, 0.025, 0.05, Vector3(other + 0.33, 1.0, far - 0.07), white).rotation.x = PI / 2
	# Opposite the doorway: a picture, with a plant below and to one side.
	var picture := Posters.framed("squares", 0.7, 0.7, 31, C["white"])
	picture.rotation.y = PI
	picture.position = Vector3(door + 0.05, 1.2 + 0.35, far - 0.03)
	g.add_child(picture)
	var plant: Node3D = Furniture.snake_plant()["node"]
	plant.position = Vector3(door - 0.38, 0, far - 0.32)
	plant.rotation.y = 0.6
	g.add_child(plant)
	# Fire extinguisher on its bracket.
	var red := Paper.mat(Color8(0xc8, 0x40, 0x2f))
	var ex := door + 0.85
	Paper.cyl(g, 0.065, 0.065, 0.4, Vector3(ex, 0.75, far - 0.09), red)
	Paper.cyl(g, 0.03, 0.045, 0.07, Vector3(ex, 1.15, far - 0.09), Paper.mat(C["ink"]))
	Paper.box(g, Vector3(0.05, 0.03, 0.12), Vector3(ex, 1.2, far - 0.11), Paper.mat(C["ink"]))
	Paper.box(g, Vector3(0.2, 0.26, 0.012), Vector3(ex, 1.32, far - 0.006), red)
	Paper.no_shadows(g)
