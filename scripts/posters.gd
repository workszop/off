## Wall art for the two walls without windows: the door wall and the
## pinboard wall. Every picture is painted here, into an Image, in the
## manner of a familiar kind of modern art (grid and primaries, drip
## painting, op art, nested squares), plus three office charts.
##
## Each picture has its own seeded random numbers, so it is the same picture
## on every visit and painting it never disturbs the simulation's seed.
##
##   Posters.framed("grid", 1.0, 1.0, 12, Paper.C.ink)   # centred, faces +Z
##   Posters.hang_wall_art(front_wall, left_wall, 0.12)
extends RefCounted

const Paper := preload("res://scripts/paper.gd")

const PAINTINGS := ["grid", "drips", "op", "squares"]
const KINDS := ["grid", "drips", "op", "bulge", "squares", "bars", "lines", "pie"]
const PX_PER_M := 220.0
const INK := Color8(0x29, 0x28, 0x24)
const CREAM := Color8(0xf6, 0xf1, 0xe4)
const SHEET := Color8(0xfb, 0xf8, 0xf1)
const CAVEAT := "res://assets/fonts/Caveat-Variable.woff2"

# Where each picture hangs: the wall, the room coordinate along it (x on the
# door wall, z on the pinboard wall), the height of its bottom edge, its size
# and what is painted on it.
const HANGING := [
	# Door wall, left to right as seen from inside the room.
	{ "wall": "front", "at": 4.75, "y": 1.2, "w": 0.8, "h": 0.8, "kind": "squares", "seed": 5, "frame": "white" },
	{ "wall": "front", "at": 3.15, "y": 1.1, "w": 1.0, "h": 1.0, "kind": "bulge", "seed": 4, "frame": "ink" },
	{ "wall": "front", "at": 1.55, "y": 0.95, "w": 0.9, "h": 1.25, "kind": "op", "seed": 3, "frame": "ink" },
	{ "wall": "front", "at": -0.1, "y": 1.1, "w": 1.0, "h": 1.0, "kind": "grid", "seed": 12, "frame": "ink" },
	{ "wall": "front", "at": -4.25, "y": 1.05, "w": 1.7, "h": 1.05, "kind": "drips", "seed": 7, "frame": "white" },
	# Pinboard wall: the charts, either side of the whiteboard.
	{ "wall": "left", "at": -3.15, "y": 1.25, "w": 0.95, "h": 0.7, "kind": "bars", "seed": 21, "frame": "white" },
	{ "wall": "left", "at": 0.05, "y": 1.3, "w": 0.95, "h": 0.7, "kind": "lines", "seed": 22, "frame": "white" },
	{ "wall": "left", "at": 2.55, "y": 1.2, "w": 0.8, "h": 0.8, "kind": "pie", "seed": 23, "frame": "white" },
]

const TITLES := { "bars": "coffee per day", "lines": "focus vs meetings", "pie": "where the day goes" }


# ---- Fast raster helpers (native fill_rect spans, no per-pixel blending) ----

static func _rect(img: Image, x: float, y: float, w: float, h: float, c: Color) -> void:
	var r := Rect2i(int(x), int(y), int(ceil(w)), int(ceil(h))).intersection(Rect2i(0, 0, img.get_width(), img.get_height()))
	if r.size.x > 0 and r.size.y > 0:
		img.fill_rect(r, c)


static func _stroke_rect(img: Image, x: float, y: float, w: float, h: float, lw: float, c: Color) -> void:
	_rect(img, x - lw / 2, y - lw / 2, w + lw, lw, c)
	_rect(img, x - lw / 2, y + h - lw / 2, w + lw, lw, c)
	_rect(img, x - lw / 2, y - lw / 2, lw, h + lw, c)
	_rect(img, x + w - lw / 2, y - lw / 2, lw, h + lw, c)


## A filled polygon, by scanline spans.
static func _poly(img: Image, pts: PackedVector2Array, c: Color) -> void:
	if pts.size() < 3:
		return
	var y0 := INF
	var y1 := -INF
	for p in pts:
		y0 = minf(y0, p.y)
		y1 = maxf(y1, p.y)
	for y in range(maxi(0, int(y0)), mini(img.get_height() - 1, int(y1)) + 1):
		var sy := y + 0.5
		var xs: Array = []
		for i in pts.size():
			var a := pts[i]
			var b := pts[(i + 1) % pts.size()]
			if (a.y <= sy and b.y > sy) or (b.y <= sy and a.y > sy):
				xs.append(a.x + (sy - a.y) / (b.y - a.y) * (b.x - a.x))
		xs.sort()
		for k in range(0, xs.size() - 1, 2):
			_rect(img, xs[k], y, xs[k + 1] - xs[k], 1, c)


static func _disc(img: Image, cx: float, cy: float, r: float, c: Color) -> void:
	for dy in range(int(-r), int(r) + 1):
		var half := sqrt(maxf(0.0, r * r - dy * dy))
		_rect(img, cx - half, cy + dy, half * 2.0, 1, c)


static func _line(img: Image, a: Vector2, b: Vector2, w: float, c: Color) -> void:
	var n := maxi(1, int(a.distance_to(b) / maxf(1.0, w * 0.5)))
	for i in n + 1:
		var p := a.lerp(b, float(i) / n)
		_rect(img, p.x - w / 2, p.y - w / 2, w, w, c)


# ---- Paintings ----

## Black grid, a few panes in red, yellow and blue.
static func _grid(img: Image, w: float, h: float, rnd: RandomNumberGenerator) -> void:
	var panes: Array = [Rect2(0, 0, w, h)]
	for i in 10:
		panes.sort_custom(func(a, b): return a.get_area() > b.get_area())
		var p: Rect2 = panes.pop_front()
		var t := 0.3 + rnd.randf() * 0.4
		if p.size.x > p.size.y:
			panes.append(Rect2(p.position, Vector2(p.size.x * t, p.size.y)))
			panes.append(Rect2(p.position + Vector2(p.size.x * t, 0), Vector2(p.size.x * (1 - t), p.size.y)))
		else:
			panes.append(Rect2(p.position, Vector2(p.size.x, p.size.y * t)))
			panes.append(Rect2(p.position + Vector2(0, p.size.y * t), Vector2(p.size.x, p.size.y * (1 - t))))
	panes.sort_custom(func(a, b): return a.get_area() < b.get_area())
	var colours := [Color8(0xd2, 0x40, 0x2f), Color8(0x2c, 0x5a, 0x9c), Color8(0xe9, 0xc5, 0x3a), INK, Color8(0xd2, 0x40, 0x2f)]
	var pick := [2, 4, 6, 0, 8]
	img.fill(CREAM)
	for n in pick.size():
		var p: Rect2 = panes[pick[n]]
		_rect(img, p.position.x, p.position.y, p.size.x, p.size.y, colours[n])
	for p in panes:
		_stroke_rect(img, p.position.x, p.position.y, p.size.x, p.size.y, w * 0.024, INK)


## Drip painting: layers of thrown, looping lines and spatter.
static func _drips(img: Image, w: float, h: float, rnd: RandomNumberGenerator) -> void:
	img.fill(Color8(0xe6, 0xdc, 0xc4))
	var layers := [[INK, 22], [Color8(0xf8, 0xf4, 0xea), 20], [Color8(0xc8, 0x95, 0x2c), 14], [Color8(0x3d, 0x6f, 0x73), 12], [INK, 16], [Color8(0xf8, 0xf4, 0xea), 10]]
	for layer in layers:
		var colour: Color = layer[0]
		for i in layer[1]:
			var p := Vector2(rnd.randf() * w, rnd.randf() * h)
			var dir := rnd.randf() * TAU
			var width := 1.0 + rnd.randf() * rnd.randf() * w * 0.012
			for step in 26:
				dir += (rnd.randf() - 0.5) * 1.5
				var length := w * (0.02 + rnd.randf() * 0.06)
				var q := p + Vector2(cos(dir), sin(dir)) * length
				width = maxf(0.8, width + (rnd.randf() - 0.5) * 2.0)
				var ctrl := p + Vector2(rnd.randf() - 0.5, rnd.randf() - 0.5) * length
				var prev := p
				for k in range(1, 5):
					var t := k / 4.0
					var pt := p.lerp(ctrl, t).lerp(ctrl.lerp(q, t), t)
					_line(img, prev, pt, width, colour)
					prev = pt
				if rnd.randf() < 0.3:
					_disc(img, q.x + (rnd.randf() - 0.5) * length * 2.0, q.y + (rnd.randf() - 0.5) * length * 2.0, 0.6 + rnd.randf() * width * 1.3, colour)
				p = q


## Op art: black and white bands that ripple down the sheet.
static func _waves(img: Image, w: float, h: float) -> void:
	img.fill(CREAM)
	var bands := 30
	var bw := w / bands
	var amp := bw * 1.6
	var edge := func(i: int, y: float) -> float:
		return i * bw + amp * sin((y / h) * PI * 3.0 + i * 0.42) * sin((y / h) * PI)
	for i in range(-2, bands + 2, 2):
		var pts := PackedVector2Array()
		var y := 0.0
		while y <= h:
			pts.append(Vector2(edge.call(i, y), y))
			y += 4.0
		y = h
		while y >= 0.0:
			pts.append(Vector2(edge.call(i + 1, y), y))
			y -= 4.0
		_poly(img, pts, INK)


## Op art: a chequerboard that swells into a sphere in the middle.
static func _bulge(img: Image, w: float, h: float) -> void:
	img.fill(CREAM)
	var n := 18
	var cx := w / 2
	var cy := h / 2
	var R := minf(w, h) * 0.46
	var warp := func(x: float, y: float) -> Vector2:
		var dx := x - cx
		var dy := y - cy
		var r := sqrt(dx * dx + dy * dy) / R
		if r >= 1.0:
			return Vector2(x, y)
		var k := pow(r, 0.6) / r if r > 1e-6 else 0.0
		return Vector2(cx + dx * k, cy + dy * k)
	var cw := w / n
	var ch := h / n
	var sub := 4
	for j in n:
		for i in n:
			if (i + j) % 2:
				continue
			var near := Vector2((i + 0.5) * cw - cx, (j + 0.5) * ch - cy).length() / R
			var colour := Color8(0xc9, 0x50, 0x2f) if near < 0.55 else (Color8(0x3b, 0x3f, 0x7a) if near < 1.0 else INK)
			var pts := PackedVector2Array()
			for s in sub: pts.append(warp.call((i + float(s) / sub) * cw, j * ch))
			for s in sub: pts.append(warp.call((i + 1) * cw, (j + float(s) / sub) * ch))
			for s in sub: pts.append(warp.call((i + 1 - float(s) / sub) * cw, (j + 1) * ch))
			for s in sub: pts.append(warp.call(i * cw, (j + 1 - float(s) / sub) * ch))
			_poly(img, pts, colour)


## Nested squares, each sitting a little low in the one around it.
static func _squares(img: Image, w: float, h: float) -> void:
	var colours := [Color8(0xd9, 0xa4, 0x41), Color8(0xe4, 0xbd, 0x62), Color8(0xc9, 0x76, 0x2f), Color8(0x9f, 0x45, 0x27)]
	for i in colours.size():
		var inset := i * w * 0.115
		_rect(img, inset, inset * 1.45, w - inset * 2, h - inset * 2, colours[i])


# ---- Charts ----

static func _chart_sheet(img: Image, w: float, h: float) -> void:
	img.fill(SHEET)
	var y := h * 0.3
	while y < h * 0.86:
		_rect(img, w * 0.1, y, w * 0.84, 1, Color8(0xc8, 0xd2, 0xd0))
		y += h * 0.11
	var lw := maxf(2.0, w * 0.006)
	_rect(img, w * 0.1 - lw / 2, h * 0.24, lw, h * 0.64, INK)
	_rect(img, w * 0.1 - lw / 2, h * 0.88 - lw / 2, w * 0.84, lw, INK)


static func _bars(img: Image, w: float, h: float, rnd: RandomNumberGenerator) -> void:
	_chart_sheet(img, w, h)
	var n := 7
	var slot := (w * 0.8) / n
	for i in n:
		var v := 0.25 + (float(i) / n) * 0.5 + rnd.randf() * 0.2
		_rect(img, w * 0.13 + i * slot, h * 0.88 - v * h * 0.6, slot * 0.62, v * h * 0.6, Paper.C["coral"] if i == n - 1 else Paper.C["blue"])


static func _lines(img: Image, w: float, h: float, rnd: RandomNumberGenerator) -> void:
	_chart_sheet(img, w, h)
	for series in [[Color8(0x5a, 0x5e, 0x9e), 0.25, 0.6], [Paper.C["coral"], 0.75, -0.5]]:
		var pts: Array = []
		for i in 8:
			var v: float = series[1] + series[2] * (i / 7.0) + (rnd.randf() - 0.5) * 0.14
			pts.append(Vector2(w * 0.14 + (i / 7.0) * w * 0.76, h * 0.86 - clampf(v, 0.05, 0.95) * h * 0.58))
		for i in range(1, pts.size()):
			_line(img, pts[i - 1], pts[i], maxf(3.0, w * 0.012), series[0])
		for p in pts:
			_disc(img, p.x, p.y, w * 0.013, series[0])


static func _pie(img: Image, w: float, h: float) -> void:
	img.fill(SHEET)
	var slices := [[0.38, Color8(0x7b, 0xa3, 0x8c)], [0.27, Paper.C["coral"]], [0.2, Paper.C["ochre"]], [0.15, Color8(0x5a, 0x5e, 0x9e)]]
	var c := Vector2(w / 2, h * 0.56)
	var r := minf(w, h) * 0.34
	var a := -PI / 2
	var edges: Array = []
	for s in slices:
		var end: float = a + s[0] * TAU
		var pts := PackedVector2Array([c])
		var steps := maxi(4, int(s[0] * 64))
		for k in steps + 1:
			var t := lerpf(a, end, float(k) / steps)
			pts.append(c + Vector2(cos(t), sin(t)) * r)
		_poly(img, pts, s[1])
		edges.append(a)
		a = end
	for e in edges:
		_line(img, c, c + Vector2(cos(e), sin(e)) * r, w * 0.012, SHEET)
	_disc(img, c.x, c.y, r * 0.45, SHEET)


static func _paint(kind: String, img: Image, w: float, h: float, rnd: RandomNumberGenerator) -> void:
	match kind:
		"grid": _grid(img, w, h, rnd)
		"drips": _drips(img, w, h, rnd)
		"op", "waves": _waves(img, w, h)
		"bulge": _bulge(img, w, h)
		"squares": _squares(img, w, h)
		"bars": _bars(img, w, h, rnd)
		"lines": _lines(img, w, h, rnd)
		"pie": _pie(img, w, h)
		_: img.fill(CREAM)


# ---- Hanging ----

## One framed picture, w x h metres, centred on the node's origin, facing +Z.
static func framed(kind: String, w: float, h: float, seed: int, frame_color: Color) -> Node3D:
	var g := Node3D.new()
	g.name = "WallArt"
	var pw := int(round(w * PX_PER_M))
	var ph := int(round(h * PX_PER_M))
	var rnd := RandomNumberGenerator.new()
	rnd.seed = seed
	var tex := Paper.image_texture(pw, ph, func(img: Image): _paint(kind, img, float(pw), float(ph), rnd))
	var rim := 0.035
	Paper.box(g, Vector3(w + rim * 2, h + rim * 2, 0.03), Vector3(0, -h / 2 - rim, 0), Paper.mat(frame_color))
	var m := StandardMaterial3D.new()
	m.albedo_texture = tex
	m.roughness = 0.9
	var sheet := Paper.plane(g, w, h, Vector3(0, 0, 0.017), m)
	sheet.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	# Chart titles are lettered on in handwriting.
	if TITLES.has(kind):
		var label := Label3D.new()
		label.text = TITLES[kind]
		if ResourceLoader.exists(CAVEAT):
			label.font = load(CAVEAT)
		label.font_size = 64
		label.pixel_size = h * 0.11 / 64.0
		label.modulate = INK
		label.outline_size = 0
		label.shaded = true
		label.double_sided = false
		if kind == "pie":
			label.position = Vector3(0, h * 0.4, 0.019)
		else:
			label.horizontal_alignment = HORIZONTAL_ALIGNMENT_LEFT
			label.position = Vector3(-w * 0.42, h * 0.38, 0.019)
		g.add_child(label)
	return g


## Hang the pictures. Each wall node is the wall's own frame (x along the
## wall, y up, +Z into the room); a wall's x runs opposite to the room
## coordinate along it.
static func hang_wall_art(front_wall: Node3D, left_wall: Node3D, wall_thickness: float) -> int:
	for p in HANGING:
		var picture := framed(p["kind"], p["w"], p["h"], p["seed"], Paper.C[p["frame"]])
		picture.position = Vector3(-p["at"], p["y"] + p["h"] / 2.0, wall_thickness / 2.0 + 0.018)
		(front_wall if p["wall"] == "front" else left_wall).add_child(picture)
	return HANGING.size()
