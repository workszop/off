## The office: scene, furniture, camera, overlay, clicks and the frame loop.
## What the cast does lives in sim.gd and events.gd, the time-of-day look in
## lighting.gd, the overlay in hud.gd.
##
## The camera stands in the room, between its walls and under its ceiling.
## A director (director.gd) picks the shots, so the office can be watched like
## a sitcom; a drag or a scroll takes the camera for a while, and the Director
## button turns it off. First person puts the camera in the head of the
## character picked in the dock.
##
## Command-line options (after `--`): --phase=night, --hour=N, --director=off,
## --pov=jazz, --seed=N, --party, --step=SECONDS (fast-forward at start),
## --screenshot=PATH (save one frame after start-up, then quit).
extends Node3D

const Data := preload("res://scripts/data.gd")
const Layout := preload("res://scripts/layout.gd")
const Sim := preload("res://scripts/sim.gd")
const Director := preload("res://scripts/director.gd")
const View := preload("res://scripts/view_math.gd")
const Paper := preload("res://scripts/paper.gd")
const Furniture := preload("res://scripts/furniture.gd")
const Room := preload("res://scripts/room.gd")
const Exterior := preload("res://scripts/exterior.gd")
const Standee := preload("res://scripts/standee.gd")
const Lighting := preload("res://scripts/lighting.gd")
const Props := preload("res://scripts/props.gd")
const Party := preload("res://scripts/party.gd")
const Sound := preload("res://scripts/sound.gd")
const DayLog := preload("res://scripts/daylog.gd")
const Hud := preload("res://scripts/hud.gd")
const MargoChat := preload("res://scripts/margo_chat.gd")

const ROOM := Layout.ROOM
const SETTINGS := "user://settings.cfg"
const PITCH := { "andy": 0.8, "jazz": 1.25, "olex": 1.0, "ghost": 1.6, "margo": 0.65 }
const HANDS_OFF_S := 7.0
const GHOST_ART_LEAD_S := 20.0
const BUBBLE_MAX_CHARS := 160
const NEAR := 1.2
const INSIDE := {
	"fov": 70.0, "fov_tall": 84.0, "min_dist": 1.0, "max_dist": 9.0,
	"min_polar": 0.9, "max_polar": 1.68, "follow_zoom": 0.6,
}
const HOME := Vector3(0, 1.0, -0.2)
const KEYS := {
	KEY_W: "forward", KEY_UP: "forward", KEY_S: "back", KEY_DOWN: "back",
	KEY_A: "left", KEY_LEFT: "left", KEY_D: "right", KEY_RIGHT: "right",
}

var opts := {}
var rng := RandomNumberGenerator.new()
var camera: Camera3D
var env: Environment
var sun: DirectionalLight3D
var room: Node3D
var exterior: Node3D
var hud
var sim
var director
var lighting
var props: Node3D
var party: Node3D
var sound: Node
var daylog
var margo_chat: Node
var standees := {}         # type -> standee node
var pieces := {}           # type -> first piece built { node, glow, light, bulb, ... }
var blockers: Array = []   # world AABBs of furniture, for the director's line of sight
var bounds: Dictionary
var nav

# Time of day.
var hour_override := -1
var phase_choice := "live"
var party_on := false
var party_art_ready := false

# Camera.
var focus := ""
var director_on := true
var directing := false
var hands_off_until := 0.0
var now := 0.0
var last_cut := -1
var settle_until := 0.0
var look_at := HOME
var focus_blend := 0.0
var orbit_target := HOME
var orbit := Vector3(9.0, 1.42, 0.0)   # distance, polar, azimuth: the offset the visitor asks for
var spin := false
var pov := false
var in_pov := false
var pov_hidden = null
var pov_yaw := 0.0
var pov_turned_at := -INF
var pov_look := Vector2.ZERO      # yaw, pitch
var held := {}
var dragging := false
var drag_from := Vector2.ZERO
var drag_last := Vector2.ZERO
var down_at := Vector2.ZERO
var pointer_down := false

# What the sim showed last frame.
var seen := { "jam": false, "flicker": false, "donut": false, "donut_wins": 0, "cake": false, "log": 0 }
var seen_lines := {}
var seen_present := {}
var last_speak_sound := 0.0
var ghost_art_requested := false
var art_stage := 0            # 0 idle loading, 1 walk loading, 2 dance loading, 3 all in
var outline: MeshInstance3D
var screenshot_at := -1.0
var fixed_cam: Array = []


func _ready() -> void:
	_read_options()
	if opts.has("seed"):
		rng.seed = int(opts["seed"])
		seed(int(opts["seed"]))
	else:
		rng.randomize()
	hour_override = int(opts["hour"]) if opts.has("hour") else -1
	phase_choice = opts.get("phase", "live")
	_build_world()
	_build_cast()
	_build_ui()
	lighting.update(current_phase(), 0.0)
	var cfg := ConfigFile.new()
	cfg.load(SETTINGS)
	set_director(str(opts.get("director", "on" if cfg.get_value("camera", "director", true) else "off")) != "off", false)
	if opts.has("pov"):
		var who: String = opts["pov"]
		if Data.CAST.has(who):
			set_focus(who)
		set_pov(true)
	_place_inside()
	if opts.has("step"):
		step(float(opts["step"]))
	if opts.has("screenshot"):
		screenshot_at = 1.5
	if opts.has("cam"):   # debugging: --cam=x,y,z,tx,ty,tz holds the camera there
		var v: PackedFloat64Array = str(opts["cam"]).split_floats(",")
		set_director(false, false)
		fixed_cam = [Vector3(v[0], v[1], v[2]), Vector3(v[3], v[4], v[5])]
	if opts.has("hide"):   # debugging: --hide=Party,Props
		for n in str(opts["hide"]).split(","):
			var node := find_child(n, true, false)
			if node is Node3D:
				node.visible = false


func _read_options() -> void:
	for a in OS.get_cmdline_user_args():
		var s: String = a.trim_prefix("--")
		var eq := s.find("=")
		if eq >= 0:
			opts[s.substr(0, eq)] = s.substr(eq + 1)
		else:
			opts[s] = "1"


# ---- Time of day ----

func clock_phase() -> String:
	if phase_choice != "live":
		return phase_choice
	var h: int = hour_override if hour_override >= 0 else Time.get_datetime_dict_from_system()["hour"]
	return Data.phase_for_hour(h)


func current_phase() -> String:
	return "party" if party_on else clock_phase()


# ---- World ----

func _build_world() -> void:
	var we := WorldEnvironment.new()
	env = Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color8(0xf4, 0xef, 0xe5)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.tonemap_exposure = 1.25
	env.tonemap_white = 4.0
	env.ssao_enabled = true
	env.ssao_radius = 0.6
	env.ssao_intensity = 1.2
	env.fog_enabled = true
	env.fog_mode = Environment.FOG_MODE_DEPTH
	env.fog_depth_begin = 26.0
	env.fog_depth_end = 60.0
	env.fog_density = 1.0
	we.environment = env
	add_child(we)

	sun = DirectionalLight3D.new()
	sun.shadow_enabled = true
	sun.shadow_bias = 0.03
	sun.shadow_normal_bias = 1.0
	sun.directional_shadow_mode = DirectionalLight3D.SHADOW_ORTHOGONAL
	sun.directional_shadow_max_distance = 30.0
	add_child(sun)

	camera = Camera3D.new()
	camera.fov = INSIDE["fov"]
	camera.near = 0.08
	camera.far = 170.0
	add_child(camera)
	camera.make_current()

	room = Room.new()
	room.name = "Room"
	add_child(room)
	room.build()
	exterior = Exterior.new()
	exterior.name = "Exterior"
	add_child(exterior)
	exterior.setup(ROOM)

	var lay := Layout.build()
	nav = lay["nav"]
	var glow: Array = []
	var lamps: Array = []
	for row in Layout.LAYOUT:
		var type: String = row[0]
		var p: Dictionary = Furniture.build(type)
		var node: Node3D = p["node"]
		node.name = type
		node.position = Vector3(row[1], 0, row[2])
		node.rotation.y = row[3]
		add_child(node)
		if not pieces.has(type):
			pieces[type] = p
		glow.append_array(p["glow"])
		if p["light"] != null:
			lamps.append(p)
		var f: Array = Layout.spec(type)["footprint"]
		Paper.contact_shadow(node, f[2] - f[0] + 0.34, f[3] - f[1] + 0.34, 0.3, Vector3((f[0] + f[2]) / 2.0, 0, (f[1] + f[3]) / 2.0))
		blockers.append(_world_aabb(node))
	bounds = View.inside_bounds(ROOM)

	lighting = Lighting.new(sun, env)
	lighting.lamps = lamps
	lighting.glow = glow
	lighting.panels = room.panels
	lighting.exterior = exterior

	props = Props.new()
	props.name = "Props"
	add_child(props)
	party = Party.new()
	party.name = "Party"
	add_child(party)
	party.setup(nav, rng)
	sound = Sound.new()
	sound.name = "Sound"
	add_child(sound)
	daylog = DayLog.new()

	# The ink pass: a full-screen quad in front of the camera.
	outline = MeshInstance3D.new()
	var q := QuadMesh.new()
	q.size = Vector2(1, 1)
	outline.mesh = q
	var sm := ShaderMaterial.new()
	sm.shader = load("res://shaders/ink_outline.gdshader")
	# Draw before every other see-through thing: the screen copy it inks is
	# taken before the transparent pass, so anything drawn earlier would vanish.
	sm.render_priority = Material.RENDER_PRIORITY_MIN
	outline.material_override = sm
	outline.extra_cull_margin = 16384.0
	outline.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	outline.position = Vector3(0, 0, -0.5)
	camera.add_child(outline)
	if RenderingServer.get_current_rendering_method() == "gl_compatibility":
		outline.visible = false   # needs the normal buffer of Forward+ / Mobile


func _world_aabb(node: Node3D) -> AABB:
	var box := AABB()
	var first := true
	for mi in node.find_children("*", "MeshInstance3D", true, false):
		if mi.mesh == null or mi.mesh is PlaneMesh:
			continue
		var b: AABB = mi.global_transform * mi.get_aabb()
		box = b if first else box.merge(b)
		first = false
	return box


func _build_cast() -> void:
	var lay := Layout.build()
	sim = Sim.new(lay["nav"], lay["spots"], Data.CAST, current_phase, lay["landmarks"], rng)
	nav = lay["nav"]
	for c in sim.cast:
		var s = Standee.new()
		s.setup(c.type)
		add_child(s)
		standees[c.type] = s
		seen_lines[c.type] = c.line_seq
		seen_present[c.type] = c.present
		if c.type != "ghost":
			s.load_idle()
	lighting.standees = standees.values()
	director = Director.new(ROOM, _clear_view)


func _build_ui() -> void:
	hud = Hud.new()
	add_child(hud)
	hud.show_phase(phase_choice)
	hud.show_focus(focus)
	hud.phase_picked.connect(set_phase)
	hud.focus_picked.connect(set_focus)
	hud.tap_pressed.connect(tap_glass)
	hud.toggled.connect(_on_toggle)
	lighting.on_dark_change = func(dark): hud.set_dark(dark)
	for e in daylog.entries:
		hud.add_log(e["at"], e["text"])
	hud.unseen = 0
	hud.log_badge.visible = false
	margo_chat = MargoChat.new()
	add_child(margo_chat)
	margo_chat.setup(hud, Data.bank("MARGO_LINES")["offline"], _margo_context)
	margo_chat.reply.connect(func(text: String):
		var m = sim.margo
		if m != null:
			sim.say(m, text.substr(0, BUBBLE_MAX_CHARS - 1) + "…" if text.length() > BUBBLE_MAX_CHARS else text))
	hud.margo_open_changed.connect(func(open: bool):
		var m = sim.margo
		if m == null:
			return
		m.talking_to_visitor = open
		sound.duck(0.3 if open else 1.0)
		if open and m.chat != null:
			m.chat["order"].clear())   # finish any office chat first
	if sound.was_on():
		set_sound(true)


func _on_toggle(what: String, on: bool) -> void:
	match what:
		"director": set_director(on)
		"pov": set_pov(on)
		"spin": spin = on
		"party": set_party(on)
		"sound": set_sound(on)


func _margo_context() -> String:
	var here: Array = []
	for c in sim.cast:
		if c.present:
			here.append(Data.display_name(c.type))
	var st: Dictionary = sim.state
	var happening: Array = []
	if st["printer_jammed"]: happening.append("the printer is jammed")
	if st["donut"] != null: happening.append("there is a donut on the floor and people are racing for it")
	if st["cake"] != null: happening.append("there is a birthday cake out")
	if st["lamp_flicker"]: happening.append("the lamp is flickering")
	if sim.current_event() == "meeting": happening.append("a meeting is going on at the whiteboard")
	if party_on: happening.append("there is a party: the lights are low, a disco ball is turning and the boombox is loud")
	var parts := ["Time of day: %s." % clock_phase(), "In the room: %s." % ", ".join(here)]
	if happening.size() > 0:
		parts.append("Right now: %s." % "; ".join(happening))
	var recent: Array = daylog.recent(4)
	if recent.size() > 0:
		parts.append("Earlier today: " + " ".join(recent))
	return " ".join(parts).substr(0, 600)


# ---- Controls ----

func set_phase(p: String) -> void:
	phase_choice = p
	hud.show_phase(p)


func set_focus(t: String) -> void:
	focus = t
	hud.show_focus(t)
	if t == "" and pov:
		set_pov(false)   # 'Everyone' has no eyes to look through


func set_director(on: bool, remember := true) -> void:
	director_on = on
	if not on:
		_hand_over()
	hands_off_until = 0.0
	hud.set_pressed("director", on)
	if remember:
		var cfg := ConfigFile.new()
		cfg.load(SETTINGS)
		cfg.set_value("camera", "director", on)
		cfg.save(SETTINGS)


func set_pov(on: bool) -> void:
	pov = on
	if pov and focus == "":
		var who := "jazz"
		var j = sim.find("jazz")
		if j == null or not j.present:
			for c in sim.cast:
				if c.present and c.type != "ghost":
					who = c.type
					break
		set_focus(who)
	pov_look = Vector2.ZERO
	hud.set_pressed("pov", pov)


func set_sound(on: bool) -> void:
	var now_on: bool = sound.set_enabled(on)
	hud.set_pressed("sound", now_on)


func set_party(on: bool) -> void:
	if on and not party_art_ready:
		hud.set_pressed("party", false)
		return
	party_on = on
	hud.set_pressed("party", on)
	if on:
		if not sound.enabled:
			set_sound(true)
		sound.start_music()
	else:
		sound.stop_music()


func tap_glass() -> void:
	if sim.tap_glass():
		sound.play("tap")
		_knock = 0.25


var _knock := 0.0


# ---- Input ----

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey:
		var k: InputEventKey = event
		if KEYS.has(k.keycode):
			if k.pressed and in_pov:
				held[KEYS[k.keycode]] = true
				get_viewport().set_input_as_handled()
			elif not k.pressed:
				held.erase(KEYS[k.keycode])
		if k.pressed and not k.echo and k.keycode == KEY_P and not k.ctrl_pressed and not k.alt_pressed and not k.meta_pressed:
			set_party(not party_on)
		if k.pressed and k.keycode == KEY_ESCAPE:
			hud.set_chat_open(false)
			hud.set_log_open(false)
	elif event is InputEventMouseButton:
		var mb: InputEventMouseButton = event
		if mb.button_index == MOUSE_BUTTON_LEFT:
			if mb.pressed:
				pointer_down = true
				down_at = mb.position
				drag_last = mb.position
				dragging = false
				if mb.double_click:
					_double_click(mb.position)
			else:
				pointer_down = false
				if not dragging:
					_click(mb.position)
				dragging = false
		elif mb.pressed and (mb.button_index == MOUSE_BUTTON_WHEEL_UP or mb.button_index == MOUSE_BUTTON_WHEEL_DOWN):
			if not in_pov:
				_take_over()
				orbit.x = clampf(orbit.x * (0.9 if mb.button_index == MOUSE_BUTTON_WHEEL_UP else 1.1), INSIDE["min_dist"], INSIDE["max_dist"])
	elif event is InputEventMagnifyGesture:
		if not in_pov:
			_take_over()
			orbit.x = clampf(orbit.x / event.factor, INSIDE["min_dist"], INSIDE["max_dist"])
	elif event is InputEventMouseMotion and pointer_down:
		var mm: InputEventMouseMotion = event
		var d := mm.position - drag_last
		drag_last = mm.position
		if in_pov:
			pov_look.x = clampf(pov_look.x - d.x * 0.006, -2.2, 2.2)
			pov_look.y = clampf(pov_look.y - d.y * 0.004, -0.6, 0.6)
			pov_turned_at = now
			dragging = true
		elif dragging or mm.position.distance_to(down_at) > 6.0:
			if not dragging:
				_take_over()
			dragging = true
			orbit.z -= d.x * 0.006
			orbit.y = clampf(orbit.y - d.y * 0.005, INSIDE["min_polar"], INSIDE["max_polar"])


func _ray(pos: Vector2) -> Array:
	return [camera.project_ray_origin(pos), camera.project_ray_normal(pos)]


## The character under the pointer, nearest first (by their card rectangle).
func _character_at(pos: Vector2):
	var best = null
	var best_d := INF
	for c in sim.cast:
		if not c.present or c == pov_hidden or c.opacity < 0.3:
			continue
		var base := Vector3(c.pos.x, 0, c.pos.y)
		var h := 0.98 if c.type == "ghost" else 1.7
		if camera.is_position_behind(base):
			continue
		var foot := camera.unproject_position(base)
		var head := camera.unproject_position(base + Vector3(0, h, 0))
		var half := absf(foot.y - head.y) * 0.22
		if pos.x > foot.x - half and pos.x < foot.x + half and pos.y < foot.y and pos.y > head.y:
			var d := camera.global_position.distance_to(base)
			if d < best_d:
				best_d = d
				best = c
	return best


func _click(pos: Vector2) -> void:
	var c = _character_at(pos)
	if c != null and c == sim.margo:
		hud.set_chat_open(true)
	elif c != null:
		sim.poke(c)
	else:
		var r := _ray(pos)
		var printer: Node3D = pieces.get("printer", {}).get("node")
		if printer != null and _world_aabb(printer).intersects_ray(r[0], r[1]) != null:
			sim.trigger("printerJam")


func _double_click(pos: Vector2) -> void:
	if _character_at(pos) != null:
		return
	var r := _ray(pos)
	var hit = Plane(Vector3.UP, 0).intersects_ray(r[0], r[1])
	if hit != null and absf(hit.x) < ROOM["W"] / 2 and absf(hit.z) < ROOM["D"] / 2:
		sim.drop_donut(Vector2(hit.x, hit.z))


# ---- Camera ----

func _base_fov() -> float:
	var s := get_viewport().get_visible_rect().size
	return INSIDE["fov_tall"] if s.x / s.y < 0.9 else INSIDE["fov"]


func _aspect() -> float:
	var s := get_viewport().get_visible_rect().size
	return s.x / maxf(1.0, s.y)


func _orbit_offset() -> Vector3:
	var r := orbit.x
	var polar := orbit.y
	var az := orbit.z
	return Vector3(r * sin(polar) * sin(az), r * cos(polar), r * sin(polar) * cos(az))


## Stand the hand-held camera on the orbit's line, inside the walls.
func _place_inside() -> void:
	var off := _orbit_offset()
	var zoom := (orbit.x - INSIDE["min_dist"]) / (INSIDE["max_dist"] - INSIDE["min_dist"])
	var closer := lerpf(1.0, INSIDE["follow_zoom"], focus_blend)
	var dist := View.inside_distance(orbit_target, off, bounds, zoom * closer, NEAR)
	camera.global_position = orbit_target + off.normalized() * dist
	look_at = orbit_target
	_look(look_at)


func _look(target: Vector3) -> void:
	if camera.global_position.distance_to(target) > 0.001:
		camera.look_at(target, Vector3.UP)


func _hand_over() -> void:
	if not directing:
		return
	directing = false
	_sync_orbit()


## Set the orbit up to carry on from where the camera is now.
func _sync_orbit() -> void:
	var p := View.inset_point(look_at.x, look_at.z, bounds)
	orbit_target = Vector3(p.x, clampf(look_at.y, 0.7, 1.5), p.y)
	var off := camera.global_position - orbit_target
	var d := off.length()
	if d < 0.001:
		return
	var wall := View.reach(orbit_target, off / d, bounds)
	var zoom := clampf((d - NEAR) / (wall - NEAR), 0.0, 1.0) if wall > NEAR else 1.0
	orbit.x = INSIDE["min_dist"] + zoom * (INSIDE["max_dist"] - INSIDE["min_dist"])
	orbit.y = clampf(acos(clampf(off.y / d, -1.0, 1.0)), INSIDE["min_polar"], INSIDE["max_polar"])
	orbit.z = atan2(off.x, off.z)


func _take_over() -> void:
	hands_off_until = now + HANDS_OFF_S
	_hand_over()


## Nothing but air between the camera and what it looks at?
func _clear_view(pos: Vector3, target: Vector3) -> bool:
	var dir := target - pos
	var far := dir.length() - 0.9
	if far <= 0.0:
		return true
	var to := pos + dir.normalized() * far
	for b in blockers:
		if b.intersects_segment(pos, to) != null:
			return false
	return true


func _scene_now() -> Dictionary:
	var cast: Array = []
	for c in sim.cast:
		cast.append({
			"type": c.type, "x": c.pos.x, "z": c.pos.y, "heading": c.heading,
			"present": c.present, "visible": c.opacity > 0.5,
			"speaking": c.line != "", "line_seq": c.line_seq,
			"chat": c.chat["id"] if c.chat != null else 0,
			"with_visitor": c.talking_to_visitor,
		})
	var st: Dictionary = sim.state
	var lm: Dictionary = sim.landmarks
	return {
		"aspect": _aspect(), "star": focus, "cast": cast,
		"events": {
			"donut": st["donut"], "cake": st["cake"],
			"printer": lm.get("printer") if st["printer_jammed"] else null,
			"lamp": lm.get("lamp") if st["lamp_flicker"] else null,
			"meeting": lm.get("whiteboard") if sim.current_event() == "meeting" else null,
			"party": party.boombox if party_on else null,
		},
	}


func _followed():
	for c in sim.cast:
		if c.type == focus and c.present:
			return c
	return null


func _eyes():
	if not pov:
		return null
	for c in sim.cast:
		if c.type == focus and c.present and c.opacity > 0.5:
			return c
	return null


## Returns true while the camera is in a character's head.
func _update_pov(dt: float) -> bool:
	var me = _eyes()
	if me == null:
		if in_pov:
			in_pov = false
			_sync_orbit()
		pov_hidden = null
		held.clear()
		sim.drive("")
		return false
	var move := (1.0 if held.has("forward") else 0.0) - (1.0 if held.has("back") else 0.0)
	var turn := (1.0 if held.has("left") else 0.0) - (1.0 if held.has("right") else 0.0)
	sim.drive(me.type, move, turn)
	if not in_pov or pov_hidden != me:
		pov_yaw = me.heading
	in_pov = true
	directing = false
	pov_hidden = me
	pov_yaw += Sim.angle_delta(pov_yaw, me.heading) * minf(1.0, dt * 6.0)
	if now - pov_turned_at > 1.5:
		var back := exp(-dt * 2.5)
		pov_look *= back
	var bob := sin(sim.time * 9.0) * 0.014 * minf(1.0, me.speed)
	var v := View.eye_view(me.type, me.pos.x, me.pos.y, pov_yaw, pov_look.x, pov_look.y, bob)
	var k := 1.0 - exp(-dt * 7.0)
	camera.global_position = camera.global_position.lerp(v["pos"], k)
	look_at = look_at.lerp(v["target"], k)
	var fov := 92.0 if _aspect() < 0.9 else View.EYE_FOV
	camera.fov += (fov - camera.fov) * k
	_look(look_at)
	return true


func _update_camera(dt: float) -> void:
	now += dt
	if fixed_cam.size() == 2:
		camera.global_position = fixed_cam[0]
		_look(fixed_cam[1])
		return
	if spin:
		_take_over()
		orbit.z += dt * 0.08
	var c = _followed()
	focus_blend += ((1.0 if c != null else 0.0) - focus_blend) * minf(1.0, dt * 3.0)
	# The director keeps working out its shot even in first person.
	var shot: Variant = director.update(_scene_now(), dt) if director_on else null
	if _update_pov(dt):
		hud.set_hint(true)
		return
	hud.set_hint(false)
	if shot != null and now >= hands_off_until:
		if not directing and last_cut >= 0:
			settle_until = now + 4.0
			last_cut = shot["cut"]
		var cut: bool = shot["cut"] != last_cut
		directing = true
		last_cut = shot["cut"]
		var ease_rate: float = minf(shot["ease"], 0.9) if now < settle_until else shot["ease"]
		var k := 1.0 if cut else 1.0 - exp(-dt * ease_rate)
		camera.global_position = camera.global_position.lerp(shot["pos"], k)
		look_at = look_at.lerp(shot["target"], k)
		camera.fov += (shot["fov"] - camera.fov) * k
		_look(look_at)
	else:
		_hand_over()
		var goal := HOME
		if c != null:
			var p := View.inset_point(c.pos.x, c.pos.y, bounds)
			goal = Vector3(p.x, 0.6 if c.type == "ghost" else 1.0, p.y)
		orbit_target = orbit_target.lerp(goal, minf(1.0, dt * (3.0 if c != null else 0.6)))
		camera.fov += (_base_fov() - camera.fov) * minf(1.0, dt * 4.0)
		_place_inside()
	if _knock > 0.0:
		_knock = maxf(0.0, _knock - dt)
		camera.h_offset = sin(_knock * 90.0) * 0.012 * (_knock / 0.25)
	else:
		camera.h_offset = 0.0


# ---- What the simulation shows and sounds like ----

func _show_events() -> void:
	var st: Dictionary = sim.state
	var t: float = sim.time
	var pr: Dictionary = pieces.get("printer", {})
	if pr.has("machine"):
		var machine: Node3D = pr["machine"]
		var display: StandardMaterial3D = pr["display"]
		if st["printer_jammed"]:
			machine.rotation.z = sin(t * 40.0) * 0.012
			display.emission = Color8(0xd4, 0x56, 0x3f) * (0.55 + 0.45 * sin(t * 9.0))
		elif seen["jam"]:
			machine.rotation.z = 0.0
			lighting.refresh()
	var lamp: Dictionary = pieces.get("lamp_arc_big", {})
	if lamp.get("light") != null:
		if st["lamp_flicker"]:
			var on := sin(t * 31.0) + sin(t * 17.3) > 0.1
			lamp["light"].light_energy = 1.4 if on else 0.06
			lamp["bulb"].albedo_color = Color(1, 0.86, 0.5) if on else Color(0.5, 0.47, 0.4)
		elif seen["flicker"]:
			lighting.refresh()
	if st["printer_jammed"] != seen["jam"]:
		sound.play("jam" if st["printer_jammed"] else "fixed")
	if st["lamp_flicker"] and not seen["flicker"]:
		sound.play("flicker")
	if st["donut"] != null and not seen["donut"]:
		sound.play("donut")
	if st["donut_wins"] != seen["donut_wins"]:
		sound.play("win")
	if st["cake"] != null and not seen["cake"]:
		sound.play("cake")
	seen["jam"] = st["printer_jammed"]
	seen["flicker"] = st["lamp_flicker"]
	seen["donut"] = st["donut"] != null
	seen["donut_wins"] = st["donut_wins"]
	seen["cake"] = st["cake"] != null
	for c in sim.cast:
		if c.line_seq != seen_lines[c.type]:
			seen_lines[c.type] = c.line_seq
			if t - last_speak_sound > 0.25:
				last_speak_sound = t
				sound.play("speak", { "pitch": PITCH[c.type] })
		if c.present != seen_present[c.type]:
			seen_present[c.type] = c.present
			sound.play("ghost" if c.type == "ghost" else "door")
	# New diary entries. sim.log drops old entries past its limit, so count
	# from the end by matching the last one seen.
	var log: Array = sim.log
	var from := log.size()
	while from > 0 and not is_same(log[from - 1], seen.get("entry")):
		from -= 1
	if from == 0 and seen.get("entry") == null:
		from = 0
	for i in range(from, log.size()):
		var e: Dictionary = daylog.add(log[i]["text"])
		hud.add_log(e["at"], e["text"])
	if log.size() > 0:
		seen["entry"] = log[log.size() - 1]


func _update_art() -> void:
	# Character art arrives in stages: idle first, then walking, then dancing.
	var staff: Array = []
	for t in standees:
		if t != "ghost":
			staff.append(standees[t])
	var all_ready := func(stage: String) -> bool:
		for s in staff:
			if not s.stage_ready(stage):
				return false
		return true
	if art_stage == 0 and all_ready.call("idle"):
		art_stage = 1
		hud.hide_loading()
		for s in staff:
			s.load_walk()
	elif art_stage == 1 and all_ready.call("walk"):
		art_stage = 2
		for s in staff:
			s.load_dance()
	elif art_stage == 2 and all_ready.call("dance"):
		art_stage = 3
		party_art_ready = true
		hud.set_party_ready()
		if opts.has("party") and not party_on:
			party_on = true
			hud.set_pressed("party", true)
	if not ghost_art_requested and sim.ghost_due_in() < GHOST_ART_LEAD_S:
		ghost_art_requested = true
		standees["ghost"].load_all()


# ---- Loop ----

## One step of the office. With draw false the overlay is not updated.
func frame(dt: float, draw := true) -> void:
	lighting.update(current_phase(), dt)
	_update_camera(dt)
	var d := Time.get_datetime_dict_from_system()
	room.set_clock(hour_override if hour_override >= 0 else d["hour"], d["minute"], d["second"])
	sim.visitor = Vector2(camera.global_position.x, camera.global_position.z)
	sim.update(dt)
	_update_art()
	_show_events()
	props.update(sim.state, sim.time, dt)
	party.update(party_on, sim.time, dt, sound.beat() if sound.enabled and sound.music_wanted else null)
	var cam_pos := camera.global_position
	for c in sim.cast:
		var s = standees[c.type]
		s.set_opacity(c.opacity)
		s.set_dancing(party_on and c.present and c.speed <= 0.15)
		if not c.present:
			continue
		s.position = Vector3(c.pos.x, 0, c.pos.y)
		s.heading = c.heading
		s.update_card(sim.time, dt, c.speed, cam_pos)
		# Seen from inside, their own cut-out would fill the view.
		s.visible = c != pov_hidden and c.opacity > 0.0
	if not draw:
		return
	var people: Array = []
	for c in sim.cast:
		var head := Vector3(c.pos.x, 0.98 if c.type == "ghost" else 1.74, c.pos.y)
		var own: bool = c == pov_hidden
		var on_screen: bool = c.present and not camera.is_position_behind(head)
		people.append({
			"type": c.type, "line": c.line if c.present else "", "line_seq": c.line_seq, "own": own,
			"head": camera.unproject_position(head) if on_screen else null,
		})
	hud.place_bubbles(people, dt)


func _process(delta: float) -> void:
	frame(minf(delta, 1.0 / 20.0))
	if screenshot_at >= 0.0:
		screenshot_at -= delta
		if screenshot_at < 0.0:
			_save_screenshot()


func _save_screenshot() -> void:
	await RenderingServer.frame_post_draw
	var img := get_viewport().get_texture().get_image()
	var path: String = opts["screenshot"]
	img.save_png(path)
	print("saved ", path)
	get_tree().quit()


## Fast-forward: simulate every frame, update the overlay only at the end.
func step(seconds: float, fps := 30.0) -> void:
	var n := roundi(seconds * fps)
	for i in range(1, n + 1):
		frame(1.0 / fps, i == n)
