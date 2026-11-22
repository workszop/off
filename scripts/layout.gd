## Where everything stands in the room, and the walkable floor that results.
## Pure data plus the nav grid and spots built from it, so the tests can run
## the simulation without building a single mesh.
##
## The 12 m x 8 m room's back wall is at z = -4; rotation is about Y and 0
## faces the front of the room (+Z).
extends RefCounted

const NavGrid := preload("res://scripts/nav_grid.gd")

const ROOM := { "W": 12.0, "D": 8.0, "HI": 3.6, "T": 0.12 }
const CHAR_RADIUS := 0.24

# The door in the front wall, in that wall's own coordinates (x along the
# wall, mirrored in the room: the door stands at room x = -2). The leaf is
# hinged on one side and stands open into the room at `swing` radians.
const DOOR := { "x": 2.0, "w": 1.0, "h": 2.1, "leaf": 0.96, "swing": -1.2 }

# type, x, z, rotation
const LAYOUT := [
	# Focus corner (back left): desk under the window, printer and cabinet beside it.
	["desk_cluster", -3.9, -3.05, 0.0],
	["office_chair", -5.2, -2.1, PI - 0.5],
	["filing_cabinet", -2.3, -3.6, 0.0],
	["printer", -1.65, -3.55, 0.0],
	["plant_snake", -5.55, -3.55, 0.0],
	# Coffee nook (back right): counter on the right wall, cafe table in front.
	["coffee_station", 5.6, -2.55, -PI / 2],
	["table_cafe", 3.85, -2.25, 0.0],
	["plant_snake", 1.0, -3.6, 1.2],
	# Thinking wall (front left): whiteboard on the left wall, standing table.
	["whiteboard", -5.15, 1.15, PI / 2 - 0.55],
	["table_cafe", -3.75, 1.45, 0.0],
	["boxes_stack", -5.35, 3.4, 0.25],
	["plant_snake", -1.0, 3.55, 0.8],
	# Soft landing (front right): sofa facing the room, armchair angled in, arc lamp.
	["couch_2seater", 3.45, 1.25, 0.0],
	["armchair", 5.25, 2.35, -1.0],
	["lamp_arc_big", 2.05, 0.95, 0.0],
	["plant_snake", 5.55, 3.55, 2.1],
]

static func _face_to(x: float, z: float) -> float:
	return atan2(-x, -z)

# Footprint [x0, z0, x1, z1] (local floor rectangle that blocks walking) and
# spots (local places a character stands to use the piece).
static func spec(type: String) -> Dictionary:
	match type:
		"desk_cluster": return { "footprint": [-1.0, -0.43, 0.7, 1.03], "spots": [[-0.5, 0.62, PI], [-0.3, 0.8, PI / 2]] }
		"office_chair": return { "footprint": [-0.28, -0.28, 0.28, 0.28], "spots": [] }
		"printer": return { "footprint": [-0.31, -0.25, 0.31, 0.27], "spots": [[0.0, 0.62, PI]] }
		"filing_cabinet": return { "footprint": [-0.25, -0.29, 0.25, 0.33], "spots": [[0.0, 0.68, PI]] }
		"coffee_station": return { "footprint": [-0.78, -0.32, 0.78, 0.32], "spots": [[-0.4, 0.72, PI], [0.35, 0.72, PI]] }
		"table_cafe": return { "footprint": [-0.42, -0.42, 0.42, 0.42], "spots": [[-0.7, 0.25, _face_to(-0.7, 0.25)], [0.68, 0.3, _face_to(0.68, 0.3)], [0.05, 0.72, _face_to(0.05, 0.72)]] }
		"whiteboard": return { "footprint": [-0.76, -0.3, 0.76, 0.3], "spots": [[0.0, 0.8, PI], [-0.5, 0.85, PI - 0.3]] }
		"couch_2seater": return { "footprint": [-0.86, -0.42, 0.86, 0.42], "spots": [[-0.4, 0.72, 0.0], [0.4, 0.72, 0.0]] }
		"armchair": return { "footprint": [-0.48, -0.42, 0.48, 0.42], "spots": [[0.0, 0.72, 0.0]] }
		"lamp_arc_big": return { "footprint": [-0.22, -0.22, 0.22, 0.22], "spots": [] }
		"plant_snake": return { "footprint": [-0.22, -0.22, 0.22, 0.22], "spots": [] }
		"boxes_stack": return { "footprint": [-0.33, -0.28, 0.33, 0.28], "spots": [] }
	return { "footprint": [0.0, 0.0, 0.0, 0.0], "spots": [] }


## Local (x, z) on a piece rotated by `rot` and placed at (px, pz), to room space.
static func to_room(px: float, pz: float, rot: float, lx: float, lz: float) -> Vector2:
	return Vector2(px + lx * cos(rot) + lz * sin(rot), pz - lx * sin(rot) + lz * cos(rot))


## Where the open door leaf stands on the floor: hinge, then tip.
static func door_leaf() -> Array:
	var hinge := Vector2(-(DOOR["x"] - DOOR["w"] / 2.0), ROOM["D"] / 2.0)
	var tip := Vector2(hinge.x - cos(DOOR["swing"]) * DOOR["leaf"], hinge.y + sin(DOOR["swing"]) * DOOR["leaf"])
	return [hinge, tip]


## { nav, spots, landmarks, first: type -> Vector2 }
static func build() -> Dictionary:
	var W: float = ROOM["W"]
	var D: float = ROOM["D"]
	var nav = NavGrid.new(-W / 2, -D / 2, W / 2, D / 2, 0.2)
	# Keep characters off the walls.
	nav.block_rect(-W / 2, -D / 2, W / 2, -D / 2 + 0.05, CHAR_RADIUS)
	nav.block_rect(-W / 2, D / 2 - 0.05, W / 2, D / 2, CHAR_RADIUS)
	nav.block_rect(-W / 2, -D / 2, -W / 2 + 0.05, D / 2, CHAR_RADIUS)
	nav.block_rect(W / 2 - 0.05, -D / 2, W / 2, D / 2, CHAR_RADIUS)
	# The open door leaf, blocked as a row of small squares.
	var leaf := door_leaf()
	var t := 0.0
	while t <= 1.0:
		var p: Vector2 = leaf[0].lerp(leaf[1], t)
		nav.block_rect(p.x, p.y, p.x, p.y, 0.2)
		t += 0.125
	var spots: Array = []
	var first := {}
	for row in LAYOUT:
		var type: String = row[0]
		var x: float = row[1]
		var z: float = row[2]
		var rot: float = row[3]
		if not first.has(type):
			first[type] = Vector2(x, z)
		var s := spec(type)
		var f: Array = s["footprint"]
		var xs: Array = []
		var zs: Array = []
		for corner in [[f[0], f[1]], [f[2], f[1]], [f[2], f[3]], [f[0], f[3]]]:
			var w := to_room(x, z, rot, corner[0], corner[1])
			xs.append(w.x)
			zs.append(w.y)
		nav.block_rect(xs.min(), zs.min(), xs.max(), zs.max(), CHAR_RADIUS)
		for sp in s["spots"]:
			var w := to_room(x, z, rot, sp[0], sp[1])
			spots.append({ "x": w.x, "z": w.y, "heading": sp[2] + rot, "type": type })
	# Window-gazing spots and the doorway (the free half, beside the open leaf).
	spots.append({ "x": 0.0, "z": -3.3, "heading": PI, "type": "window" })
	spots.append({ "x": 5.2, "z": 0.4, "heading": -PI / 2, "type": "window" })
	spots.append({ "x": -2.3, "z": 3.3, "heading": 0.0, "type": "door" })
	var landmarks := {
		"printer": first["printer"],
		"whiteboard": first["whiteboard"],
		# The lamp's shade hangs 1 m to the side of its base.
		"lamp": first["lamp_arc_big"] + Vector2(1, 0),
	}
	return { "nav": nav, "spots": spots, "landmarks": landmarks, "first": first }
