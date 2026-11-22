## The overlay: the top bar (title, camera, time of day, Talk to Margo), the
## bottom dock (follow, poke, sound, diary), the speech bubbles, the Today
## diary and the Talk to Margo panel. It only shows things and reports
## clicks; office.gd decides what they do.
extends CanvasLayer

const Data := preload("res://scripts/data.gd")

signal phase_picked(key: String)
signal focus_picked(type: String)
signal toggled(what: String, on: bool)      # director, pov, spin, party, sound
signal tap_pressed
signal margo_open_changed(open: bool)
signal margo_message(text: String)

const INK := Color8(0x29, 0x28, 0x24)
const MUTED := Color8(0x77, 0x73, 0x6b)
const PAPER_DEEP := Color8(0xe9, 0xe0, 0xd2)
const SURFACE := Color8(0xff, 0xfd, 0xf8)
const ACCENTS := {
	"andy": Color8(0xd4, 0x76, 0x5f), "jazz": Color8(0x7b, 0xa3, 0x8c), "olex": Color8(0xa8, 0x94, 0xc7),
	"ghost": Color8(0x6a, 0xa3, 0xd8), "margo": Color8(0x5a, 0x5e, 0x9e),
}
const PHASES := ["live", "morning", "midday", "afternoon", "evening", "night"]
const DEFAULT_HINT := "The director picks the shots · drag or scroll to take the camera · click anyone to poke them"
const POV_HINT := "First person · W A S D or arrow keys to walk · drag to look around · Everyone to leave"

var caveat: Font = load("res://assets/fonts/Caveat-Variable.woff2")
var root: Control
var hint: Label
var title_label: Label
var buttons := {}          # name -> Button
var phase_buttons := {}
var focus_buttons := {}
var bubbles := {}          # type -> { panel, name, text, seq }
var log_panel: PanelContainer
var log_list: VBoxContainer
var log_scroll: ScrollContainer
var log_empty: Label
var log_badge: Label
var unseen := 0
var chat_panel: PanelContainer
var chat_list: VBoxContainer
var chat_scroll: ScrollContainer
var chat_input: LineEdit
var chat_send: Button
var chat_status: Label
var loading: Label


func _ready() -> void:
	layer = 5
	root = Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.theme = _theme()
	add_child(root)
	_build_bubbles()
	_build_top()
	_build_dock()
	_build_log()
	_build_chat()
	loading = Label.new()
	loading.text = "Setting up the office…"
	loading.add_theme_font_override("font", caveat)
	loading.add_theme_font_size_override("font_size", 34)
	loading.add_theme_color_override("font_color", INK)
	loading.set_anchors_preset(Control.PRESET_CENTER)
	loading.grow_horizontal = Control.GROW_DIRECTION_BOTH
	loading.grow_vertical = Control.GROW_DIRECTION_BOTH
	root.add_child(loading)


# ---- Look ----

func _box(bg: Color, border: Color, width := 1.5, radius := 14, pad := 8) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = bg
	s.border_color = border
	s.set_border_width_all(int(ceil(width)))
	s.set_corner_radius_all(radius)
	s.content_margin_left = pad + 4
	s.content_margin_right = pad + 4
	s.content_margin_top = pad - 2
	s.content_margin_bottom = pad - 2
	s.shadow_color = Color(INK, 0.12)
	s.shadow_offset = Vector2(2, 3)
	s.shadow_size = 0
	return s


func _theme() -> Theme:
	var t := Theme.new()
	t.default_font_size = 13
	var normal := _box(SURFACE, Color(INK, 0.55), 1, 14, 7)
	normal.shadow_size = 0
	var hover := _box(Color8(0xfb, 0xf6, 0xec), INK, 1, 14, 7)
	var pressed := _box(INK, INK, 1, 14, 7)
	var disabled := _box(Color(SURFACE, 0.6), Color(INK, 0.25), 1, 14, 7)
	for state in [["normal", normal], ["hover", hover], ["pressed", pressed], ["hover_pressed", pressed], ["disabled", disabled], ["focus", StyleBoxEmpty.new()]]:
		t.set_stylebox(state[0], "Button", state[1])
	t.set_color("font_color", "Button", INK)
	t.set_color("font_hover_color", "Button", INK)
	t.set_color("font_pressed_color", "Button", SURFACE)
	t.set_color("font_hover_pressed_color", "Button", SURFACE)
	t.set_color("font_disabled_color", "Button", Color(INK, 0.45))
	t.set_color("font_color", "Label", INK)
	t.set_stylebox("normal", "LineEdit", _box(SURFACE, Color(INK, 0.4), 1, 10, 6))
	t.set_stylebox("focus", "LineEdit", _box(SURFACE, INK, 1.5, 10, 6))
	t.set_color("font_color", "LineEdit", INK)
	t.set_color("font_placeholder_color", "LineEdit", MUTED)
	t.set_color("caret_color", "LineEdit", INK)
	return t


func _button(text: String, toggle := false, tip := "") -> Button:
	var b := Button.new()
	b.text = text
	b.toggle_mode = toggle
	b.tooltip_text = tip
	b.focus_mode = Control.FOCUS_NONE
	b.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	return b


func _group(parent: Control) -> HBoxContainer:
	var panel := PanelContainer.new()
	var s := _box(Color(SURFACE, 0.82), Color(INK, 0.18), 1, 20, 4)
	s.content_margin_left = 4
	s.content_margin_right = 4
	panel.add_theme_stylebox_override("panel", s)
	parent.add_child(panel)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 4)
	panel.add_child(row)
	return row


# ---- Top bar ----

func _build_top() -> void:
	var bar := HFlowContainer.new()
	bar.set_anchors_preset(Control.PRESET_TOP_WIDE)
	bar.offset_left = 16
	bar.offset_right = -16
	bar.offset_top = 12
	bar.add_theme_constant_override("h_separation", 10)
	bar.add_theme_constant_override("v_separation", 8)
	bar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(bar)
	var title := VBoxContainer.new()
	title.add_theme_constant_override("separation", -4)
	title.mouse_filter = Control.MOUSE_FILTER_IGNORE
	bar.add_child(title)
	var name_label := Label.new()
	name_label.text = "Offquarium office"
	name_label.add_theme_font_override("font", caveat)
	name_label.add_theme_font_size_override("font_size", 32)
	title_label = name_label
	title.add_child(name_label)
	hint = Label.new()
	hint.text = DEFAULT_HINT
	hint.add_theme_font_size_override("font_size", 11)
	hint.add_theme_color_override("font_color", MUTED)
	title.add_child(hint)

	var cam := _group(bar)
	buttons["director"] = _button("Director", true, "Let the director pick the shots. Drag or scroll to take the camera yourself.")
	buttons["pov"] = _button("First person", true, "See the office through the eyes of the character picked below. W A S D or the arrow keys walk them about; drag to look around.")
	for k in ["director", "pov"]:
		cam.add_child(buttons[k])
		buttons[k].toggled.connect(func(on): toggled.emit(k, on))

	var phases := _group(bar)
	for p in PHASES:
		var b := _button(p.capitalize(), true, "Follow the real clock" if p == "live" else "")
		phase_buttons[p] = b
		phases.add_child(b)
		b.pressed.connect(func(): phase_picked.emit(p))

	var talk := _button("Talk to Margo")
	talk.add_theme_stylebox_override("normal", _box(ACCENTS["margo"], ACCENTS["margo"], 1, 16, 8))
	talk.add_theme_stylebox_override("hover", _box(ACCENTS["margo"].lightened(0.1), ACCENTS["margo"], 1, 16, 8))
	talk.add_theme_color_override("font_color", SURFACE)
	talk.add_theme_color_override("font_hover_color", SURFACE)
	buttons["talk"] = talk
	bar.add_child(talk)
	talk.pressed.connect(func(): set_chat_open(not chat_panel.visible))


# ---- Dock ----

func _build_dock() -> void:
	var dock := HFlowContainer.new()
	dock.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	dock.offset_left = 16
	dock.offset_right = -16
	dock.offset_bottom = -14
	dock.grow_vertical = Control.GROW_DIRECTION_BEGIN
	dock.add_theme_constant_override("h_separation", 8)
	dock.add_theme_constant_override("v_separation", 6)
	dock.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(dock)
	var follow := _group(dock)
	for t in [""] + Data.CAST:
		var b := _button("Everyone" if t == "" else Data.display_name(t), true)
		if t != "":
			b.icon = _dot(ACCENTS[t])
		focus_buttons[t] = b
		follow.add_child(b)
		b.pressed.connect(func(): focus_picked.emit(t))
	buttons["spin"] = _button("Spin", true, "Turn the room slowly")
	follow.add_child(buttons["spin"])
	buttons["spin"].toggled.connect(func(on): toggled.emit("spin", on))

	var poke := _group(dock)
	var tap := _button("Tap the glass", false, "Everyone looks up")
	poke.add_child(tap)
	tap.pressed.connect(func(): tap_pressed.emit())
	buttons["party"] = _button("Party", true, "Lights down, disco ball and boombox on, the moon out. Press P too.")
	buttons["party"].disabled = true
	buttons["party"].tooltip_text = "Loading the dance art..."
	poke.add_child(buttons["party"])
	buttons["party"].toggled.connect(func(on): toggled.emit("party", on))

	var misc := _group(dock)
	buttons["sound"] = _button("Sound", true)
	misc.add_child(buttons["sound"])
	buttons["sound"].toggled.connect(func(on): toggled.emit("sound", on))
	var today := _button("Today", true)
	buttons["today"] = today
	misc.add_child(today)
	log_badge = Label.new()
	log_badge.add_theme_font_size_override("font_size", 10)
	log_badge.add_theme_color_override("font_color", SURFACE)
	var bs := _box(ACCENTS["andy"], ACCENTS["andy"], 0, 8, 2)
	bs.content_margin_left = 5
	bs.content_margin_right = 5
	log_badge.add_theme_stylebox_override("normal", bs)
	log_badge.visible = false
	misc.add_child(log_badge)
	today.toggled.connect(func(on): set_log_open(on))


func _dot(c: Color) -> Texture2D:
	var img := Image.create(10, 10, false, Image.FORMAT_RGBA8)
	for y in 10:
		for x in 10:
			var d := Vector2(x - 4.5, y - 4.5).length()
			img.set_pixel(x, y, Color(c, clampf(4.6 - d, 0.0, 1.0)))
	return ImageTexture.create_from_image(img)


## Show which toggle is on without emitting anything.
func set_pressed(name_: String, on: bool) -> void:
	if buttons.has(name_):
		buttons[name_].set_pressed_no_signal(on)


func show_phase(key: String) -> void:
	for p in phase_buttons:
		phase_buttons[p].set_pressed_no_signal(p == key)


func show_focus(type: String) -> void:
	for t in focus_buttons:
		focus_buttons[t].set_pressed_no_signal(t == type)


func set_hint(pov: bool) -> void:
	hint.text = POV_HINT if pov else DEFAULT_HINT


func set_party_ready() -> void:
	buttons["party"].disabled = false
	buttons["party"].tooltip_text = "Lights down, disco ball and boombox on, the moon out. Press P too."


func set_dark(dark: bool) -> void:
	var c := Color8(0xf4, 0xef, 0xe5) if dark else INK
	title_label.add_theme_color_override("font_color", c)
	hint.add_theme_color_override("font_color", Color(c, 0.75) if dark else MUTED)
	loading.add_theme_color_override("font_color", c)


func hide_loading() -> void:
	loading.visible = false


## True when the mouse is over a panel or button (so clicks are not for the room).
func over_ui(pos: Vector2) -> bool:
	var c := root.get_viewport().gui_get_hovered_control()
	return c != null and c != root


# ---- Speech bubbles ----

func _build_bubbles() -> void:
	for t in Data.CAST:
		var panel := PanelContainer.new()
		var s := _box(SURFACE, ACCENTS[t], 1.5, 12, 9)
		s.shadow_size = 1
		s.shadow_offset = Vector2(2, 3)
		panel.add_theme_stylebox_override("panel", s)
		panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
		panel.visible = false
		var col := VBoxContainer.new()
		col.add_theme_constant_override("separation", 1)
		panel.add_child(col)
		var who := Label.new()
		who.text = Data.display_name(t)
		who.add_theme_font_size_override("font_size", 11)
		who.add_theme_color_override("font_color", ACCENTS[t])
		col.add_child(who)
		var text := Label.new()
		text.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		text.custom_minimum_size = Vector2(0, 0)
		text.add_theme_font_size_override("font_size", 13)
		col.add_child(text)
		root.add_child(panel)
		bubbles[t] = { "panel": panel, "text": text, "seq": -1, "pop": 1.0 }


## Keep each bubble over its speaker. people: [{ type, line, line_seq,
## head: Vector2 screen point or null (behind the camera), own: bool }].
func place_bubbles(people: Array, dt: float) -> void:
	var size := root.get_viewport_rect().size
	var max_w := 160.0 if size.x < 560 else 220.0
	for p in people:
		var b: Dictionary = bubbles[p["type"]]
		var panel: PanelContainer = b["panel"]
		if p["line"] == "" or (p["head"] == null and not p["own"]):
			panel.visible = false
			continue
		if b["seq"] != p["line_seq"] or not panel.visible:
			b["seq"] = p["line_seq"]
			b["text"].text = p["line"]
			b["pop"] = 0.0
			panel.visible = true
			b["width"] = -1.0
		var w := minf(440.0, size.x - 32.0) if p["own"] else max_w
		var text: Label = b["text"]
		# Fit narrow lines snugly; wrap long ones at the bubble width.
		var font := text.get_theme_font("font")
		var natural := font.get_string_size(p["line"], HORIZONTAL_ALIGNMENT_LEFT, -1, 13).x + 2.0
		text.custom_minimum_size.x = minf(natural, w - 26.0)
		text.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER if p["own"] else HORIZONTAL_ALIGNMENT_LEFT
		panel.reset_size()
		var ps := panel.get_combined_minimum_size()
		panel.size = ps
		b["pop"] = minf(1.0, b["pop"] + dt / 0.22)
		var k: float = ease(b["pop"], 0.4)
		panel.scale = Vector2(0.4 + 0.6 * k, 0.4 + 0.6 * k)
		panel.modulate.a = k
		var pos: Vector2
		if p["own"]:
			pos = Vector2((size.x - ps.x) / 2.0, size.y - ps.y - 96.0)
		else:
			var head: Vector2 = p["head"]
			pos = Vector2(clampf(head.x - ps.x / 2.0, 8.0, size.x - ps.x - 8.0), maxf(8.0, head.y - ps.y - 12.0))
		panel.pivot_offset = Vector2(ps.x / 2.0, ps.y)
		panel.position = pos.round()


# ---- Today diary ----

func _panel(width: float) -> PanelContainer:
	var p := PanelContainer.new()
	var s := _box(SURFACE, INK, 1.5, 15, 0)
	s.content_margin_left = 0
	s.content_margin_right = 0
	s.content_margin_top = 0
	s.content_margin_bottom = 0
	s.shadow_size = 1
	s.shadow_offset = Vector2(3, 4)
	p.add_theme_stylebox_override("panel", s)
	p.custom_minimum_size = Vector2(width, 0)
	p.visible = false
	return p


func _header(parent: Control, title: String, sub_label: Label, close: Callable) -> void:
	var head := HBoxContainer.new()
	var m := MarginContainer.new()
	for side in ["left", "right", "top", "bottom"]:
		m.add_theme_constant_override("margin_" + side, 10 if side != "left" else 14)
	m.add_child(head)
	parent.add_child(m)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", -2)
	col.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	head.add_child(col)
	var t := Label.new()
	t.text = title
	t.add_theme_font_override("font", caveat)
	t.add_theme_font_size_override("font_size", 24)
	col.add_child(t)
	if sub_label != null:
		sub_label.add_theme_font_size_override("font_size", 11)
		sub_label.add_theme_color_override("font_color", MUTED)
		col.add_child(sub_label)
	var x := Button.new()
	x.text = "×"
	x.flat = true
	x.focus_mode = Control.FOCUS_NONE
	x.add_theme_font_size_override("font_size", 20)
	x.add_theme_color_override("font_color", INK)
	x.add_theme_color_override("font_hover_color", ACCENTS["andy"])
	x.pressed.connect(close)
	head.add_child(x)
	parent.add_child(HSeparator.new())


func _build_log() -> void:
	log_panel = _panel(340)
	log_panel.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	log_panel.offset_left = 16
	log_panel.offset_bottom = -66
	log_panel.grow_vertical = Control.GROW_DIRECTION_BEGIN
	root.add_child(log_panel)
	var col := VBoxContainer.new()
	log_panel.add_child(col)
	_header(col, "Today in the office", null, func(): set_log_open(false))
	log_scroll = ScrollContainer.new()
	log_scroll.custom_minimum_size = Vector2(0, 300)
	log_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	col.add_child(log_scroll)
	var m := MarginContainer.new()
	m.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	for side in ["left", "right", "top", "bottom"]:
		m.add_theme_constant_override("margin_" + side, 12)
	log_scroll.add_child(m)
	log_list = VBoxContainer.new()
	log_list.add_theme_constant_override("separation", 6)
	m.add_child(log_list)
	log_empty = Label.new()
	log_empty.text = "Nothing yet. Give them a minute."
	log_empty.add_theme_color_override("font_color", MUTED)
	log_list.add_child(log_empty)


func set_log_open(open: bool) -> void:
	log_panel.visible = open
	buttons["today"].set_pressed_no_signal(open)
	if open:
		unseen = 0
		log_badge.visible = false
		_scroll_to_end(log_scroll)


func add_log(stamp: String, text: String) -> void:
	log_empty.visible = false
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	var t := Label.new()
	t.text = stamp
	t.add_theme_color_override("font_color", MUTED)
	t.add_theme_font_override("font", load("res://assets/fonts/JetBrainsMono-Variable.woff2"))
	t.add_theme_font_size_override("font_size", 11)
	row.add_child(t)
	var l := Label.new()
	l.text = text
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	l.custom_minimum_size.x = 240
	row.add_child(l)
	log_list.add_child(row)
	while log_list.get_child_count() > 201:
		log_list.get_child(1).queue_free()
	if log_panel.visible:
		_scroll_to_end(log_scroll)
	else:
		unseen += 1
		log_badge.text = str(mini(unseen, 99))
		log_badge.visible = true


func _scroll_to_end(s: ScrollContainer) -> void:
	await get_tree().process_frame
	s.scroll_vertical = int(s.get_v_scroll_bar().max_value)


# ---- Talk to Margo ----

func _build_chat() -> void:
	chat_panel = _panel(340)
	chat_panel.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	chat_panel.offset_right = -16
	chat_panel.offset_top = 64
	chat_panel.grow_horizontal = Control.GROW_DIRECTION_BEGIN
	root.add_child(chat_panel)
	var col := VBoxContainer.new()
	chat_panel.add_child(col)
	chat_status = Label.new()
	_header(col, "Margo", chat_status, func(): set_chat_open(false))
	chat_scroll = ScrollContainer.new()
	chat_scroll.custom_minimum_size = Vector2(0, 280)
	chat_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	col.add_child(chat_scroll)
	var m := MarginContainer.new()
	m.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	for side in ["left", "right", "top", "bottom"]:
		m.add_theme_constant_override("margin_" + side, 10)
	chat_scroll.add_child(m)
	chat_list = VBoxContainer.new()
	chat_list.add_theme_constant_override("separation", 8)
	chat_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	m.add_child(chat_list)
	var form := HBoxContainer.new()
	var fm := MarginContainer.new()
	for side in ["left", "right", "top", "bottom"]:
		fm.add_theme_constant_override("margin_" + side, 10)
	fm.add_child(form)
	col.add_child(fm)
	chat_input = LineEdit.new()
	chat_input.placeholder_text = "Say something to Margo"
	chat_input.max_length = 600
	chat_input.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	form.add_child(chat_input)
	chat_send = _button("Send")
	form.add_child(chat_send)
	chat_input.text_submitted.connect(func(_t): _submit())
	chat_send.pressed.connect(_submit)
	var note := Label.new()
	note.text = "Margo is an AI. Her replies are generated and can be wrong."
	note.add_theme_font_size_override("font_size", 10)
	note.add_theme_color_override("font_color", MUTED)
	note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	var nm := MarginContainer.new()
	nm.add_theme_constant_override("margin_left", 12)
	nm.add_theme_constant_override("margin_right", 12)
	nm.add_theme_constant_override("margin_bottom", 8)
	nm.add_child(note)
	col.add_child(nm)


func _submit() -> void:
	var text := chat_input.text.strip_edges()
	if text == "" or chat_send.disabled:
		return
	chat_input.text = ""
	margo_message.emit(text)


func set_chat_open(open: bool) -> void:
	if chat_panel.visible == open:
		return
	chat_panel.visible = open
	if open:
		chat_input.grab_focus()
	margo_open_changed.emit(open)


func chat_open() -> bool:
	return chat_panel.visible


func set_chat_busy(busy: bool, status: String) -> void:
	chat_send.disabled = busy
	chat_status.text = status


func set_chat_secret(secret: bool) -> void:
	chat_input.secret = secret
	chat_input.placeholder_text = "Password" if secret else "Say something to Margo"


func add_chat(who: String, text: String) -> void:
	var row := HBoxContainer.new()
	var l := Label.new()
	l.text = text
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.custom_minimum_size.x = 220
	var s := _box(Color(ACCENTS["margo"], 0.1) if who == "margo" else PAPER_DEEP, Color(0, 0, 0, 0), 0, 12, 7)
	l.add_theme_stylebox_override("normal", s)
	if who != "margo":
		var spacer := Control.new()
		spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(spacer)
	row.add_child(l)
	chat_list.add_child(row)
	_scroll_to_end(chat_scroll)
