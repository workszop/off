## Paper-craft furniture: the zine furniture set as 3D card models (cream
## card, blue and coral collage patches). Footprints and use-spots live in
## layout.gd; this file only builds what is seen.
##
## Every builder returns { node: Node3D (origin on the floor at the piece's
## centre, front = +Z), glow: [StandardMaterial3D] screens that light up at
## night, light: OmniLight3D or null, bulb: material or null }.
extends RefCounted

const Paper := preload("res://scripts/paper.gd")
const C := Paper.C


static func _piece(node: Node3D, glow := [], extra := {}) -> Dictionary:
	var out := { "node": node, "glow": glow, "light": null, "bulb": null }
	out.merge(extra, true)
	return out


static func _screen_mat() -> StandardMaterial3D:
	return Paper.mat(C["screen"], "gloss", { "emissive": Color.BLACK, "unique": true })


# ---- Small props ----

static func _mug(parent: Node3D, pos: Vector3, color: Color = C["white"], r := 0.045, h := 0.09) -> Node3D:
	var g := Node3D.new()
	g.position = pos
	parent.add_child(g)
	Paper.cyl(g, r, r * 0.92, h, Vector3.ZERO, Paper.mat(color, "gloss"))
	Paper.cyl(g, r * 0.86, r * 0.86, 0.004, Vector3(0, h - 0.012, 0), Paper.mat(C["coffee"]))
	var handle := Paper.torus(g, h * 0.27, 0.007, Vector3(r + 0.004, h * 0.5, 0), Paper.mat(color, "gloss"))
	handle.rotation.x = PI / 2
	handle.scale = Vector3(1, 1, 0.5)
	return g


static func _laptop(parent: Node3D, pos: Vector3, rot_y: float, glow: Array) -> void:
	var g := Node3D.new()
	g.position = pos
	g.rotation.y = rot_y
	parent.add_child(g)
	Paper.box(g, Vector3(0.34, 0.018, 0.24), Vector3.ZERO, Paper.mat(C["card_deep"], "metal"))
	Paper.box(g, Vector3(0.26, 0.002, 0.1), Vector3(0, 0.018, -0.02), Paper.mat(C["card"]))
	var hinge := Node3D.new()
	hinge.position = Vector3(0, 0.018, -0.12)
	hinge.rotation.x = -0.28
	g.add_child(hinge)
	Paper.box(hinge, Vector3(0.34, 0.22, 0.012), Vector3.ZERO, Paper.mat(C["card_deep"], "metal"))
	var m := _screen_mat()
	Paper.plane(hinge, 0.3, 0.18, Vector3(0, 0.11, 0.0065), m)
	glow.append(m)


# ---- Desk cluster (L-shaped, two laptops) ----

static func desk_cluster() -> Dictionary:
	var g := Node3D.new()
	var top := Paper.mat(C["card"], "satin")
	var leg := Paper.mat(C["card_deep"])
	var glow: Array = []
	Paper.box(g, Vector3(1.7, 0.04, 0.75), Vector3(-0.15, 0.72, -0.05), top)
	Paper.box(g, Vector3(0.7, 0.04, 0.7), Vector3(0.35, 0.72, 0.675), top)
	for p in [Vector2(-0.97, -0.39), Vector2(-0.97, 0.29), Vector2(0.67, -0.39), Vector2(0.03, 1.0), Vector2(0.67, 1.0)]:
		Paper.box(g, Vector3(0.045, 0.72, 0.045), Vector3(p.x, 0, p.y), leg)
	Paper.box(g, Vector3(1.6, 0.34, 0.02), Vector3(-0.15, 0.36, -0.4), leg)
	Paper.box(g, Vector3(0.02, 0.34, 0.62), Vector3(0.68, 0.36, 0.66), leg)
	Paper.patch(g, 0.42, 0.24, C["blue"], Vector3(0.692, 0.53, 0.75), Vector3(0, PI / 2, 0), 3)
	Paper.patch(g, 0.2, 0.3, C["coral"], Vector3(-0.99, 0.4, -0.05), Vector3(0, -PI / 2, 0), 5)
	_laptop(g, Vector3(-0.55, 0.76, -0.12), 0.0, glow)
	_laptop(g, Vector3(0.32, 0.76, 0.7), -PI / 2, glow)
	_mug(g, Vector3(-0.95, 0.76, 0.05))
	Paper.cyl(g, 0.035, 0.035, 0.09, Vector3(0.05, 0.76, -0.25), Paper.mat(C["card"], "gloss"))
	for d in [[0.0, 0.0, C["coral"]], [0.012, 0.008, C["blue"]], [-0.01, 0.006, C["ochre"]]]:
		Paper.rod(g, Vector3(0.05 + d[0], 0.8, -0.25 + d[1]), Vector3(0.05 + d[0] * 2.5, 0.92, -0.25 + d[1] * 2), 0.0045, Paper.mat(d[2]))
	Paper.box(g, Vector3(0.07, 0.008, 0.14), Vector3(0.2, 0.76, 0.42), Paper.mat(C["screen"], "gloss"))
	Paper.box(g, Vector3(0.15, 0.006, 0.2), Vector3(-0.2, 0.76, 0.1), Paper.mat(C["white"]))
	Paper.rod(g, Vector3(-0.24, 0.77, 0.08), Vector3(-0.14, 0.77, 0.16), 0.004, Paper.mat(C["ink"]))
	return _piece(g, glow)


# ---- Office chair ----

static func office_chair() -> Dictionary:
	var g := Node3D.new()
	var dark := Paper.mat(C["screen"], "plastic")
	var seat := Paper.mat(C["blue"], "fabric")
	var steel := Paper.mat(C["steel"], "metal")
	var tyre := Paper.mat(C["screen"], "rubber")
	for i in 5:
		var a := TAU * i / 5.0
		Paper.rod(g, Vector3(0, 0.06, 0), Vector3(sin(a) * 0.27, 0.035, cos(a) * 0.27), 0.015, dark)
		Paper.cyl(g, 0.025, 0.025, 0.035, Vector3(sin(a) * 0.27, 0, cos(a) * 0.27), tyre)
	Paper.cyl(g, 0.025, 0.025, 0.36, Vector3(0, 0.06, 0), steel)
	Paper.rbox(g, Vector3(0.48, 0.08, 0.46), Vector3(0, 0.42, 0), seat)
	var back := Paper.rbox(g, Vector3(0.44, 0.44, 0.07), Vector3(0, 0.52, -0.2), seat)
	back.rotation.x = -0.1
	Paper.rod(g, Vector3(0, 0.46, -0.2), Vector3(0, 0.6, -0.23), 0.02, dark)
	return _piece(g)


# ---- Printer on a stand ----

static func printer() -> Dictionary:
	var g := Node3D.new()
	var glow: Array = []
	Paper.box(g, Vector3(0.62, 0.62, 0.5), Vector3.ZERO, Paper.mat(C["card"]))
	Paper.box(g, Vector3(0.56, 0.5, 0.01), Vector3(0, 0.06, 0.251), Paper.mat(C["card_deep"]))
	Paper.box(g, Vector3(0.1, 0.02, 0.02), Vector3(0.18, 0.5, 0.262), Paper.mat(C["card"]))
	Paper.patch(g, 0.2, 0.3, C["blue"], Vector3(-0.311, 0.3, 0.05), Vector3(0, -PI / 2, 0), 7)
	var body := Node3D.new()   # the machine itself: shudders when jammed
	body.name = "Machine"
	g.add_child(body)
	Paper.rbox(body, Vector3(0.52, 0.24, 0.42), Vector3(0, 0.62, -0.02), Paper.mat(C["white"], "plastic"))
	Paper.rbox(body, Vector3(0.5, 0.035, 0.38), Vector3(0, 0.86, -0.03), Paper.mat(C["card"], "plastic"))
	Paper.box(body, Vector3(0.36, 0.05, 0.012), Vector3(0, 0.66, 0.196), Paper.mat(C["screen"], "plastic"))
	Paper.box(body, Vector3(0.32, 0.012, 0.16), Vector3(0, 0.66, 0.26), Paper.mat(C["card_deep"], "plastic"))
	Paper.box(body, Vector3(0.24, 0.003, 0.15), Vector3(0, 0.673, 0.25), Paper.mat(C["white"]))
	var sheet := Paper.box(body, Vector3(0.22, 0.003, 0.29), Vector3(0, 0.9, -0.12), Paper.mat(C["white"]))
	sheet.rotation.x = 0.55
	var display := _screen_mat()
	Paper.box(body, Vector3(0.11, 0.045, 0.01), Vector3(0.15, 0.78, 0.196), display)
	glow.append(display)
	for x in [0.06, 0.09]:
		Paper.cyl(body, 0.008, 0.008, 0.01, Vector3(x, 0.785, 0.2), Paper.mat(C["card_deep"], "plastic"), 8).rotation.x = PI / 2
	Paper.patch(body, 0.14, 0.12, C["coral"], Vector3(0.261, 0.7, 0.05), Vector3(0, PI / 2, 0), 11)
	return _piece(g, glow, { "machine": body, "display": display })


# ---- Filing cabinet ----

static func filing_cabinet() -> Dictionary:
	var g := Node3D.new()
	var steel := Paper.mat(C["steel"], "metal")
	Paper.box(g, Vector3(0.5, 0.78, 0.58), Vector3.ZERO, Paper.mat(C["card"], "satin"))
	for i in 3:
		var y := 0.05 + i * 0.245
		Paper.box(g, Vector3(0.44, 0.215, 0.018), Vector3(0, y, 0.298), Paper.mat(C["card_deep"], "satin"))
		Paper.box(g, Vector3(0.14, 0.022, 0.03), Vector3(0, y + 0.15, 0.316), steel)
		Paper.box(g, Vector3(0.07, 0.035, 0.004), Vector3(0, y + 0.09, 0.308), Paper.mat(C["white"]))
	Paper.patch(g, 0.2, 0.18, C["coral"], Vector3(-0.12, 0.781, 0.14), Vector3(-PI / 2, 0, 0.2), 13)
	Paper.patch(g, 0.18, 0.4, C["blue"], Vector3(0.251, 0.32, 0.12), Vector3(0, PI / 2, 0), 17)
	return _piece(g)


# ---- Coffee station ----

static func coffee_station() -> Dictionary:
	var g := Node3D.new()
	Paper.box(g, Vector3(1.5, 0.86, 0.6), Vector3.ZERO, Paper.mat(C["card"]))
	Paper.box(g, Vector3(1.56, 0.04, 0.64), Vector3(0, 0.86, 0), Paper.mat(C["kraft"], "satin"))
	Paper.box(g, Vector3(0.7, 0.005, 0.005), Vector3(-0.35, 0.45, 0.302), Paper.mat(C["ink"]))
	Paper.patch(g, 0.42, 0.13, C["blue"], Vector3(-0.5, 0.11, 0.302), Vector3.ZERO, 19)
	Paper.patch(g, 0.28, 0.12, C["coral"], Vector3(0.55, 0.11, 0.302), Vector3.ZERO, 23)
	var m := Node3D.new()
	m.position = Vector3(-0.42, 0.9, -0.06)
	g.add_child(m)
	var steel := Paper.mat(C["steel"], "metal")
	var grip := Paper.mat(C["screen"], "plastic")
	Paper.rbox(m, Vector3(0.42, 0.42, 0.34), Vector3.ZERO, Paper.mat(C["white"], "plastic"))
	Paper.box(m, Vector3(0.4, 0.03, 0.32), Vector3(0, 0.42, 0), steel)
	Paper.box(m, Vector3(0.36, 0.2, 0.08), Vector3(0, 0, 0.21), steel)
	Paper.box(m, Vector3(0.36, 0.08, 0.08), Vector3(0, 0.34, 0.21), steel)
	Paper.cyl(m, 0.04, 0.035, 0.05, Vector3(-0.06, 0.29, 0.22), steel)
	Paper.rod(m, Vector3(-0.06, 0.29, 0.22), Vector3(-0.06, 0.28, 0.38), 0.012, grip)
	for x in [-0.13, 0.11]:
		Paper.cyl(m, 0.028, 0.028, 0.02, Vector3(x, 0.36, 0.25), steel).rotation.x = PI / 2
	Paper.box(m, Vector3(0.1, 0.06, 0.004), Vector3(0.11, 0.24, 0.251), Paper.mat(C["screen"], "gloss"))
	_mug(m, Vector3(-0.06, 0.2, 0.22), C["white"], 0.035, 0.07)
	_mug(g, Vector3(0.05, 0.9, 0.12), C["white"], 0.05, 0.1)
	for i in 4:
		Paper.cyl(g, 0.055, 0.042, 0.075, Vector3(0.48, 0.9 + i * 0.055, -0.02), Paper.mat(C["white"], "gloss"))
	return _piece(g)


# ---- Café table ----

static func cafe_table() -> Dictionary:
	var g := Node3D.new()
	Paper.cyl(g, 0.38, 0.38, 0.035, Vector3(0, 0.72, 0), Paper.mat(C["card"], "satin"), 48)
	for i in 3:
		var a := TAU * i / 3.0 + 0.4
		Paper.rod(g, Vector3(sin(a) * 0.16, 0.72, cos(a) * 0.16), Vector3(sin(a) * 0.33, 0, cos(a) * 0.33), 0.016, Paper.mat(C["steel"], "metal"))
	Paper.cyl(g, 0.075, 0.075, 0.01, Vector3(0.05, 0.755, 0.02), Paper.mat(C["white"], "gloss"))
	_mug(g, Vector3(0.05, 0.765, 0.02), C["white"], 0.035, 0.055)
	Paper.patch(g, 0.3, 0.3, C["blue"], Vector3(-0.15, 0.01, 0.12), Vector3(-PI / 2, 0, 0.5), 29)
	Paper.patch(g, 0.26, 0.24, C["coral"], Vector3(0.22, 0.012, -0.08), Vector3(-PI / 2, 0, -0.3), 31)
	return _piece(g)


# ---- Whiteboard on a mobile stand ----

static var _scribbles: Texture2D

static func _scribble_texture() -> Texture2D:
	if _scribbles == null:
		_scribbles = Paper.image_texture(512, 320, func(img: Image):
			img.fill(Color8(0xfb, 0xfa, 0xf6))
			var ink := Color(0.235, 0.227, 0.212, 0.85)
			var scrawl := func(x: float, y: float, n: int, r: float):
				var prev := Vector2(x, y)
				for i in n:
					var p := Vector2(x + i * 6 + sin(i * 1.7) * r, y + cos(i * 1.3) * r)
					Paper.img_line(img, prev, p, ink, 3)
					prev = p
			scrawl.call(60.0, 70.0, 16, 14.0)
			scrawl.call(330.0, 230.0, 18, 16.0)
			var ring := func(cx: float, cy: float, rx: float, ry: float):
				var prev := Vector2(cx + rx, cy)
				for i in range(1, 41):
					var a := TAU * i / 40.0
					var p := Vector2(cx + cos(a) * rx, cy + sin(a) * ry)
					Paper.img_line(img, prev, p, ink, 3)
					prev = p
			ring.call(410.0, 110.0, 46.0, 32.0)
			ring.call(120.0, 180.0, 22.0, 22.0)
			Paper.img_line(img, Vector2(85, 180), Vector2(155, 180), ink, 3)
			Paper.img_line(img, Vector2(120, 145), Vector2(120, 215), ink, 3)
			Paper.img_line(img, Vector2(180, 260), Vector2(240, 230), ink, 3)
			Paper.img_line(img, Vector2(190, 70), Vector2(250, 92), ink, 3)
			var rng := RandomNumberGenerator.new()
			rng.seed = 5
			for i in 14:
				var p := Vector2(250 + rng.randf() * 40, 150 + rng.randf() * 40)
				Paper.img_line(img, p, p + Vector2(1, 1), ink, 5))
	return _scribbles


static func whiteboard() -> Dictionary:
	var g := Node3D.new()
	var frame := Paper.mat(C["steel"], "metal")
	for x in [-0.72, 0.72]:
		Paper.box(g, Vector3(0.05, 1.72, 0.05), Vector3(x, 0.04, 0), frame)
		Paper.box(g, Vector3(0.06, 0.04, 0.56), Vector3(x, 0.04, 0), frame)
		for z in [-0.25, 0.25]:
			Paper.cyl(g, 0.03, 0.03, 0.02, Vector3(x, 0.02, z), Paper.mat(C["screen"], "rubber"), 12).rotation.z = PI / 2
	Paper.box(g, Vector3(1.36, 0.86, 0.03), Vector3(0, 0.82, 0), Paper.mat(C["white"]))
	Paper.plane(g, 1.34, 0.84, Vector3(0, 1.25, 0.0155), Paper.mat(C["white"], "gloss", { "map": _scribble_texture() }))
	Paper.box(g, Vector3(1.42, 0.03, 0.045), Vector3(0, 1.665, 0), frame)
	Paper.box(g, Vector3(1.42, 0.03, 0.045), Vector3(0, 0.805, 0), frame)
	Paper.box(g, Vector3(0.55, 0.02, 0.08), Vector3(0, 0.82, 0.05), frame)
	var marks := [C["coral"], C["blue"], C["ink"]]
	for i in 3:
		Paper.rod(g, Vector3(-0.15 + i * 0.12, 0.85, 0.06), Vector3(-0.06 + i * 0.12, 0.85, 0.06), 0.008, Paper.mat(marks[i], "plastic"))
	Paper.patch(g, 0.18, 0.22, C["coral"], Vector3(-0.55, 0.95, 0.017), Vector3(0, 0, 0.1), 37)
	return _piece(g)


# ---- Sofa and armchair ----

static func _upholstered(width: float, seats: int, accent_right: bool) -> Node3D:
	var g := Node3D.new()
	var cloth := Paper.mat(C["card"], "fabric")
	var deep := Paper.mat(C["card_deep"], "fabric")
	var accent := Paper.mat(C["coral"], "fabric")
	var half := width / 2.0
	for x in [-half + 0.08, half - 0.08]:
		for z in [-0.33, 0.33]:
			Paper.cyl(g, 0.025, 0.02, 0.08, Vector3(x, 0, z), Paper.mat(C["screen"], "plastic"), 10)
	Paper.rbox(g, Vector3(width - 0.1, 0.24, 0.8), Vector3(0, 0.08, 0), deep)
	Paper.rbox(g, Vector3(width - 0.2, 0.52, 0.2), Vector3(0, 0.3, -0.3), deep)
	var seat_w := (width - 0.42) / seats
	for i in seats:
		var x := -((seats - 1) * seat_w) / 2.0 + i * seat_w
		Paper.rbox(g, Vector3(seat_w - 0.02, 0.15, 0.6), Vector3(x, 0.31, 0.08), cloth)
		Paper.rbox(g, Vector3(seat_w - 0.03, 0.42, 0.17), Vector3(x, 0.43, -0.16), cloth).rotation.x = -0.12
	Paper.rbox(g, Vector3(0.2, 0.56, 0.82), Vector3(-half + 0.1, 0.08, 0), cloth)
	Paper.rbox(g, Vector3(0.2, 0.56, 0.82), Vector3(half - 0.1, 0.08, 0), accent if accent_right else cloth)
	Paper.patch(g, 0.3, 0.26, C["blue"], Vector3(-half - 0.002, 0.38, -0.1), Vector3(0, -PI / 2, 0), 41)
	return g


static func couch() -> Dictionary:
	return _piece(_upholstered(1.72, 2, true))


static func armchair() -> Dictionary:
	return _piece(_upholstered(0.96, 1, true))


# ---- Arc floor lamp ----

static func arc_lamp() -> Dictionary:
	var g := Node3D.new()
	var brass := Paper.mat(C["kraft"], "metal")
	Paper.cyl(g, 0.17, 0.19, 0.045, Vector3.ZERO, brass, 40)
	var curve := Curve3D.new()
	for p in [Vector3(0, 0.04, 0), Vector3(0, 0.9, 0), Vector3(0.05, 1.5, 0), Vector3(0.3, 1.92, 0), Vector3(0.72, 1.98, 0), Vector3(0.98, 1.78, 0)]:
		curve.add_point(p)
	# Catmull-Rom style tangents, then a chain of rods along the curve.
	for i in curve.point_count:
		var a := curve.get_point_position(maxi(0, i - 1))
		var b := curve.get_point_position(mini(curve.point_count - 1, i + 1))
		var t := (b - a) / 6.0
		curve.set_point_in(i, -t)
		curve.set_point_out(i, t)
	var pts := curve.tessellate(5, 2)
	for i in pts.size() - 1:
		Paper.rod(g, pts[i], pts[i + 1], 0.016, brass)
	var shade_mat := Paper.mat(C["card"], "satin", { "double": true })
	Paper.lathe(g, [Vector2(0.19, 0), Vector2(0.15, 0.05), Vector2(0.07, 0.15), Vector2(0.03, 0.17)], Vector3(1.0, 1.6, 0), shade_mat)
	var bulb := Paper.glow(Color8(0xf5, 0xea, 0xd2))
	Paper.sphere(g, 0.045, Vector3(1.0, 1.63, 0), bulb)
	var light := OmniLight3D.new()
	light.light_color = Color8(0xff, 0xc6, 0x6e)
	light.light_energy = 0.0
	light.omni_range = 6.0
	light.omni_attenuation = 1.4
	light.shadow_enabled = true
	light.position = Vector3(1.0, 1.5, 0)
	g.add_child(light)
	Paper.patch(g, 0.22, 0.12, C["blue"], Vector3(0.02, 0.046, 0.04), Vector3(-PI / 2, 0, 0.3), 43)
	return _piece(g, [], { "light": light, "bulb": bulb })


# ---- Snake plant ----

static var _pot_tex: Texture2D

static func snake_plant() -> Dictionary:
	var g := Node3D.new()
	if _pot_tex == null:
		_pot_tex = Paper.image_texture(512, 128, func(img: Image):
			img.fill(Color8(0xf3, 0xec, 0xdf))
			for y in [26, 60, 98]:
				img.fill_rect(Rect2i(0, y - 1, 512, 2), Color8(0x29, 0x28, 0x24))
			var prev := Vector2(0, 80)
			for x in range(0, 513, 4):
				var p := Vector2(x, 80 + sin(x / 18.0) * 8)
				Paper.img_line(img, prev, p, Color8(0xd4, 0x76, 0x5f), 5)
				prev = p
			prev = Vector2(0, 52)
			for x in range(0, 513, 16):
				var p := Vector2(x, 34 if (x / 16) % 2 else 52)
				Paper.img_line(img, prev, p, Color8(0x7d, 0x93, 0xab), 4)
				prev = p)
	var pot_profile := [Vector2(0.001, 0), Vector2(0.15, 0), Vector2(0.165, 0.04), Vector2(0.19, 0.3), Vector2(0.205, 0.34), Vector2(0.19, 0.34)]
	Paper.lathe(g, pot_profile, Vector3.ZERO, Paper.mat(C["white"], "gloss", { "map": _pot_tex }), 40)
	Paper.cyl(g, 0.185, 0.185, 0.01, Vector3(0, 0.31, 0), Paper.mat(C["coffee"]))
	var leaf := Paper.mat(C["leaf"], "leaf", { "double": true })
	for b in [[0.0, 0.85, 0.0, 0.05], [0.9, 0.72, 0.18, 0.06], [2.0, 0.78, 0.2, -0.05], [3.1, 0.66, 0.24, 0.08],
			[4.2, 0.74, 0.16, 0.0], [5.3, 0.62, 0.26, -0.06], [1.5, 0.55, 0.32, 0.1], [3.7, 0.5, 0.34, -0.1]]:
		var w := 0.075
		var h: float = b[1]
		var pts := PackedVector2Array()
		# Left edge up, right edge down: a blade that bulges and comes to a point.
		for i in 11:
			var t := i / 10.0
			pts.append(Vector2(-w / 2 * (1.0 - t) - w * 0.12 * sin(t * PI), h * t))
		for i in range(9, -1, -1):
			var t := i / 10.0
			pts.append(Vector2(w / 2 * (1.0 - t) + w * 0.12 * sin(t * PI), h * t))
		var holder := Node3D.new()
		holder.position.y = 0.3
		holder.rotation_order = EULER_ORDER_YXZ
		holder.rotation = Vector3(-b[2], b[0], b[3])
		g.add_child(holder)
		Paper.polygon(holder, pts, Vector3.ZERO, leaf)
	return _piece(g)


# ---- Stack of boxes ----

static func boxes_stack() -> Dictionary:
	var g := Node3D.new()
	var tape := Paper.mat(C["blue"], "plastic")
	for s in [[0.62, 0.38, 0.5, 0.0, 0.02], [0.52, 0.32, 0.44, 0.38, 0.1], [0.42, 0.28, 0.36, 0.7, -0.08]]:
		var holder := Node3D.new()
		holder.position.y = s[3]
		holder.rotation.y = s[4]
		g.add_child(holder)
		Paper.box(holder, Vector3(s[0], s[1], s[2]), Vector3.ZERO, Paper.mat(C["kraft"]))
		Paper.box(holder, Vector3(0.08, 0.003, s[2] + 0.004), Vector3(0, s[1], 0), tape)
		Paper.box(holder, Vector3(0.08, 0.12, 0.003), Vector3(0, s[1] - 0.12, s[2] / 2 + 0.002), tape)
		Paper.box(holder, Vector3(s[0] * 0.96, 0.003, 0.004), Vector3(0, s[1] + 0.001, 0), Paper.mat(C["ink"]))
	Paper.patch(g, 0.2, 0.16, C["coral"], Vector3(0.2, 0.08, 0.252), Vector3(0, 0, 0.2), 47)
	return _piece(g)


static func build(type: String) -> Dictionary:
	match type:
		"desk_cluster": return desk_cluster()
		"office_chair": return office_chair()
		"printer": return printer()
		"filing_cabinet": return filing_cabinet()
		"coffee_station": return coffee_station()
		"table_cafe": return cafe_table()
		"whiteboard": return whiteboard()
		"couch_2seater": return couch()
		"armchair": return armchair()
		"lamp_arc_big": return arc_lamp()
		"plant_snake": return snake_plant()
		"boxes_stack": return boxes_stack()
	push_error("unknown furniture " + type)
	return _piece(Node3D.new())
