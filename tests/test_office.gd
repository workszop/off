## Smoke test of the whole office scene, headless:
##   godot --headless --script res://tests/test_office.gd
## Loads the scene, lets the art arrive, and pokes the office the way a
## visitor would: tap the glass, jam the printer, drop a donut, follow
## someone, look through their eyes, throw a party, send everyone home.
extends SceneTree

var failures := 0
var office


func check(ok: bool, what: String) -> void:
	if ok:
		print("  ok   ", what)
	else:
		failures += 1
		printerr("  FAIL ", what)


## End whatever office event is running, letting its people go.
func settle() -> void:
	if office.sim.events.current != null:
		office.sim.events._finish()
	office.sim.events.next_at = office.sim.time + 1000.0


func frames(n: int) -> void:
	for i in n:
		await process_frame


func _initialize() -> void:
	office = load("res://scenes/office.tscn").instantiate()
	office.opts["seed"] = "7"   # a repeatable day
	root.add_child(office)
	await frames(2)
	print("office")
	check(office.sim.cast.size() == 5, "the five-character cast is there")
	check(office.standees.size() == 5, "everyone has a standee")
	var waited := 0
	while office.art_stage < 3 and waited < 600:
		await frames(1)
		waited += 1
	check(office.art_stage == 3, "character art arrived in stages (%d frames)" % waited)
	check(office.party_art_ready, "the Party button is enabled once the dance art is in")
	check(not office.hud.loading.visible, "the loading note has gone")

	office.set_phase("midday")
	office.step(30.0)
	var spoke := false
	var bubble_shown := false
	for i in 60:
		office.step(1.0)
		for c in office.sim.cast:
			if c.line != "" and c.present:
				spoke = true
				for t in office.hud.bubbles:
					if office.hud.bubbles[t]["panel"].visible:
						bubble_shown = true
	check(spoke, "someone speaks")
	check(bubble_shown, "a speech bubble shows")

	print("poking")
	settle()
	office.step(6.0)
	for c in office.sim.cast:
		c.chat = null
	office.tap_glass()
	var looked := 0
	for c in office.sim.cast:
		if c.look != null:
			looked += 1
	check(looked > 0, "tapping the glass makes people look up")
	check(office.sim.trigger("printerJam"), "the printer jams")
	office.step(1.0)
	check(absf(office.pieces["printer"]["machine"].rotation.z) > 0.0 or office.sim.state["printer_jammed"] == false, "the jammed printer shudders")
	office.step(40.0)
	check(not office.sim.state["printer_jammed"], "the printer is fixed")
	settle()
	check(office.sim.drop_donut(Vector2(0, 0.5)), "a donut can be dropped")
	office.step(35.0)
	check(office.sim.state["donut"] == null, "the donut race is over")
	check(office.daylog.entries.size() > 0, "the diary filled (%d entries)" % office.daylog.entries.size())
	check(office.hud.log_list.get_child_count() > 1, "the diary panel lists them")

	print("camera")
	office.set_director(true, false)
	office.step(2.0)
	check(office.directing, "the director has the camera")
	var b: Dictionary = office.bounds
	var p: Vector3 = office.camera.global_position
	check(absf(p.x) <= b["x"] + 0.05 and absf(p.z) <= b["z"] + 0.05 and p.y < 3.6, "the camera stays in the room")
	office.set_focus("margo")
	office.set_pov(true)
	office.step(1.0)
	check(office.in_pov and office.pov_hidden == office.sim.margo, "first person through Margo's eyes")
	check(not office.standees["margo"].visible, "her own cut-out is hidden")
	office.set_focus("")
	office.step(0.5)
	check(not office.in_pov, "Everyone leaves first person")

	print("party")
	office.set_party(true)
	office.step(3.0)
	check(office.party_on and office.party.fade > 0.9, "the party is on")
	var dancing := false
	for t in office.standees:
		if office.standees[t].dancing:
			dancing = true
	check(dancing, "someone dances")
	office.set_party(false)
	office.step(3.0)
	check(not office.party_on, "the party can be turned off")

	print("Margo")
	office.hud.set_chat_open(true)
	office.step(0.5)
	check(office.sim.margo.talking_to_visitor, "opening the chat turns Margo to the visitor")
	office.hud.set_chat_open(false)
	office.step(0.5)
	check(not office.sim.margo.talking_to_visitor, "closing it lets her go")

	print("night")
	settle()
	office.set_phase("night")
	office.step(120.0)
	var staff_in := 0
	for c in office.sim.cast:
		if c.type in ["andy", "jazz", "olex"] and c.present:
			staff_in += 1
	check(staff_in == 0, "the staff go home at night")

	print("")
	if failures:
		printerr("%d check(s) failed" % failures)
	else:
		print("all checks passed")
	quit(1 if failures else 0)
