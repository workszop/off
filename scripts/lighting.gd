## Time-of-day lighting. One look per day phase (and the party): the sun,
## the sky, the soft fill, the arc lamp, screen glow and a gentle tint on the
## cardboard cast. Changing phase blends from the current look to the new
## one; once settled, update() does nothing until the phase changes.
##
## Energies are the old three.js intensities divided by PI (three.js divides
## its diffuse by PI, Godot does not), so daylight sums to about 1.
extends RefCounted

const LOOK := {
	"morning":   { "sky": Color8(0xb4, 0xd3, 0xea), "sun": Color8(0xff, 0xd9, 0xa6), "sun_i": 1.15, "sun_pos": Vector3(9, 5, -1), "fill": Color8(0xf8, 0xe9, 0xd6), "fill_i": 2.2, "bg": Color8(0xf2, 0xec, 0xe1), "tint": Color8(0xff, 0xf6, 0xec), "lamp": 0.0, "screens": 0.15 },
	"midday":    { "sky": Color8(0x96, 0xc0, 0xea), "sun": Color8(0xff, 0xf8, 0xec), "sun_i": 1.0, "sun_pos": Vector3(2, 10, 4), "fill": Color8(0xf6, 0xf0, 0xe6), "fill_i": 2.2, "bg": Color8(0xf4, 0xef, 0xe5), "tint": Color8(0xff, 0xff, 0xff), "lamp": 0.0, "screens": 0.1 },
	"afternoon": { "sky": Color8(0xa6, 0xc9, 0xe4), "sun": Color8(0xff, 0xe6, 0xc2), "sun_i": 1.15, "sun_pos": Vector3(-7, 6, 4), "fill": Color8(0xf4, 0xea, 0xda), "fill_i": 2.2, "bg": Color8(0xf1, 0xeb, 0xe0), "tint": Color8(0xfd, 0xf7, 0xee), "lamp": 0.0, "screens": 0.15 },
	"evening":   { "sky": Color8(0xe7, 0xa4, 0x7c), "sun": Color8(0xff, 0x9f, 0x66), "sun_i": 1.25, "sun_pos": Vector3(-10, 3.5, 2), "fill": Color8(0xce, 0xb6, 0xa2), "fill_i": 1.3, "bg": Color8(0xe6, 0xd9, 0xc9), "tint": Color8(0xf3, 0xdc, 0xc8), "lamp": 0.75, "screens": 0.55 },
	"night":     { "sky": Color8(0x22, 0x31, 0x4b), "sun": Color8(0x8e, 0xa5, 0xd6), "sun_i": 0.42, "sun_pos": Vector3(-4, 9, 6), "fill": Color8(0x61, 0x68, 0x84), "fill_i": 0.75, "bg": Color8(0x1d, 0x21, 0x30), "tint": Color8(0xa3, 0xad, 0xc9), "lamp": 1.0, "screens": 1.0 },
	"party":     { "sky": Color8(0x1b, 0x1a, 0x3d), "sun": Color8(0xff, 0x9a, 0x5c), "sun_i": 0.2, "sun_pos": Vector3(-4, 9, 6), "fill": Color8(0xa5, 0x66, 0x43), "fill_i": 0.5, "bg": Color8(0x26, 0x14, 0x10), "tint": Color8(0x6a, 0x54, 0x50), "lamp": 0.25, "screens": 1.0 },
}
const COLORS := ["sky", "sun", "fill", "bg", "tint"]
const NUMBERS := ["sun_i", "fill_i", "lamp", "screens"]
const BLEND_RATE := 1.5
const SETTLED := 0.002

var sun: DirectionalLight3D
var env: Environment
var lamps: Array = []       # furniture pieces with a light: { light, bulb }
var glow: Array = []        # screen materials
var panels: Array = []      # ceiling panel materials
var standees: Array = []
var exterior: Node = null
var look := {}
var settled_on := ""
var on_dark_change: Callable   # called with true/false when the room turns dark/light
var _dark := false


func _init(a_sun: DirectionalLight3D, a_env: Environment) -> void:
	sun = a_sun
	env = a_env


## Apply the look again on the next update (after an event changed a light).
func refresh() -> void:
	settled_on = ""


func update(key: String, dt: float) -> void:
	if key == settled_on:
		return
	var t: Dictionary = LOOK.get(key, LOOK["midday"])
	var rest := 0.0
	if look.is_empty():
		look = t.duplicate()
	else:
		rest = _blend(t, minf(1.0, dt * BLEND_RATE))
	if rest < SETTLED:
		_blend(t, 1.0)
		settled_on = key
	_apply()


func _blend(t: Dictionary, k: float) -> float:
	var rest := 0.0
	for n in COLORS:
		var c: Color = (look[n] as Color).lerp(t[n], k)
		look[n] = c
		var g: Color = t[n]
		rest = maxf(rest, maxf(absf(c.r - g.r), maxf(absf(c.g - g.g), absf(c.b - g.b))))
	for n in NUMBERS:
		look[n] += (t[n] - look[n]) * k
		rest = maxf(rest, absf(t[n] - look[n]))
	look["sun_pos"] = (look["sun_pos"] as Vector3).lerp(t["sun_pos"], k)
	return maxf(rest, (look["sun_pos"] as Vector3).distance_to(t["sun_pos"]) * 0.02)


func _apply() -> void:
	sun.light_color = look["sun"]
	sun.light_energy = look["sun_i"] / PI * 1.15
	var p: Vector3 = look["sun_pos"]
	sun.transform = Transform3D(Basis.looking_at(-p.normalized(), Vector3.UP if absf(p.normalized().y) < 0.99 else Vector3.FORWARD), p)
	env.ambient_light_color = look["fill"]
	env.ambient_light_energy = look["fill_i"] / PI
	env.background_color = look["bg"]
	env.fog_light_color = look["bg"]
	var night: float = clampf((look["screens"] - 0.15) / 0.85, 0.0, 1.0)
	if exterior != null:
		exterior.update(night, look["sky"], look["sky"].get_luminance() < 0.25)
	for s in standees:
		s.set_tint(look["tint"])
	for l in lamps:
		if l["light"] != null:
			l["light"].light_energy = look["lamp"] * 1.6
		if l["bulb"] != null:
			l["bulb"].albedo_color = Color(0.96, 0.92 - 0.05 * look["lamp"], 0.82 - 0.35 * look["lamp"])
	var screen: Color = Color8(0x9f, 0xc3, 0xe0) * (look["screens"] * 0.8)
	for m in glow:
		m.emission = screen
	# The ceiling panels follow the daylight: bright by day, faint at night.
	var day: float = smoothstep(0.75, 2.2, look["fill_i"])
	var panel: Color = Color8(0xff, 0xf6, 0xe4) * (0.04 + 0.3 * day)
	for m in panels:
		m.emission = panel
	var dark: bool = (look["bg"] as Color).get_luminance() < 0.4
	if dark != _dark:
		_dark = dark
		if on_dark_change.is_valid():
			on_dark_change.call(dark)
