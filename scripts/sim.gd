## The office simulation: who walks where and why, who talks to whom about
## what, who is at work, and when the ghost visits. No nodes in here: the
## office scene reads each character's state every frame and draws it, and
## the tests run the office headless. Office events (printer jam, donut race,
## ...) are in events.gd.
##
##   var sim: Variant = Sim.new(nav, spots, types, phase_callable, landmarks, rng)
##   sim.update(dt)            # advance by dt seconds
##   sim.cast[0].pos           # Vector2(x, z) on the floor
##   sim.cast[0].line          # what they are saying now, or ""
##   sim.log                   # [{ time, kind, text }] what has happened so far
##
## Why characters move: each has four needs (coffee, focus, rest, social)
## that grow over time at rates set by their temperament. When one is strong
## enough they go and deal with it; otherwise they wander.
extends RefCounted

const Data := preload("res://scripts/data.gd")
const Events := preload("res://scripts/events.gd")

const WALK_SPEED := 1.05
const TURN_RATE := 4.0
const DRIVE_TURN := 2.2      # radians a second a character turns in the visitor's hands
const DRIVE_REST := 4.0      # seconds they stand where they were left
const START := [Vector2(-1.2, 0.2), Vector2(0.2, -0.6), Vector2(1.0, 0.8), Vector2(-0.4, 1.6), Vector2(2.4, 0.2)]

# Where each need is met, and how long the visit lasts (seconds).
const NEEDS := {
	"coffee": { "spots": ["coffee_station", "table_cafe"], "stay": [4.0, 9.0] },
	"focus": { "spots": ["desk_cluster", "whiteboard", "printer"], "stay": [7.0, 15.0] },
	"rest": { "spots": ["couch_2seater", "armchair", "window"], "stay": [8.0, 16.0] },
	"social": { "spots": [], "stay": [2.0, 4.0] },
}
const NEED_KEYS := ["coffee", "focus", "rest", "social"]
const NEED_THRESHOLD := 0.4
# Seconds for a need to go from 0 to 1. Short = it comes up often.
const TEMPERAMENT := {
	"andy": { "coffee": 70.0, "focus": 170.0, "rest": 120.0, "social": 130.0 },  # runs on coffee
	"jazz": { "coffee": 130.0, "focus": 160.0, "rest": 220.0, "social": 60.0 },  # runs on people
	"olex": { "coffee": 110.0, "focus": 60.0, "rest": 240.0, "social": 180.0 },  # runs on work
	"margo": { "coffee": 420.0, "focus": 95.0, "rest": 85.0, "social": 280.0 },  # tickets, then her serial
}

const CHAT_RANGE := 2.2
const CHAT_GAP_S := 0.45
const TOPIC_CHANCE := 0.75
const DIRECTED_CHANCE := 0.3
const FADE_S := 0.7
const GHOST_FADE_S := 1.8
const LOG_LIMIT := 200
const RECENT_LINES := 14


## One member of the cast.
class Person:
	var type: String
	var pos: Vector2
	var heading := 0.0
	var speed := 0.0
	var path: Array = []
	var spot: Variant = null              # Dictionary or null: the furniture spot they hold
	var dest: Variant = null              # { x, z, heading, face } or null
	var goal: Variant = null              # need key or null
	var wait := 1.0
	var blocked := 0.0
	var push_until := 0.0
	var needs := {}
	var chat: Variant = null              # shared chat Dictionary or null
	var chat_ready := 4.0
	var next_remark := 8.0
	var line := ""               # what they are saying, "" for nothing
	var line_seq := 0
	var say_until := 0.0
	var present := true
	var opacity := 1.0
	var fade := 0
	var shift := "in"            # in | leaving | out
	var shift_at := 0.0
	var busy: Variant = null              # the office event they are part of
	var look: Variant = null              # { x, z, until }
	var talking_to_visitor := false
	var drive: Variant = null             # { move, turn } while the visitor steers
	var driving := false

	func speaking() -> bool:
		return line != ""


var rng: RandomNumberGenerator
var nav
var spots: Array = []
var types: Array
var phase: Callable
var landmarks: Dictionary
var time := 0.0
var door: Variant = null
var cast: Array = []
var margo: Person = null
var ghost: Person = null
var visitor := Vector2(0, 10)
var log: Array = []
var state := { "printer_jammed": false, "lamp_flicker": false, "donut": null, "donut_wins": 0, "cake": null }
var events

var _last_logged := {}
var _pending: Array = []
var _recent_lines := {}
var _last_line := {}
var _chats: Array = []
var _chat_count := 0
var _next_tap := 0.0
var _haunting := { "fade": 0.0, "dir": 0, "at": 0.0, "spotted": 0.0 }


func _init(a_nav, a_spots: Array, a_types: Array, a_phase: Callable, a_landmarks := {}, a_rng: RandomNumberGenerator = null) -> void:
	nav = a_nav
	types = a_types
	phase = a_phase
	landmarks = a_landmarks
	rng = a_rng if a_rng else RandomNumberGenerator.new()
	for s in a_spots:
		if nav.free_at(s["x"], s["z"]):
			spots.append(s)
	for s in spots:
		if s["type"] == "door":
			door = s
			break
	for i in types.size():
		var c := Person.new()
		c.type = types[i]
		c.pos = START[i % START.size()]
		c.heading = rng.randf() * TAU
		c.wait = 1.0 + rng.randf() * 3.0
		for k in NEED_KEYS:
			c.needs[k] = rng.randf() * 0.5
		c.chat_ready = 4.0 + rng.randf() * 6.0
		c.next_remark = 8.0 + rng.randf() * 10.0
		var here := on_shift(c.type)
		c.present = here
		c.opacity = 1.0 if here else 0.0
		c.shift = "in" if here else "out"
		cast.append(c)
		if c.type == "margo":
			margo = c
		elif c.type == "ghost":
			ghost = c
	if ghost:
		_hide_ghost()
		_schedule_haunt(true)
	events = Events.new(self)


# ---- Helpers ----

func between(r: Array) -> float:
	return r[0] + rng.randf() * (r[1] - r[0])


func pick(list: Array):
	return list[int(rng.randf() * list.size())] if list.size() > 0 else null


func phase_info() -> Dictionary:
	return Data.phase_info(phase.call())


static func is_staff(type: String) -> bool:
	return type != "margo" and type != "ghost"


func on_shift(type: String) -> bool:
	if not is_staff(type) or door == null:
		return true
	return (phase_info().get("staff", types) as Array).has(type)


func chat_multiplier() -> float:
	return float(phase_info().get("chat", 1.0))


func chat_multiplier_for(c: Person) -> float:
	return maxf(1.0, chat_multiplier()) if c.type == "margo" else chat_multiplier()


func is_idle(c: Person) -> bool:
	return c.present and c.shift == "in" and c.path.is_empty() and c.chat == null and not c.talking_to_visitor and c.busy == null and not c.driving


## Free to be pulled into something (an event, a reaction).
func is_free(c: Person) -> bool:
	return c.present and c.shift == "in" and c.chat == null and not c.talking_to_visitor and c.busy == null


static func angle_delta(a: float, b: float) -> float:
	return atan2(sin(b - a), cos(b - a))


static func read_seconds(text: String) -> float:
	return clampf(1.8 + text.length() * 0.045, 3.5, 8.0)


static func shuffled(list: Array, r: RandomNumberGenerator) -> Array:
	var pairs: Array = []
	for item in list:
		pairs.append([r.randf(), item])
	pairs.sort_custom(func(a, b): return a[0] < b[0])
	return pairs.map(func(p): return p[1])


# ---- Log and delayed actions ----

func record(text: String, kind := "note", every := 0.0) -> void:
	if every > 0.0 and time - float(_last_logged.get(kind, -INF)) < every:
		return
	_last_logged[kind] = time
	log.append({ "time": time, "kind": kind, "text": text })
	if log.size() > LOG_LIMIT:
		log.pop_front()


func later(delay: float, fn: Callable) -> void:
	_pending.append({ "at": time + delay, "fn": fn })


func _run_pending() -> void:
	var due: Array = []
	for i in range(_pending.size() - 1, -1, -1):
		if time >= _pending[i]["at"]:
			due.append(_pending[i]["fn"])
			_pending.remove_at(i)
	for fn in due:
		fn.call()


# ---- Walking ----

func send_to(c: Person, x: float, z: float, face = null, heading = null) -> void:
	c.spot = null
	c.goal = null
	c.dest = { "x": x, "z": z, "heading": heading, "face": face }
	c.path = nav.path(c.pos, Vector2(x, z))
	c.blocked = 0.0


## A free floor point about r metres from (x, z), or null.
func point_near(x: float, z: float, r: float, start_angle = null):
	var a0: float = start_angle if start_angle != null else rng.randf() * TAU
	for radius in [r, r + 0.3, r - 0.3, r + 0.6]:
		for i in 10:
			var a: float = a0 + (-1 if i % 2 else 1) * ceili(i / 2.0) * (PI / 5.0)
			var px: float = x + sin(a) * radius
			var pz: float = z + cos(a) * radius
			if nav.free_at(px, pz):
				return { "x": px, "z": pz }
	return null


func _taken_spots(c: Person) -> Array:
	var out: Array = []
	for o in cast:
		if o != c and o.present and o.spot != null:
			out.append(o.spot)
	return out


func _wander(c: Person) -> void:
	var taken := _taken_spots(c)
	var options: Array = spots.filter(func(s): return not taken.has(s) and Vector2(s["x"], s["z"]).distance_to(c.pos) > 1.2)
	var d
	if options.size() > 0 and rng.randf() < 0.6:
		d = pick(options)
		c.spot = d
	else:
		var p: Vector2 = nav.random_free(rng)
		d = { "x": p.x, "z": p.y, "heading": null }
		c.spot = null
	c.goal = null
	c.dest = d
	c.path = nav.path(c.pos, Vector2(d["x"], d["z"]))
	c.blocked = 0.0


func choose_destination(c: Person) -> void:
	if not TEMPERAMENT.has(c.type):
		_wander(c)  # the ghost just drifts
		return
	var need: Variant = null
	var best := NEED_THRESHOLD
	for key in NEED_KEYS:
		var v: float = c.needs[key] + rng.randf() * 0.25
		if v > best:
			best = v
			need = key
	if need == null:
		_wander(c)
		return
	if need == "social":
		var others: Array = cast.filter(func(o): return o != c and o.type != "ghost" and is_free(o))
		others.sort_custom(func(a, b): return c.pos.distance_to(a.pos) < c.pos.distance_to(b.pos))
		var friend: Variant = others[0] if others.size() > 0 else null
		var at: Variant = point_near(friend.pos.x, friend.pos.y, 1.1) if friend else null
		if at == null:
			c.needs["social"] = 0.2
			_wander(c)
			return
		send_to(c, at["x"], at["z"], { "x": friend.pos.x, "z": friend.pos.y })
		c.goal = "social"
		return
	var taken := _taken_spots(c)
	var wanted: Array = NEEDS[need]["spots"]
	var options: Array = spots.filter(func(s): return wanted.has(s["type"]) and not taken.has(s) and s != c.spot)
	# Margo's rest is her serial, in the armchair, whenever it is free.
	if c.type == "margo" and need == "rest":
		for s in options:
			if s["type"] == "armchair":
				options = [s]
				break
	if options.is_empty():
		c.needs[need] *= 0.6
		_wander(c)
		return
	var d: Variant = pick(options)
	c.spot = d
	c.goal = need
	c.dest = d
	c.path = nav.path(c.pos, Vector2(d["x"], d["z"]))
	c.blocked = 0.0


func _spot_lines(type: String):
	match type:
		"table_cafe": return Data.bank("COFFEE_DIALOGUE")
		"armchair": return Data.bank("ACTIVITY_LINES").get("couch_2seater")
		"desk_cluster", "coffee_station", "printer", "whiteboard", "couch_2seater":
			return Data.bank("ACTIVITY_LINES").get(type)
	return null


func _arrived(c: Person) -> void:
	if c.shift == "leaving":
		c.fade = -1  # at the door: out they go
		return
	if c.busy != null:
		return
	if c.goal != null:
		c.needs[c.goal] = 0.0
		c.wait = between(NEEDS[c.goal]["stay"])
		if c.goal == "social":
			c.chat_ready = minf(c.chat_ready, time + 0.4)
	if c.type == "margo" and c.spot != null and c.spot["type"] == "armchair":
		c.wait = 20.0 + rng.randf() * 20.0  # a whole scene of Orbital Tidewater
		say(c, pick_line("margo", Data.bank("ACTIVITY_LINES")["armchair"]))
		return
	var b: Variant = _spot_lines(c.spot["type"]) if c.spot != null else null
	if b != null and rng.randf() < 0.6:
		say(c, pick_line(c.type, b))


func _tick(c: Person, dt: float) -> void:
	if TEMPERAMENT.has(c.type):
		var temper: Dictionary = TEMPERAMENT[c.type]
		for key in NEED_KEYS:
			c.needs[key] = minf(1.0, c.needs[key] + dt / temper[key])
	if c.look != null and time > c.look["until"]:
		c.look = null

	# In the visitor's hands: walk where they steer, round the furniture.
	c.driving = false
	if c.drive != null and (c.drive["move"] != 0.0 or c.drive["turn"] != 0.0) and c.present and c.shift == "in" and not c.talking_to_visitor:
		var move: float = c.drive["move"]
		var turn: float = c.drive["turn"]
		c.path = []
		c.spot = null
		c.dest = null
		c.goal = null
		c.blocked = 0.0
		c.look = null
		c.driving = true
		c.wait = maxf(c.wait, DRIVE_REST)
		c.heading += turn * DRIVE_TURN * dt
		var pace := move if move > 0.0 else move * 0.6
		c.speed += (absf(pace) - c.speed) * minf(1.0, dt * 6.0)
		var step := WALK_SPEED * pace * dt
		var sx := sin(c.heading) * step
		var sz := cos(c.heading) * step
		if nav.free_at(c.pos.x + sx, c.pos.y + sz):
			c.pos += Vector2(sx, sz)
		elif nav.free_at(c.pos.x + sx, c.pos.y):
			c.pos.x += sx
		elif nav.free_at(c.pos.x, c.pos.y + sz):
			c.pos.y += sz
		else:
			c.speed = 0.0
		return

	var want_speed := 0.0
	var want_heading := c.heading
	if c.talking_to_visitor:
		c.path = []
		c.wait = maxf(c.wait, 2.0)
		want_heading = atan2(visitor.x - c.pos.x, visitor.y - c.pos.y)
	elif c.look != null and c.busy == null:
		c.wait = maxf(c.wait, 0.5)
		want_heading = atan2(c.look["x"] - c.pos.x, c.look["z"] - c.pos.y)
	elif c.path.size() > 0:
		var w: Vector2 = c.path[0]
		var dv := w - c.pos
		var d := dv.length()
		if d < 0.12:
			c.path.pop_front()
			if c.path.is_empty():
				c.wait = (2.0 if c.type == "ghost" else 3.0) + rng.randf() * 5.0
				_arrived(c)
		else:
			want_heading = atan2(dv.x, dv.y)
			want_speed = minf(1.0, d / 0.6 + 0.25) if c.path.size() == 1 else 1.0
		# Give way to anyone close in front (not in a donut race).
		var ahead := false
		var racing: bool = c.busy != null and c.busy["type"] == "donut"
		if not racing and time >= c.push_until:
			for o in cast:
				if o == c or not o.present:
					continue
				var ov: Vector2 = o.pos - c.pos
				var od := ov.length()
				if od < 0.75 and od > 0.0 and (ov.x * sin(c.heading) + ov.y * cos(c.heading)) / od > 0.45:
					ahead = true
					break
		if ahead:
			want_speed = 0.0
			c.blocked += dt
			if c.blocked > 1.6 + rng.randf():
				if c.shift == "leaving":
					c.blocked = 0.0
					c.push_until = time + 2.0 + rng.randf() * 2.0
					c.path = nav.path(c.pos, Vector2(door["x"], door["z"]))
					if c.path.is_empty():
						c.fade = -1
				elif c.busy != null:
					c.path = []
				else:
					choose_destination(c)
		else:
			c.blocked = 0.0
	else:
		var d: Variant = c.dest
		if d != null and d.get("face") != null:
			want_heading = atan2(d["face"]["x"] - c.pos.x, d["face"]["z"] - c.pos.y)
		elif d != null and d.get("heading") != null:
			want_heading = d["heading"]
		if c.busy == null and c.shift == "in":
			c.wait -= dt
			if c.wait <= 0.0:
				choose_destination(c)
	c.heading += clampf(angle_delta(c.heading, want_heading), -TURN_RATE * dt, TURN_RATE * dt)
	var align := maxf(0.0, cos(angle_delta(c.heading, want_heading)))
	c.speed += (want_speed * align - c.speed) * minf(1.0, dt * 6.0)
	c.pos.x += sin(c.heading) * WALK_SPEED * c.speed * dt
	c.pos.y += cos(c.heading) * WALK_SPEED * c.speed * dt


# ---- Coming and going ----

func _update_shifts(dt: float) -> void:
	for c in cast:
		if not is_staff(c.type):
			continue
		if c.fade != 0:
			c.opacity = clampf(c.opacity + c.fade * dt / FADE_S, 0.0, 1.0)
			if c.opacity == 1.0:
				c.fade = 0
			elif c.opacity == 0.0:
				c.fade = 0
				c.present = false
				c.shift = "out"
				c.shift_at = 0.0
				c.spot = null
				c.line = ""
				record("%s went home." % Data.display_name(c.type), "shift")
			continue
		var due := on_shift(c.type)
		if c.shift == "in" and not due:
			if c.shift_at == 0.0:
				c.shift_at = time + 4.0 + rng.randf() * 40.0
			if time >= c.shift_at and is_free(c):
				c.shift = "leaving"
				c.shift_at = 0.0
				c.spot = null
				c.look = null
				send_to(c, door["x"], door["z"])
				say(c, pick_line(c.type, Data.bank("LEAVE_DIALOGUE")))
				if c.path.is_empty():
					c.fade = -1
		elif c.shift == "leaving" and due:
			c.shift = "in"
			c.wait = 0.5
		elif c.shift == "out" and due:
			if c.shift_at == 0.0:
				c.shift_at = time + 2.0 + rng.randf() * 25.0
			if time >= c.shift_at:
				c.shift_at = 0.0
				c.pos = Vector2(door["x"], door["z"])
				c.heading = PI
				c.speed = 0.0
				c.present = true
				c.shift = "in"
				c.fade = 1
				c.wait = 1.2
				c.chat_ready = time + 5.0
				say(c, pick_line(c.type, Data.bank("ARRIVE_DIALOGUE")))
				record("%s came in." % Data.display_name(c.type), "shift")
		elif c.shift == "in":
			c.shift_at = 0.0


# ---- Speech ----

## Pick one of `lines` the character has not said recently.
func pick_from(type: String, lines) -> String:
	if lines == null or (lines as Array).is_empty():
		return ""
	if not _recent_lines.has(type):
		_recent_lines[type] = []
	var used: Array = _recent_lines[type]
	var pool: Array = (lines as Array).filter(func(l): return not used.has(l))
	if pool.is_empty():
		for l in lines:
			used.erase(l)
		var last: Variant = _last_line.get(type)
		pool = (lines as Array).filter(func(l): return l != last) if lines.size() > 1 else lines
	var line: String = pick(pool)
	used.append(line)
	_last_line[type] = line
	if used.size() > RECENT_LINES:
		used.pop_front()
	return line


func pick_line(type: String, b) -> String:
	if b == null:
		return ""
	return pick_from(type, (b as Dictionary).get(type))


## Start a speech bubble. Returns how long it stays up, in seconds.
func say(c: Person, text: String) -> float:
	if text == "":
		return 0.0
	c.line = text
	c.line_seq += 1
	var s := read_seconds(text)
	c.say_until = time + s
	return s


func _pick_topic(a: Person, b: Person):
	if rng.randf() > TOPIC_CHANCE:
		return null
	var tl := Data.topic_lines()
	var shared: Array = Data.topics().filter(func(t):
		return tl.get(a.type, {}).get(t["key"], []).size() >= 2 and tl.get(b.type, {}).get(t["key"], []).size() >= 1)
	return pick(shared)


func start_chat(a: Person, b: Person) -> void:
	var turns := 2 + int(rng.randf() * 3)
	var order: Array = []
	for i in turns:
		order.append(b if i % 2 else a)
	_chat_count += 1
	var chat := { "id": _chat_count, "a": a, "b": b, "order": order, "next": time + 0.3, "topic": _pick_topic(a, b) }
	for pair in [[a, b], [b, a]]:
		var c: Person = pair[0]
		var other: Person = pair[1]
		c.chat = chat
		c.path = []
		c.spot = null
		c.dest = { "x": c.pos.x, "z": c.pos.y, "heading": null, "face": { "x": other.pos.x, "z": other.pos.y } }


func _chat_line(speaker: Person, chat: Dictionary) -> String:
	var listener: Person = chat["b"] if speaker == chat["a"] else chat["a"]
	var personal: Variant = Data.bank("DIRECTED_LINES").get(speaker.type, {}).get(listener.type)
	if personal != null and chat["topic"] != null:
		personal = (personal as Array).filter(func(l): return Data.matches(chat["topic"], l))
	if personal != null and (personal as Array).size() > 0 and rng.randf() < DIRECTED_CHANCE:
		return pick_from(speaker.type, personal)
	if chat["topic"] != null:
		var on_topic := pick_from(speaker.type, Data.topic_lines()[speaker.type][chat["topic"]["key"]])
		if on_topic != "":
			return on_topic
	return pick_line(speaker.type, Data.bank("DIALOGUE_BANKS"))


func _update_speech(dt: float) -> void:
	var mult := chat_multiplier()
	_chats.clear()
	for c in cast:
		if c.line != "" and time > c.say_until:
			c.line = ""
		if c.chat != null:
			c.wait = maxf(c.wait, 1.0)
			if not _chats.has(c.chat):
				_chats.append(c.chat)
	for chat in _chats:
		if time < chat["next"]:
			continue
		var speaker: Variant = chat["order"].pop_front() if chat["order"].size() > 0 else null
		if speaker != null:
			chat["next"] = time + say(speaker, _chat_line(speaker, chat)) + CHAT_GAP_S
		else:
			for c in [chat["a"], chat["b"]]:
				c.chat = null
				c.needs["social"] = 0.0
				c.chat_ready = time + (16.0 + rng.randf() * 12.0) / mult * (1.5 if c.type == "margo" else 1.0)
				c.wait = 0.8 + rng.randf() * 2.5
			if chat["topic"] != null and chat["a"].type != "ghost" and chat["b"].type != "ghost":
				record("%s and %s talked about %s." % [Data.display_name(chat["a"].type), Data.display_name(chat["b"].type), chat["topic"]["label"]], "chat", 45.0)
	# Two idle characters close together may strike up a chat.
	for i in cast.size():
		for j in range(i + 1, cast.size()):
			var a: Person = cast[i]
			var b: Person = cast[j]
			if not is_idle(a) or not is_idle(b) or a.look != null or b.look != null or time < a.chat_ready or time < b.chat_ready:
				continue
			if a.pos.distance_to(b.pos) > CHAT_RANGE:
				continue
			if rng.randf() < dt * 0.6 * mult:
				if b.needs["social"] > a.needs["social"]:
					start_chat(b, a)
				else:
					start_chat(a, b)
	# The odd remark while standing around alone.
	for c in cast:
		if not is_idle(c) or time < c.next_remark or time < c.say_until:
			continue
		c.next_remark = time + (14.0 + rng.randf() * 14.0) / chat_multiplier_for(c)
		if rng.randf() < 0.45:
			say(c, pick_line(c.type, Data.bank("DIALOGUE_BANKS")))


# ---- The visitor ----

## A tap on one character: they turn to the glass and say something.
func poke(c: Person) -> bool:
	if c == null or not c.present or c.busy != null or c.shift != "in":
		return false
	if c.chat == null:
		c.look = { "x": visitor.x, "z": visitor.y, "until": time + 3.5 }
	var lines: Variant = Data.bank("MARGO_LINES")["tapGlass"] if c.type == "margo" else Data.bank("DIALOGUE_BANKS")[c.type]
	if time > c.say_until - 1.0:
		say(c, pick_from(c.type, lines))
	return true


## A tap on the glass: everyone looks up, and a couple of them react.
func tap_glass() -> bool:
	if time < _next_tap:
		return false
	_next_tap = time + 5.0
	var heard: Array = cast.filter(func(c): return is_free(c))
	for c in heard:
		c.look = { "x": visitor.x, "z": visitor.y, "until": time + 2.5 + rng.randf() * 1.5 }
	var others: Array = heard.filter(func(c): return c != margo and c.type != "ghost")
	var first: Variant = pick(others)
	if first != null:
		later(0.4, func(): if is_free(first): say(first, pick_line(first.type, Data.bank("GLASS_TAP_DIALOGUE"))))
	if margo != null and heard.has(margo):
		later(1.8 if first != null else 0.4, func(): if is_free(margo): say(margo, pick_from("margo", Data.bank("MARGO_LINES")["tapGlass"])))
	if ghost != null and heard.has(ghost):
		later(0.9, func(): if ghost.present: say(ghost, pick_line("ghost", Data.bank("GLASS_TAP_DIALOGUE"))))
	record("A visitor tapped on the glass.", "tap", 120.0)
	return true


## Steer one character by hand: move is 1 forward, -1 back; turn is 1 left,
## -1 right. Anyone else is released; drive("") releases everyone.
func drive(type: String, move := 0.0, turn := 0.0) -> void:
	for c in cast:
		c.drive = { "move": move, "turn": turn } if c.type == type else null


# ---- The ghost ----

func _hide_ghost() -> void:
	ghost.present = false
	ghost.path = []
	ghost.chat = null
	ghost.busy = null
	ghost.line = ""
	ghost.opacity = 0.0


func _schedule_haunt(first := false) -> void:
	var info := phase_info()
	var vis: float = info.get("ghostVis", 1.0)
	var hid: float = info.get("ghostHid", 1.0)
	var away := 30.0 + rng.randf() * 60.0 if first else (120.0 + rng.randf() * 180.0) * hid / vis
	_haunting["at"] = time + away


## The lamp stutters for a few seconds and whoever is around has a theory.
func flicker_lamp() -> bool:
	if state["lamp_flicker"]:
		return false
	state["lamp_flicker"] = true
	later(5.0 + rng.randf() * 2.0, func(): state["lamp_flicker"] = false)
	var lamp: Variant = landmarks.get("lamp")
	var witnesses: Array = shuffled(cast.filter(func(c): return c.type != "ghost" and c.type != "margo" and is_free(c)), rng).slice(0, 2)
	for i in witnesses.size():
		var c: Person = witnesses[i]
		later(0.8 + i * 2.6, func():
			if not is_free(c):
				return
			if lamp != null:
				c.look = { "x": lamp.x, "z": lamp.y, "until": time + 3.0 }
			say(c, pick_line(c.type, Data.bank("LAMP_FLICKER_DIALOGUE"))))
	if ghost != null and ghost.present:
		later(1.6, func(): if ghost.present: say(ghost, pick_line("ghost", Data.bank("LAMP_FLICKER_DIALOGUE"))))
	var text := "The lamp flickered. %s has a theory." % Data.display_name(witnesses[0].type) if witnesses.size() > 0 else "The lamp flickered. Nobody was there to see it."
	record(text, "lamp", 30.0)
	return true


func haunt() -> void:
	if ghost == null:
		return
	ghost.pos = nav.random_free(rng)
	ghost.heading = rng.randf() * TAU
	ghost.speed = 0.0
	ghost.present = true
	ghost.wait = 1.0 + rng.randf() * 2.0
	ghost.chat_ready = time + 3.0
	_haunting["dir"] = 1
	_haunting["at"] = time + (20.0 + rng.randf() * 25.0) * float(phase_info().get("ghostVis", 1.0))
	_haunting["spotted"] = time + 2.0 + rng.randf() * 3.0
	if rng.randf() < 0.7:
		flicker_lamp()


func _update_ghost(dt: float) -> void:
	if _haunting["dir"] != 0:
		_haunting["fade"] = clampf(_haunting["fade"] + _haunting["dir"] * dt / GHOST_FADE_S, 0.0, 1.0)
		ghost.opacity = _haunting["fade"]
		if _haunting["fade"] == 0.0:
			_hide_ghost()
			_haunting["dir"] = 0
			_schedule_haunt()
		elif _haunting["fade"] == 1.0:
			_haunting["dir"] = 0
		return
	if not ghost.present:
		if time >= _haunting["at"]:
			haunt()
		return
	if _haunting["spotted"] > 0.0 and time >= _haunting["spotted"]:
		_haunting["spotted"] = 0.0
		var noticed := margo != null and is_idle(margo) and rng.randf() < 0.7
		if noticed:
			say(margo, pick_from("margo", Data.bank("MARGO_LINES")["ghostSpotted"]))
		record("The ghost dropped by. Only Margo noticed." if noticed else "The ghost dropped by. Nobody noticed.", "ghost")
	if time >= _haunting["at"] and ghost.chat == null and ghost.busy == null:
		ghost.line = ""
		_haunting["dir"] = -1


## Seconds until the ghost next materialises (0 while it is in the room).
func ghost_due_in() -> float:
	if ghost == null:
		return INF
	return 0.0 if ghost.present else maxf(0.0, _haunting["at"] - time)


# ---- Office events ----

func trigger(type: String) -> bool:
	return events.start(type)


func drop_donut(at = null) -> bool:
	return events.drop_donut(at)


func current_event() -> String:
	return events.current["type"] if events.current != null else ""


func find(type: String) -> Person:
	for c in cast:
		if c.type == type:
			return c
	return null


func update(dt: float) -> void:
	time += dt
	_run_pending()
	if ghost:
		_update_ghost(dt)
	if door != null:
		_update_shifts(dt)
	events.update()
	for c in cast:
		if c.present:
			_tick(c, dt)
	_update_speech(dt)
