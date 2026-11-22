## The director chooses what the camera shows, so the office can be watched
## like a sitcom. Each frame it is told what is going on and answers with one
## shot: { kind, pos, target, fov, cut, ease }. When `cut` goes up the camera
## jumps; otherwise it glides after the shot at `ease` per second.
##
##  1. Roaming: the camera travels slowly between a handful of places along
##     the front and sides of the room, turning to whatever is going on.
##  2. One conversation in 6 to 12 gets a cut: square on from one side,
##     drifting in, leaning toward whoever is speaking.
##  3. Margo answering a visitor also gets a cut, for as long as that lasts.
##
## The scene it is told about:
##   { aspect, star, cast: [{ type, x, z, heading, present, visible, speaking,
##     line_seq, chat (id, 0 for none), with_visitor }], events: { donut, cake,
##     printer, lamp, meeting, party: Vector2 or null } }
extends RefCounted

const View := preload("res://scripts/view_math.gd")

const EYE := 1.45
const NEAREST := 1.6
const COVER_EVERY := [6, 12]
const CUT_GAP := 8.0
const TRAVEL := 0.3
const DWELL := [14.0, 26.0]
const STAY := 9.0
const BREATHER := 6.0
const URGENT := 4.0
const TURN := 0.7
const ZOOM := 0.45
const LINGER := 1.6
const GLIDE := 0.8
const GLIDE_S := 5.0

const PLACES := [
	Vector3(0, 1.9, 3.45), Vector3(-3.2, 1.8, 3.4), Vector3(3.2, 1.8, 3.4),
	Vector3(-5.2, 2.0, 2.6), Vector3(5.2, 2.0, 2.6),
	Vector3(-5.3, 1.9, 0.2), Vector3(5.3, 1.9, 0.3),
]

var bounds: Dictionary
var clear: Callable
var rng := RandomNumberGenerator.new()
var time := 0.0
var shot := {}
var cuts := 0
var last_cut := -INF
var people: Array = []

var roam := {
	"pos": PLACES[0], "from": PLACES[0], "to": PLACES[0], "t": 1.0, "T": 1.0, "rest_until": 0.0,
	"look": Vector3(0, 1.0, -0.4), "fov": 66.0, "subject": "", "since": 0.0, "free_at": 0.0,
}
var chats_seen := {}
var chats_since := 0
var cover_at := 0
var cover: Variant = null
var visitor: Variant = null
var glide_until := 0.0


func _init(room: Dictionary, a_clear := Callable(), seed := -1) -> void:
	bounds = View.inside_bounds(room)
	clear = a_clear
	if seed >= 0:
		rng.seed = seed
	roam["rest_until"] = _between(DWELL)
	cover_at = _cover_after()


func _between(r: Array) -> float:
	return r[0] + rng.randf() * (r[1] - r[0])


func _cover_after() -> int:
	return COVER_EVERY[0] + int(rng.randf() * (COVER_EVERY[1] - COVER_EVERY[0] + 1))


static func _unit(x: float, z: float) -> Vector2:
	var v := Vector2(x, z)
	return v / v.length() if v.length() > 0.0 else Vector2(0, 1)


static func _smooth(t: float) -> float:
	return t * t * (3.0 - 2.0 * t)


## The widest lens (vertical fov, degrees) that fits a subject at `dist`.
static func fov_to_fit(half_width: float, half_height: float, dist: float, aspect: float) -> float:
	var across := atan(tan(atan(half_width / dist)) / aspect)
	return clampf(2.0 * maxf(across, atan(half_height / dist)) / deg_to_rad(1.0), 22.0, 78.0)


func _crowded(pos: Vector3, r: float) -> bool:
	for c in people:
		if Vector2(c["x"] - pos.x, c["z"] - pos.z).length() < r:
			return true
	return false


func _is_clear(pos: Vector3, target: Vector3) -> bool:
	return clear.call(pos, target) if clear.is_valid() else true


## Stand `dist` from `at` along `dir`, at height y, never outside the room.
func _stand(at: Vector2, dir: Vector2, dist: float, y := EYE) -> Dictionary:
	var room_reach := View.reach(Vector3(at.x, y, at.y), Vector3(dir.x, 0, dir.y), bounds)
	var d := minf(dist, room_reach)
	return { "pos": Vector3(at.x + dir.x * d, y, at.y + dir.y * d), "dist": d }


func _vantage(at: Vector2, dirs: Array, dist: float, look_y: float) -> Vector2:
	var best: Variant = null
	for dir in dirs:
		var s := _stand(at, dir, dist)
		if s["dist"] < NEAREST:
			continue
		if best == null:
			best = dir
		if not _crowded(s["pos"], 1.1) and _is_clear(s["pos"], Vector3(at.x, look_y, at.y)):
			return dir
	return best if best != null else _unit(-at.x if at.x != 0.0 else 0.01, 2.0 - at.y)


func _subjects(scene: Dictionary, here: Array) -> Array:
	var list: Array = []
	var ev: Dictionary = scene.get("events", {})
	var add := func(key: String, rank: float, p, y: float, tight: float):
		if p != null:
			list.append({ "key": key, "rank": rank, "at": Vector3(p.x, y, p.y), "tight": tight })
	add.call("donut", 5.0, ev.get("donut"), 0.5, 2.6)
	add.call("cake", 5.0, ev.get("cake"), 0.9, 2.2)
	add.call("jam", 5.0, ev.get("printer"), 0.9, 2.2)
	add.call("lamp", 5.0, ev.get("lamp"), 1.3, 2.4)
	add.call("meeting", 4.0, ev.get("meeting"), 1.1, 2.8)
	add.call("party", 3.0, ev.get("party"), 1.0, 3.4)
	for c in here:
		if c["type"] == "ghost":
			add.call("ghost", 4.0, Vector2(c["x"], c["z"]), 0.7, 1.6)
		if scene.get("star", "") != "" and c["type"] == scene["star"]:
			add.call("star:" + c["type"], 3.5, Vector2(c["x"], c["z"]), 1.1, 1.6)
	var seen := {}
	for c in here:
		if c["chat"] == 0 or seen.has(c["chat"]):
			continue
		for o in here:
			if o != c and o["chat"] == c["chat"]:
				seen[c["chat"]] = true
				add.call("chat:%d" % c["chat"], 2.0, Vector2((c["x"] + o["x"]) / 2.0, (c["z"] + o["z"]) / 2.0), 1.2, 1.9)
				break
	for c in here:
		if c["speaking"] and c["chat"] == 0:
			add.call("says:" + c["type"], 1.0, Vector2(c["x"], c["z"]), 0.7 if c["type"] == "ghost" else 1.25, 1.5)
	return list


func _roaming(scene: Dictionary, here: Array, dt: float) -> Dictionary:
	if roam["t"] < 1.0:
		roam["t"] = minf(1.0, roam["t"] + dt / roam["T"])
		roam["pos"] = (roam["from"] as Vector3).lerp(roam["to"], _smooth(roam["t"]))
		if roam["t"] == 1.0:
			roam["rest_until"] = time + _between(DWELL)
	elif time >= roam["rest_until"]:
		var options: Array = []
		var look: Vector3 = roam["look"]
		for p in PLACES:
			var d := Vector2(p.x - roam["pos"].x, p.z - roam["pos"].z).length()
			if d > 1.0 and d < 6.5 and Vector2(p.x - look.x, p.z - look.z).length() > 2.5:
				options.append(p)
		if options.size() > 0:
			roam["from"] = roam["pos"]
			roam["to"] = options[int(rng.randf() * options.size())]
			roam["T"] = maxf(4.0, Vector2(roam["to"].x - roam["from"].x, roam["to"].z - roam["from"].z).length() / TRAVEL)
			roam["t"] = 0.0
		else:
			roam["rest_until"] = time + 2.0

	var list := _subjects(scene, here)
	var best: Variant = null
	for s in list:
		if best == null or s["rank"] > best["rank"]:
			best = s
	var on: Variant = null
	if roam["subject"] != "":
		for s in list:
			if s["key"] == roam["subject"]:
				on = s
	if on != null:
		if best["rank"] >= on["rank"] + 1.0 and (best["rank"] >= URGENT or time - roam["since"] > STAY):
			on = best
	else:
		if roam["subject"] != "":
			roam["subject"] = ""
			roam["free_at"] = time + BREATHER
		if best != null and (best["rank"] >= URGENT or time >= roam["free_at"]):
			on = best
	if on != null and on["key"] != roam["subject"]:
		roam["subject"] = on["key"]
		roam["since"] = time

	var goal: Vector3
	var wide := 66.0
	var aspect: float = scene.get("aspect", 1.6)
	if on != null:
		goal = on["at"]
		var d := Vector2(goal.x - roam["pos"].x, goal.z - roam["pos"].z).length()
		wide = clampf(fov_to_fit(on["tight"], 1.25, maxf(d, 2.0), aspect), 36.0, 66.0)
	else:
		var sx := 0.0
		var sz := 0.0
		var n := 0
		for c in here:
			if c["type"] != "ghost":
				sx += c["x"]; sz += c["z"]; n += 1
		n = maxi(n, 1)
		goal = Vector3(sx / n * 0.5, 1.0, sz / n * 0.5 - 0.3)
	if aspect < 0.9:
		wide = minf(84.0, wide * 1.3)
	roam["look"] = (roam["look"] as Vector3).lerp(goal, 1.0 - exp(-dt * TURN))
	roam["fov"] += (wide - roam["fov"]) * (1.0 - exp(-dt * ZOOM))
	return { "kind": "roam", "pos": roam["pos"], "target": roam["look"], "fov": roam["fov"], "on": roam["subject"], "who": [] }


func _covered(scene: Dictionary, a: Dictionary, b: Dictionary) -> Dictionary:
	var mid := Vector2((a["x"] + b["x"]) / 2.0, (a["z"] + b["z"]) / 2.0)
	var apart := Vector2(b["x"] - a["x"], b["z"] - a["z"]).length()
	var aspect: float = scene.get("aspect", 1.6)
	if cover["side"] == null:
		var axis := _unit(b["x"] - a["x"], b["z"] - a["z"])
		var n := Vector2(-axis.y, axis.x)
		var sides := [n, -n]
		sides.sort_custom(func(p, q): return _stand(mid, p, 6.0)["dist"] + p.y * 0.5 > _stand(mid, q, 6.0)["dist"] + q.y * 0.5)
		cover["side"] = _vantage(mid, sides, 3.2, 1.2)
	var half := apart / 2.0 + 0.75
	var closer := 1.0 - 0.18 * _smooth(clampf((time - cover["since"]) / 14.0, 0.0, 1.0))
	var want := clampf(half / tan(deg_to_rad(24.0)) / maxf(1.0, aspect), 2.8, 5.0) * closer
	var s := _stand(mid, cover["side"], maxf(want, NEAREST + 0.4))
	var speaker: Variant = null
	for c in [a, b]:
		if c["speaking"] and (speaker == null or c["line_seq"] > speaker["line_seq"]):
			speaker = c
	var lean := 0.3 if speaker != null else 0.0
	var sp := Vector2(speaker["x"], speaker["z"]) if speaker != null else mid
	var target := Vector3(mid.x + (sp.x - mid.x) * lean, 1.2, mid.y + (sp.y - mid.y) * lean)
	return { "kind": "two", "pos": s["pos"], "target": target, "fov": fov_to_fit(half, 1.05, s["dist"] / closer, aspect), "who": [a["type"], b["type"]] }


func _with_visitor(scene: Dictionary, m: Dictionary) -> Dictionary:
	var at := Vector2(m["x"], m["z"])
	if visitor.get("dir") == null:
		visitor["dir"] = _vantage(at, [Vector2(sin(m["heading"]), cos(m["heading"])), _unit(-m["x"] if m["x"] != 0.0 else 0.01, 2.0 - m["z"])], 2.7, 1.3)
	var s := _stand(at, visitor["dir"], 2.7)
	var half := 21.0 if scene.get("aspect", 1.6) < 0.9 else 16.0
	var fov := clampf(2.0 * atan(tan(deg_to_rad(half)) * 2.7 / maxf(s["dist"], 0.01)) / deg_to_rad(1.0), 24.0, 70.0)
	return { "kind": "visitor", "pos": s["pos"], "target": Vector3(m["x"], 1.3, m["z"]), "fov": fov, "who": ["margo"] }


func _find(list: Array, type: String):
	for c in list:
		if c["type"] == type:
			return c
	return null


func update(scene: Dictionary, dt: float) -> Dictionary:
	time += dt
	var here: Array = scene["cast"].filter(func(c): return c["present"] and c["visible"])
	people = here

	var pairs := {}
	for c in here:
		if c["chat"] != 0:
			if not pairs.has(c["chat"]):
				pairs[c["chat"]] = []
			pairs[c["chat"]].append(c)
	for id in pairs:
		var pair: Array = pairs[id]
		if chats_seen.has(id) or pair.size() < 2:
			continue
		chats_seen[id] = true
		chats_since += 1
		if chats_since >= cover_at and cover == null and visitor == null and time - last_cut >= CUT_GAP:
			cover = { "id": id, "a": pair[0]["type"], "b": pair[1]["type"], "side": null, "since": time, "over": null, "last": null }
			chats_since = 0
			cover_at = _cover_after()
			cuts += 1
			last_cut = time

	var m: Variant = null
	for c in here:
		if c["with_visitor"]:
			m = c
	if m != null and visitor == null:
		visitor = {}
		cover = null
		cuts += 1
		last_cut = time
	if m == null and visitor != null:
		visitor = null
		glide_until = time + GLIDE_S

	var s := _roaming(scene, here, dt)
	if visitor != null:
		s = _with_visitor(scene, m)
	elif cover != null:
		var a: Variant = _find(here, cover["a"])
		var b: Variant = _find(here, cover["b"])
		if pairs.has(cover["id"]) and pairs[cover["id"]].size() == 2 and a != null and b != null:
			cover["last"] = _covered(scene, a, b)
			cover["over"] = null
		elif cover["over"] == null:
			cover["over"] = time
		if cover["last"] == null or (cover["over"] != null and time - cover["over"] > LINGER):
			cover = null
			glide_until = time + GLIDE_S
		else:
			s = cover["last"]

	# Someone has walked up to the camera: lift it over their head.
	var pos: Vector3 = s["pos"]
	if _crowded(pos, 0.9) and pos.y < 2.3:
		pos.y = 2.3
	var ease := 1.5 if s["kind"] != "roam" else (GLIDE if time < glide_until else 3.0)
	shot = { "kind": s["kind"], "pos": pos, "target": s["target"], "fov": s["fov"], "who": s["who"], "on": s.get("on", ""), "cut": cuts, "ease": ease }
	return shot


func chats_to_cut() -> int:
	return maxi(0, cover_at - chats_since)
