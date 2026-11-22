## Office events: things that happen to the whole office. The printer jams, a
## donut turns up, someone calls a meeting, it is somebody's birthday. One
## event runs at a time. Characters taking part are marked `busy`, which stops
## them wandering off or starting other chats until the event lets them go.
##
## Part of the simulation (see sim.gd). What the scene should draw is in
## sim.state: printer_jammed, donut and cake positions (Vector2 or null).
extends RefCounted

const Data := preload("res://scripts/data.gd")

const FIRST_EVENT_S := [50.0, 100.0]
const EVENT_GAP_S := [75.0, 160.0]
const DONUT_REACH := 0.5
const MEETING_REPORTS := [
	"A meeting was held. It could have been an email.",
	"There was a meeting. Margo took notes. Mostly risks.",
	"A meeting happened at the whiteboard. An arrow now points at another arrow.",
]

var sim
var current: Variant = null          # { type, members, update: Callable -> bool, end: Callable }
var next_at := 0.0
var had_birthday := false


func _init(a_sim) -> void:
	sim = a_sim
	next_at = sim.between(FIRST_EVENT_S)


func _now() -> float:
	return sim.time


func _people() -> Array:
	return sim.cast.filter(func(c): return c.type != "ghost" and sim.is_free(c))


static func _near(c, p: Vector2, r: float) -> bool:
	return c.pos.distance_to(p) < r


func _spot(type: String):
	for s in sim.spots:
		if s["type"] == type:
			return s
	return null


func _join(event: Dictionary, c) -> void:
	c.busy = event
	c.spot = null
	c.goal = null
	c.look = null
	c.path = []
	c.dest = { "x": c.pos.x, "z": c.pos.y, "heading": null, "face": null }
	event["members"].append(c)


func _finish() -> void:
	if current == null:
		return
	if current.has("end"):
		current["end"].call()
	for c in current["members"]:
		if not is_same(c.busy, current):
			continue
		c.busy = null
		c.wait = 0.6 + sim.rng.randf() * 2.5
	current = null
	next_at = _now() + sim.between(EVENT_GAP_S) / float(sim.phase_info().get("events", 1.0))


## Stand the members around a point, facing `face` (default: the point).
func _gather(event: Dictionary, members: Array, x: float, z: float, r: float, face = null) -> void:
	if face == null:
		face = { "x": x, "z": z }
	var start: float = sim.rng.randf() * TAU
	for i in members.size():
		var c: Variant = members[i]
		_join(event, c)
		var at: Variant = sim.point_near(x, z, r, start + (float(i) / members.size()) * TAU)
		if at != null:
			sim.send_to(c, at["x"], at["z"], face)
		else:
			c.dest = { "x": c.pos.x, "z": c.pos.y, "heading": null, "face": face }


## A member says a line from a bank, if they are still part of the event.
func _speak(event: Dictionary, c, bank_name: String) -> void:
	if is_same(c.busy, event) and not c.talking_to_visitor:
		sim.say(c, sim.pick_line(c.type, Data.bank(bank_name)))


static func _xz(v: Vector2) -> Dictionary:
	return { "x": v.x, "z": v.y }


# ---- Printer jam ----
# A couple of people gather and complain. Margo says she is not fixing it,
# walks over and fixes it. Without her, it sorts itself out eventually.
func _printer_jam():
	var spot: Variant = _spot("printer")
	if spot == null or sim.state["printer_jammed"]:
		return null
	var started := _now()
	var event := { "type": "printerJam", "members": [] }
	sim.state["printer_jammed"] = true
	sim.record("The printer jammed.", "printer")
	var printer: Vector2 = sim.landmarks.get("printer", Vector2(spot["x"], spot["z"]))
	var margo: Variant = sim.margo
	var fixer: Variant = margo if margo != null and sim.is_free(margo) else null
	var witnesses: Array = sim.shuffled(_people().filter(func(c): return c != fixer), sim.rng).slice(0, 2)
	_gather(event, witnesses, spot["x"], spot["z"], 1.1, _xz(printer))
	for i in witnesses.size():
		var c: Variant = witnesses[i]
		sim.later(1.2 + i * 3.2, func(): _speak(event, c, "PRINTER_JAM_DIALOGUE"))
	var st := { "fix_at": 0.0, "fixed": false }
	if fixer != null:
		_join(event, fixer)
		sim.later(2.4, func():
			if not is_same(fixer.busy, event):
				return
			sim.say(fixer, Data.bank("MARGO_LINES")["printerFix"][0])
			sim.send_to(fixer, spot["x"], spot["z"], _xz(printer)))
	var clear := func(line: String):
		st["fixed"] = true
		sim.state["printer_jammed"] = false
		sim.record(line, "printer")
	event["update"] = func() -> bool:
		var t := _now() - started
		if st["fixed"]:
			return t > st["fix_at"] + 3.0
		if fixer != null and is_same(fixer.busy, event) and not fixer.talking_to_visitor:
			var there: bool = t > 4.0 and fixer.path.is_empty() and _near(fixer, Vector2(spot["x"], spot["z"]), 0.6)
			if st["fix_at"] == 0.0 and (there or t > 24.0):
				st["fix_at"] = t + 2.2
			if st["fix_at"] > 0.0 and t >= st["fix_at"]:
				sim.say(fixer, Data.bank("MARGO_LINES")["printerFix"][1])
				clear.call("Margo fixed the printer. She would like that kept quiet.")
				st["fix_at"] = t
		elif t > 16.0:
			clear.call("The printer un-jammed itself. Nobody trusts it.")
			st["fix_at"] = t
		return false
	event["end"] = func(): sim.state["printer_jammed"] = false
	return event


# ---- Donut race ----
# A donut appears. Everyone who is free goes for it; the first to reach it
# wins and the rest have feelings about that.
func _donut_race(at: Vector2):
	if sim.state["donut"] != null or not sim.nav.free_at(at.x, at.y):
		return null
	var racers: Array = sim.cast.filter(func(c): return sim.is_free(c))
	var started := _now()
	var event := { "type": "donut", "members": [] }
	sim.state["donut"] = at
	for c in racers:
		_join(event, c)
		sim.send_to(c, at.x, at.y)
	var st := { "won_at": 0.0 }
	event["update"] = func() -> bool:
		var t := _now() - started
		if st["won_at"] > 0.0:
			return t > st["won_at"] + 4.5
		var winner: Variant = null
		for c in event["members"]:
			if is_same(c.busy, event) and c.present and _near(c, at, DONUT_REACH):
				winner = c
				break
		if winner != null:
			st["won_at"] = maxf(t, 0.001)
			sim.state["donut"] = null
			sim.state["donut_wins"] += 1
			sim.say(winner, sim.pick_line(winner.type, Data.bank("DONUT_WIN_DIALOGUE")))
			sim.record("%s won the donut race." % Data.display_name(winner.type), "donut")
			var losers: Array = event["members"].filter(func(c): return c != winner and is_same(c.busy, event))
			for i in losers.size():
				var c: Variant = losers[i]
				c.path = []
				c.dest = { "x": c.pos.x, "z": c.pos.y, "heading": null, "face": { "x": winner.pos.x, "z": winner.pos.y } }
				if i < 2:
					sim.later(1.4 + i * 2.2, func(): _speak(event, c, "DONUT_DIALOGUE"))
		else:
			var anyone := false
			for c in event["members"]:
				if is_same(c.busy, event) and c.present:
					anyone = true
			if t > 30.0 or (t > 2.0 and not anyone):
				sim.state["donut"] = null
				sim.record("A donut went uneaten. This has never happened before.", "donut")
				return true
		return false
	event["end"] = func(): sim.state["donut"] = null
	return event


# ---- Birthday ----
# Cake appears next to the birthday person and everyone gathers round.
func _birthday():
	var guests := _people()
	var stars: Array = guests.filter(func(c): return c != sim.margo)
	if guests.size() < 2 or stars.is_empty():
		return null
	var star: Variant = sim.pick(stars)
	var cake: Variant = sim.point_near(star.pos.x, star.pos.y, 0.65)
	if cake == null:
		return null
	var started := _now()
	var event := { "type": "birthday", "members": [] }
	sim.state["cake"] = Vector2(cake["x"], cake["z"])
	_join(event, star)
	star.path = []
	star.dest = { "x": star.pos.x, "z": star.pos.y, "heading": null, "face": cake }
	var others: Array = guests.filter(func(c): return c != star)
	_gather(event, others, cake["x"], cake["z"], 1.25)
	var order: Array = sim.shuffled(others, sim.rng)
	order.append(star)
	for i in order.size():
		var c: Variant = order[i]
		sim.later(3.0 + i * 3.4, func(): _speak(event, c, "BIRTHDAY_DIALOGUE"))
	var length := 3.0 + order.size() * 3.4 + 3.0
	sim.record("It was %s's birthday. There was cake." % Data.display_name(star.type), "birthday")
	event["update"] = func() -> bool: return _now() - started > length
	event["end"] = func(): sim.state["cake"] = null
	return event


# ---- Meeting ----
# Everyone free gathers at the whiteboard and takes turns.
func _meeting():
	var spot: Variant = _spot("whiteboard")
	var attendees := _people()
	if spot == null or attendees.size() < 2:
		return null
	var started := _now()
	var event := { "type": "meeting", "members": [] }
	var board: Vector2 = sim.landmarks.get("whiteboard", Vector2(spot["x"], spot["z"]))
	_gather(event, attendees, spot["x"], spot["z"], 1.0, _xz(board))
	var turns := mini(6, attendees.size() + 2)
	var order: Array = sim.shuffled(attendees, sim.rng)
	for i in turns:
		var c: Variant = order[i % order.size()]
		sim.later(4.5 + i * 3.6, func(): _speak(event, c, "MEETING_DIALOGUE"))
	var length := 4.5 + turns * 3.6 + 2.5
	event["update"] = func() -> bool: return _now() - started > length
	event["end"] = func(): sim.record(sim.pick(MEETING_REPORTS), "meeting")
	return event


func _begin(event) -> bool:
	if event == null:
		return false
	current = event
	return true


## Start 'printerJam', 'meeting' or 'birthday'. False if it cannot happen now.
func start(type: String) -> bool:
	if current != null:
		return false
	var event: Variant = null
	match type:
		"printerJam": event = _printer_jam()
		"meeting": event = _meeting()
		"birthday": event = _birthday()
		_: return false
	var started := _begin(event)
	if started and type == "birthday":
		had_birthday = true
	return started


## Put a donut on the floor at `at` (Vector2), or somewhere free if null.
func drop_donut(at = null) -> bool:
	if current != null:
		return false
	if at == null or not sim.nav.free_at(at.x, at.y):
		at = sim.nav.random_free(sim.rng)
	return _begin(_donut_race(at))


func _something_happens() -> bool:
	var crowd := _people().size()
	var options: Array = ["printerJam", "printerJam", "donut"]
	if crowd >= 2:
		options.append_array(["meeting", "meeting", "donut"])
	if crowd >= 3 and not had_birthday:
		options.append("birthday")
	if sim.landmarks.has("lamp"):
		options.append("lamp")
	var choice: String = sim.pick(options)
	if choice == "lamp":
		return sim.flicker_lamp()
	return drop_donut() if choice == "donut" else start(choice)


func update() -> void:
	if current != null:
		if current["update"].call():
			_finish()
		return
	if _now() < next_at:
		return
	var happened := _something_happens()
	if current == null:
		next_at = _now() + (sim.between(EVENT_GAP_S) / 2.0 if happened else 20.0)
