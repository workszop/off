## Headless tests of the simulation, director and nav grid.
##   godot --headless --script res://tests/test_sim.gd
extends SceneTree

const Layout := preload("res://scripts/layout.gd")
const Sim := preload("res://scripts/sim.gd")
const Data := preload("res://scripts/data.gd")

var failures := 0


func check(ok: bool, what: String) -> void:
	if ok:
		print("  ok   ", what)
	else:
		failures += 1
		printerr("  FAIL ", what)


func make_sim(phase := "midday", seed := 7):
	var lay := Layout.build()
	var rng := RandomNumberGenerator.new()
	rng.seed = seed
	var ph := { "key": phase }
	var sim = Sim.new(lay["nav"], lay["spots"], Data.CAST, func(): return ph["key"], lay["landmarks"], rng)
	return [sim, ph, lay]


func step(sim, seconds: float, fps := 20.0) -> void:
	for i in int(seconds * fps):
		sim.update(1.0 / fps)


func _init() -> void:
	print("data")
	check(Data.topics().size() > 10, "topics compiled")
	check(Data.phase_for_hour(9) == "morning" and Data.phase_for_hour(23) == "night" and Data.phase_for_hour(3) == "night", "phase for hour")
	check(Data.topic_lines()["andy"]["stones"].size() >= 2, "Andy talks about the Stones")

	print("nav")
	var lay := Layout.build()
	var nav = lay["nav"]
	var p: Array = nav.path(Vector2(-4, 0), Vector2(4, 2))
	check(p.size() > 0, "a path crosses the room")
	var clear := true
	var from := Vector2(-4, 0)
	for w in p:
		if not nav.line_of_sight(from, w): clear = false
		from = w
	check(clear, "every leg of the path is walkable")
	check(lay["spots"].size() > 10, "furniture spots are listed")

	print("sim: a day")
	var made = make_sim("midday")
	var sim = made[0]
	var spoke := false
	var walked := false
	var starts := {}
	for c in sim.cast: starts[c.type] = c.pos
	for i in 20 * 240:
		sim.update(0.05)
		for c in sim.cast:
			if c.line != "": spoke = true
			if c.present and c.pos.distance_to(starts[c.type]) > 1.5: walked = true
	check(spoke, "someone speaks")
	check(walked, "someone walks somewhere")
	check(sim.log.size() > 0, "the diary has entries (%d)" % sim.log.size())
	var inside := true
	for c in sim.cast:
		if c.present and (absf(c.pos.x) > 6.0 or absf(c.pos.y) > 4.0): inside = false
	check(inside, "everyone stays in the room")

	print("sim: events")
	if sim.events.current != null: sim.events._finish()
	check(sim.trigger("printerJam"), "the printer can be jammed")
	check(sim.state["printer_jammed"], "the printer is jammed")
	step(sim, 40.0)
	check(not sim.state["printer_jammed"], "the printer gets fixed")
	if sim.events.current != null: sim.events._finish()
	sim.events.next_at = sim.time + 1000.0
	check(sim.drop_donut(Vector2(0, 0)), "a donut can be dropped")
	var wins: int = sim.state["donut_wins"]
	step(sim, 35.0)
	check(sim.state["donut"] == null, "the donut is gone (won: %s)" % str(sim.state["donut_wins"] > wins))
	if sim.events.current != null: sim.events._finish()
	check(sim.tap_glass(), "the glass can be tapped")
	check(not sim.tap_glass(), "...but not twice in a row")

	print("sim: night")
	var ph: Dictionary = made[1]
	ph["key"] = "night"
	step(sim, 200.0)
	var staff_in := 0
	for c in sim.cast:
		if Sim.is_staff(c.type) and c.present: staff_in += 1
	check(staff_in == 0, "the staff go home at night")
	check(sim.find("margo").present, "Margo stays")
	ph["key"] = "morning"
	step(sim, 120.0)
	staff_in = 0
	for c in sim.cast:
		if Sim.is_staff(c.type) and c.present: staff_in += 1
	check(staff_in == 3, "they come back in the morning")

	print("sim: ghost")
	sim.haunt()
	step(sim, 3.0)
	check(sim.ghost.present and sim.ghost.opacity > 0.9, "the ghost materialises")

	print("sim: driving")
	var jazz = sim.find("jazz")
	jazz.chat = null
	jazz.busy = null
	jazz.talking_to_visitor = false
	var before: Vector2 = jazz.pos
	for i in 40:
		sim.drive("jazz", 1.0, 0.0)
		sim.update(0.05)
	sim.drive("")
	check(jazz.pos.distance_to(before) > 0.2 or jazz.speed == 0.0, "the visitor can walk Jazz about")

	print("director")
	var Director := preload("res://scripts/director.gd")
	var dr = Director.new(Layout.ROOM)
	var scene := { "aspect": 1.6, "star": "", "cast": [], "events": {} }
	for c in sim.cast:
		scene["cast"].append({ "type": c.type, "x": c.pos.x, "z": c.pos.y, "heading": c.heading, "present": c.present, "visible": c.opacity > 0.5,
			"speaking": c.line != "", "line_seq": c.line_seq, "chat": c.chat["id"] if c.chat != null else 0, "with_visitor": false })
	var shot: Dictionary = dr.update(scene, 0.1)
	var b: Dictionary = dr.bounds
	var pos: Vector3 = shot["pos"]
	check(absf(pos.x) <= b["x"] + 0.01 and absf(pos.z) <= b["z"] + 0.01, "the director keeps the camera in the room")

	print("")
	if failures:
		printerr("%d check(s) failed" % failures)
	else:
		print("all checks passed")
	quit(1 if failures else 0)
