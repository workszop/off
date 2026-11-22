## Event props: small paper models that appear during office events, the
## donut everyone races for and the birthday cake. Each is hidden until the
## simulation places it.
##
##   var props = Props.new(); add_child(props)
##   props.update(sim.state, sim.time, dt)   # state.donut / state.cake: Vector2(x, z) or null
extends Node3D

const Paper := preload("res://scripts/paper.gd")

const PINK := Color8(0xe9, 0xa3, 0xad)
const DOUGH := Color8(0xd9, 0xa5, 0x65)
const SPONGE := Color8(0xf1, 0xdf, 0xc0)

var donut := Node3D.new()
var donut_lift := Node3D.new()   # hovers and turns so it can be seen from afar
var cake := Node3D.new()
var flames: Array = []
var _pop := { "donut": 0.0, "cake": 0.0 }   # 0..1 scale-in


func _init() -> void:
	name = "Props"
	add_child(donut)
	donut.add_child(donut_lift)
	var tip := Node3D.new()        # tipped toward the viewer
	tip.rotation.z = 0.5
	donut_lift.add_child(tip)
	Paper.torus(tip, 0.13, 0.065, Vector3.ZERO, Paper.mat(DOUGH))
	var icing := Paper.torus(tip, 0.13, 0.052, Vector3(0, 0.03, 0), Paper.mat(PINK))
	icing.scale = Vector3(1, 0.75, 1)

	add_child(cake)
	Paper.cyl(cake, 0.3, 0.3, 0.02, Vector3.ZERO, Paper.mat(Paper.C.white), 32)          # plate
	Paper.cyl(cake, 0.22, 0.22, 0.16, Vector3(0, 0.02, 0), Paper.mat(SPONGE), 32)
	Paper.cyl(cake, 0.225, 0.225, 0.045, Vector3(0, 0.15, 0), Paper.mat(PINK), 32)
	for i in 5:
		var a := TAU * i / 5.0
		var x := sin(a) * 0.13
		var z := cos(a) * 0.13
		Paper.cyl(cake, 0.008, 0.008, 0.09, Vector3(x, 0.195, z), Paper.mat(Paper.C.white), 8)
		flames.append(Paper.sphere(cake, 0.016, Vector3(x, 0.3, z), Paper.glow(Color8(0xff, 0xc6, 0x6e)), 8))
	donut.visible = false
	cake.visible = false


func _place(prop: Node3D, key: String, at: Variant, dt: float) -> void:
	var here := at != null
	_pop[key] += ((1.0 if here else 0.0) - _pop[key]) * minf(1.0, dt * 9.0)
	prop.visible = here or _pop[key] > 0.01
	if here:
		prop.position = Vector3(at.x, 0, at.y)
	prop.scale = Vector3.ONE * maxf(0.001, _pop[key])


func update(state: Dictionary, time: float, dt: float) -> void:
	_place(donut, "donut", state.get("donut"), dt)
	_place(cake, "cake", state.get("cake"), dt)
	if donut.visible:
		donut_lift.position.y = 0.34 + sin(time * 3.0) * 0.05
		donut_lift.rotation.y = time * 1.6
	if cake.visible:
		for i in flames.size():
			flames[i].scale = Vector3.ONE * (0.85 + sin(time * 11.0 + i * 2.1) * 0.2)
