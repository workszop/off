## Camera maths for standing in the room (no nodes, so tests can run it).
## The hand-held camera orbits a point but is kept inside the walls: it sits
## on the ray from that point toward where the orbit wants it, between `near`
## metres from the point and the wall the ray reaches.
extends RefCounted

const EYE_FOV := 75.0


## The box the camera may be in: the room less a margin.
static func inside_bounds(room: Dictionary, margin := 0.35) -> Dictionary:
	return { "x": room["W"] / 2.0 - margin, "z": room["D"] / 2.0 - margin, "y0": 0.3, "y1": room["HI"] - 0.2 }


static func _along(pos: float, d: float, lo: float, hi: float) -> float:
	if d > 1e-9:
		return (hi - pos) / d
	if d < -1e-9:
		return (lo - pos) / d
	return INF


## How far a ray from `from` along unit `dir` travels before it leaves the box.
static func reach(from: Vector3, dir: Vector3, b: Dictionary) -> float:
	return maxf(0.0, minf(_along(from.x, dir.x, -b["x"], b["x"]), minf(_along(from.y, dir.y, b["y0"], b["y1"]), _along(from.z, dir.z, -b["z"], b["z"]))))


## Distance from the look-at point to the camera; zoom 0 (closest) .. 1 (at the wall).
static func inside_distance(target: Vector3, off: Vector3, bounds: Dictionary, zoom: float, near := 1.2) -> float:
	var l := off.length()
	if l == 0.0:
		l = 1.0
	var wall := reach(target, off / l, bounds)
	if wall <= near:
		return wall
	return near + (wall - near) * clampf(zoom, 0.0, 1.0)


## Keep the look-at point away from the walls.
static func inset_point(x: float, z: float, bounds: Dictionary, inset := 1.3) -> Vector2:
	return Vector2(clampf(x, -(bounds["x"] - inset), bounds["x"] - inset), clampf(z, -(bounds["z"] - inset), bounds["z"] - inset))


## The view through a character's eyes: { pos, target }.
static func eye_view(type: String, x: float, z: float, heading: float, yaw: float, pitch: float, bob := 0.0) -> Dictionary:
	var y := (0.85 if type == "ghost" else 1.5) + bob
	var a := heading + yaw
	var p := -0.06 + pitch
	var pos := Vector3(x + sin(heading) * 0.12, y, z + cos(heading) * 0.12)
	var ahead := 4.0
	return { "pos": pos, "target": pos + Vector3(sin(a) * cos(p), sin(p), cos(a) * cos(p)) * ahead }
