## Paper materials and primitive builders for the paper-craft diorama.
## All positions are metres; for box/cyl the given y is the BOTTOM of the
## shape (as in the old three.js helpers), so a piece can be stacked by
## heights. Every builder adds the mesh to `parent` and returns it.
##
##   Paper.box(parent, Vector3(w, h, d), Vector3(x, y, z), Paper.mat(Paper.C.card))
extends RefCounted

const C := {
	"ink": Color8(0x29, 0x28, 0x24),
	"paper": Color8(0xf4, 0xef, 0xe5),
	"card": Color8(0xef, 0xe6, 0xd3),
	"card_deep": Color8(0xe1, 0xd5, 0xbe),
	"kraft": Color8(0xd9, 0xc3, 0xa0),
	"white": Color8(0xfb, 0xf8, 0xf1),
	"coral": Color8(0xd4, 0x76, 0x5f),
	"blue": Color8(0x7d, 0x93, 0xab),
	"ochre": Color8(0xd7, 0xba, 0x78),
	"sage": Color8(0xa9, 0xbb, 0x9f),
	"leaf": Color8(0x93, 0xa8, 0x8c),
	"screen": Color8(0x39, 0x41, 0x4b),
	"coffee": Color8(0x5a, 0x3b, 0x2a),
	"mat_blue": Color8(0xbd, 0xce, 0xd1),
	"mat_coral": Color8(0xd8, 0xa0, 0x8d),
	"mat_ochre": Color8(0xd7, 0xba, 0x78),
	"mat_sage": Color8(0xb8, 0xc7, 0xaf),
	"steel": Color8(0xca, 0xc6, 0xbd),
}

# Surface finishes: roughness, metallic, specular.
const FINISH := {
	"card": [0.95, 0.0, 0.25],
	"satin": [0.6, 0.0, 0.4],
	"gloss": [0.25, 0.0, 0.6],
	"plastic": [0.4, 0.0, 0.5],
	"metal": [0.35, 0.6, 0.5],
	"fabric": [1.0, 0.0, 0.15],
	"rubber": [0.85, 0.0, 0.2],
	"leaf": [0.7, 0.0, 0.35],
}

static var _cache := {}
static var _grain: Texture2D


## A soft paper-fibre noise texture shared by the card materials.
static func grain() -> Texture2D:
	if _grain == null:
		var n := FastNoiseLite.new()
		n.noise_type = FastNoiseLite.TYPE_SIMPLEX_SMOOTH
		n.frequency = 0.08
		n.fractal_octaves = 3
		var t := NoiseTexture2D.new()
		t.width = 256
		t.height = 256
		t.seamless = true
		t.noise = n
		var ramp := Gradient.new()
		ramp.set_color(0, Color(0.93, 0.93, 0.93))
		ramp.set_color(1, Color(1, 1, 1))
		t.color_ramp = ramp
		_grain = t
	return _grain


## A paper material. Shared for equal arguments unless `unique` is true.
static func mat(color: Color, finish := "card", opts := {}) -> StandardMaterial3D:
	var key := "%s|%s|%s" % [color.to_html(), finish, str(opts)]
	if not opts.get("unique", false) and _cache.has(key):
		return _cache[key]
	var m := StandardMaterial3D.new()
	m.albedo_color = color
	var f: Array = FINISH.get(finish, FINISH["card"])
	m.roughness = f[0]
	m.metallic = f[1]
	m.metallic_specular = f[2]
	if opts.has("map"):
		m.albedo_texture = opts["map"]
	elif finish == "card" or finish == "fabric" or finish == "satin":
		m.albedo_texture = grain()
		m.uv1_triplanar = true
		m.uv1_scale = Vector3(0.7, 0.7, 0.7)
	if opts.has("emissive"):
		m.emission_enabled = true
		m.emission = opts["emissive"]
	if opts.get("double", false):
		m.cull_mode = BaseMaterial3D.CULL_DISABLED
	if opts.get("unshaded", false):
		m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	if not opts.get("unique", false):
		_cache[key] = m
	return m


## A glowing material that ignores light (bulbs, displays).
static func glow(color: Color) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.albedo_color = color
	return m


static func _add(parent: Node3D, mesh: Mesh, material: Material, pos: Vector3) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = material
	mi.position = pos
	parent.add_child(mi)
	return mi


## A box with its bottom at pos.y.
static func box(parent: Node3D, size: Vector3, pos: Vector3, material: Material) -> MeshInstance3D:
	var m := BoxMesh.new()
	m.size = size
	return _add(parent, m, material, pos + Vector3(0, size.y / 2.0, 0))


## A box with rounded-looking edges (Godot has no rounded box: a box is close
## enough at this scale, slightly inset so the silhouette softens).
static func rbox(parent: Node3D, size: Vector3, pos: Vector3, material: Material, _radius := 0.05) -> MeshInstance3D:
	return box(parent, size, pos, material)


## A cylinder (or cone section) with its bottom at pos.y.
static func cyl(parent: Node3D, r_top: float, r_bottom: float, h: float, pos: Vector3, material: Material, segments := 28) -> MeshInstance3D:
	var m := CylinderMesh.new()
	m.top_radius = r_top
	m.bottom_radius = r_bottom
	m.height = h
	m.radial_segments = segments
	m.rings = 1
	return _add(parent, m, material, pos + Vector3(0, h / 2.0, 0))


## A rod from a to b.
static func rod(parent: Node3D, a: Vector3, b: Vector3, radius: float, material: Material) -> MeshInstance3D:
	var dir := b - a
	var m := CylinderMesh.new()
	m.top_radius = radius
	m.bottom_radius = radius
	m.height = dir.length()
	m.radial_segments = 10
	m.rings = 1
	var mi := _add(parent, m, material, a + dir * 0.5)
	if dir.length() > 0.0:
		mi.quaternion = Quaternion(Vector3.UP, dir.normalized())
	return mi


static func sphere(parent: Node3D, r: float, pos: Vector3, material: Material, segments := 16) -> MeshInstance3D:
	var m := SphereMesh.new()
	m.radius = r
	m.height = r * 2.0
	m.radial_segments = segments
	m.rings = maxi(4, segments / 2)
	return _add(parent, m, material, pos)


## A torus lying in the XZ plane (rotate it to stand it up).
static func torus(parent: Node3D, ring: float, tube: float, pos: Vector3, material: Material) -> MeshInstance3D:
	var m := TorusMesh.new()
	m.inner_radius = ring - tube
	m.outer_radius = ring + tube
	m.rings = 24
	m.ring_segments = 10
	return _add(parent, m, material, pos)


## A flat plane facing +Z, centred on pos.
static func plane(parent: Node3D, w: float, h: float, pos: Vector3, material: Material) -> MeshInstance3D:
	var m := QuadMesh.new()
	m.size = Vector2(w, h)
	return _add(parent, m, material, pos)


## A lathe: profile points (Vector2 radius, y) turned round the Y axis.
static func lathe(parent: Node3D, profile: Array, pos: Vector3, material: Material, segments := 32) -> MeshInstance3D:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for i in segments:
		var a0 := TAU * i / segments
		var a1 := TAU * (i + 1) / segments
		for k in profile.size() - 1:
			var p: Vector2 = profile[k]
			var q: Vector2 = profile[k + 1]
			var v00 := Vector3(sin(a0) * p.x, p.y, cos(a0) * p.x)
			var v01 := Vector3(sin(a1) * p.x, p.y, cos(a1) * p.x)
			var v10 := Vector3(sin(a0) * q.x, q.y, cos(a0) * q.x)
			var v11 := Vector3(sin(a1) * q.x, q.y, cos(a1) * q.x)
			var v0 := float(k) / (profile.size() - 1)
			var v1 := float(k + 1) / (profile.size() - 1)
			var u0 := float(i) / segments
			var u1 := float(i + 1) / segments
			for tri in [[v00, Vector2(u0, v0), v10, Vector2(u0, v1), v11, Vector2(u1, v1)], [v00, Vector2(u0, v0), v11, Vector2(u1, v1), v01, Vector2(u1, v0)]]:
				for j in 3:
					st.set_uv(tri[j * 2 + 1])
					st.add_vertex(tri[j * 2])
	st.generate_normals()
	return _add(parent, st.commit(), material, pos)


## A filled 2D polygon (local XY plane, facing +Z).
static func polygon(parent: Node3D, points: PackedVector2Array, pos: Vector3, material: Material, uv_scale := 1.0) -> MeshInstance3D:
	var idx := Geometry2D.triangulate_polygon(points)
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	st.set_normal(Vector3(0, 0, 1))
	# Triangulation winds clockwise or counter-clockwise depending on the
	# input; emit both faces so the scrap shows from its front either way.
	for k in range(0, idx.size(), 3):
		for j in [0, 2, 1]:
			var p := points[idx[k + j]]
			st.set_uv(p / uv_scale)
			st.add_vertex(Vector3(p.x, p.y, 0))
	st.generate_normals()
	var mi := _add(parent, st.commit(), material, pos)
	return mi


## A torn collage scrap of coloured paper, in its local XY plane.
## rotation is an Euler XYZ in radians, as in the old helpers.
static func patch(parent: Node3D, w: float, h: float, color: Color, pos: Vector3, rotation := Vector3.ZERO, seed := 1) -> MeshInstance3D:
	var s := seed * 9301
	var rnd := func() -> float:
		s = (s * 9301 + 49297) % 233280
		return s / 233280.0
	var pts := PackedVector2Array()
	var n := 7
	for i in n: pts.append(Vector2(-w / 2 + w * i / n, -h / 2 + (rnd.call() - 0.5) * h * 0.08))
	for i in n: pts.append(Vector2(w / 2 + (rnd.call() - 0.5) * w * 0.08, -h / 2 + h * i / n))
	for i in n: pts.append(Vector2(w / 2 - w * i / n, h / 2 + (rnd.call() - 0.5) * h * 0.08))
	for i in n: pts.append(Vector2(-w / 2 + (rnd.call() - 0.5) * w * 0.08, h / 2 - h * i / n))
	var mi := polygon(parent, pts, pos, mat(color, "card", { "double": true }), 0.5)
	mi.rotation_order = EULER_ORDER_XYZ
	mi.rotation = rotation
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	return mi


## A soft dark blob on the floor under something (rectangular, faded edges).
static func contact_shadow(parent: Node3D, w: float, d: float, opacity := 0.3, pos := Vector3.ZERO) -> MeshInstance3D:
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.albedo_texture = blob_texture()
	m.albedo_color = Color(0.24, 0.18, 0.12, opacity)
	m.depth_draw_mode = BaseMaterial3D.DEPTH_DRAW_DISABLED
	var q := PlaneMesh.new()
	q.size = Vector2(w, d)
	var mi := _add(parent, q, m, pos + Vector3(0, 0.008, 0))
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	return mi


static var _blob: Texture2D

## A radial white-to-clear blob.
static func blob_texture() -> Texture2D:
	if _blob == null:
		var g := Gradient.new()
		g.set_color(0, Color(1, 1, 1, 1))
		g.set_color(1, Color(1, 1, 1, 0))
		var t := GradientTexture2D.new()
		t.gradient = g
		t.fill = GradientTexture2D.FILL_RADIAL
		t.fill_from = Vector2(0.5, 0.5)
		t.fill_to = Vector2(1.0, 0.5)
		t.width = 128
		t.height = 128
		_blob = t
	return _blob


## A texture drawn into an Image by `draw.call(image)`.
static func image_texture(w: int, h: int, draw: Callable) -> ImageTexture:
	var img := Image.create(w, h, false, Image.FORMAT_RGBA8)
	draw.call(img)
	img.generate_mipmaps()
	return ImageTexture.create_from_image(img)


## Draw a thick line into an Image.
static func img_line(img: Image, a: Vector2, b: Vector2, color: Color, width := 2.0) -> void:
	var n := int(maxf(1.0, a.distance_to(b)))
	var r := int(ceil(width / 2.0))
	for i in n + 1:
		var p := a.lerp(b, float(i) / n)
		for dy in range(-r, r + 1):
			for dx in range(-r, r + 1):
				var x := int(p.x) + dx
				var y := int(p.y) + dy
				if x >= 0 and y >= 0 and x < img.get_width() and y < img.get_height() and dx * dx + dy * dy <= r * r:
					img.set_pixel(x, y, img.get_pixel(x, y).blend(color))


## Disable shadow casting on everything under `node`.
static func no_shadows(node: Node) -> void:
	if node is GeometryInstance3D:
		node.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	for c in node.get_children():
		no_shadows(c)
