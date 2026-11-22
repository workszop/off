## A walkability grid over the room floor (0.2 m cells). Furniture footprints
## are stamped in, inflated by the character radius; A* finds a path and a
## line-of-sight pass trims it to a few straight legs.
##
## Points are Vector2(x, z) on the floor.
extends RefCounted

var x0: float
var z0: float
var x1: float
var z1: float
var cell: float
var cols: int
var rows: int
var blocked: PackedByteArray


func _init(ax0: float, az0: float, ax1: float, az1: float, acell := 0.2) -> void:
	x0 = ax0; z0 = az0; x1 = ax1; z1 = az1; cell = acell
	cols = ceili((x1 - x0) / cell)
	rows = ceili((z1 - z0) / cell)
	blocked = PackedByteArray()
	blocked.resize(cols * rows)


## Block a rectangle, inflated by `pad`.
func block_rect(bx0: float, bz0: float, bx1: float, bz1: float, pad := 0.0) -> void:
	var a := to_cell(bx0 - pad, bz0 - pad)
	var b := to_cell(bx1 + pad, bz1 + pad)
	for r in range(maxi(0, a.y), mini(rows - 1, b.y) + 1):
		for c in range(maxi(0, a.x), mini(cols - 1, b.x) + 1):
			blocked[r * cols + c] = 1


func to_cell(x: float, z: float) -> Vector2i:
	return Vector2i(floori((x - x0) / cell), floori((z - z0) / cell))


func to_world(c: int, r: int) -> Vector2:
	return Vector2(x0 + (c + 0.5) * cell, z0 + (r + 0.5) * cell)


func inside(c: int, r: int) -> bool:
	return c >= 0 and r >= 0 and c < cols and r < rows


func cell_free(c: int, r: int) -> bool:
	return inside(c, r) and blocked[r * cols + c] == 0


func free_at(x: float, z: float) -> bool:
	var c := to_cell(x, z)
	return cell_free(c.x, c.y)


## Nearest free cell to a point (spiral search), or Vector2i(-1, -1).
func nearest_free(x: float, z: float) -> Vector2i:
	var c := to_cell(x, z)
	if cell_free(c.x, c.y):
		return c
	for rad in range(1, 20):
		for dr in range(-rad, rad + 1):
			for dc in range(-rad, rad + 1):
				if maxi(absi(dr), absi(dc)) == rad and cell_free(c.x + dc, c.y + dr):
					return Vector2i(c.x + dc, c.y + dr)
	return Vector2i(-1, -1)


func random_free(rng: RandomNumberGenerator) -> Vector2:
	for i in 200:
		var c := int(rng.randf() * cols)
		var r := int(rng.randf() * rows)
		if cell_free(c, r):
			return to_world(c, r)
	return to_world(cols >> 1, rows >> 1)


func line_of_sight(a: Vector2, b: Vector2) -> bool:
	var d := a.distance_to(b)
	var steps := maxi(1, ceili(d / (cell * 0.4)))
	for i in steps + 1:
		var p := a.lerp(b, float(i) / steps)
		if not free_at(p.x, p.y):
			return false
	return true


## A* with 8-way moves (no corner cutting). Returns world waypoints, or an
## empty array when there is no way through.
func path(a: Vector2, b: Vector2) -> Array:
	var start := nearest_free(a.x, a.y)
	var goal := nearest_free(b.x, b.y)
	if start.x < 0 or goal.x < 0:
		return []
	var n := cols * rows
	var g := PackedFloat32Array()
	g.resize(n)
	g.fill(INF)
	var came := PackedInt32Array()
	came.resize(n)
	came.fill(-1)
	var closed := PackedByteArray()
	closed.resize(n)
	var goal_i := goal.y * cols + goal.x
	var start_i := start.y * cols + start.x
	var h := func(c: int, r: int) -> float:
		var dx := absi(c - goal.x)
		var dz := absi(r - goal.y)
		return maxi(dx, dz) + (sqrt(2.0) - 1.0) * mini(dx, dz)
	# Open list as a binary heap of [f, index].
	var heap: Array = [[h.call(start.x, start.y), start_i]]
	g[start_i] = 0.0
	while heap.size() > 0:
		var top: Array = _heap_pop(heap)
		var ci: int = top[1]
		if ci == goal_i:
			break
		if closed[ci]:
			continue
		closed[ci] = 1
		var c := ci % cols
		var r := ci / cols
		for dr in [-1, 0, 1]:
			for dc in [-1, 0, 1]:
				if dr == 0 and dc == 0:
					continue
				var nc: int = c + dc
				var nr: int = r + dr
				if not cell_free(nc, nr):
					continue
				if dc != 0 and dr != 0 and (not cell_free(c + dc, r) or not cell_free(c, r + dr)):
					continue
				var ni := nr * cols + nc
				var cost: float = g[ci] + (1.41421356 if (dc != 0 and dr != 0) else 1.0)
				if cost < g[ni]:
					g[ni] = cost
					came[ni] = ci
					_heap_push(heap, [cost + h.call(nc, nr), ni])
	if came[goal_i] == -1 and start_i != goal_i:
		return []
	var cells: Array = []
	var i := goal_i
	while i != -1:
		cells.append(to_world(i % cols, i / cols))
		i = came[i]
	cells.reverse()
	if free_at(b.x, b.y):
		cells[cells.size() - 1] = b
	# String-pull: keep only waypoints needed to stay in the clear.
	var out: Array = []
	var from := a
	var k := 0
	while k < cells.size():
		var j := cells.size() - 1
		while j > k and not line_of_sight(from, cells[j]):
			j -= 1
		out.append(cells[j])
		from = cells[j]
		k = j + 1
	return out


static func _heap_push(heap: Array, item: Array) -> void:
	heap.append(item)
	var i := heap.size() - 1
	while i > 0:
		var p := (i - 1) >> 1
		if heap[p][0] <= heap[i][0]:
			break
		var t = heap[p]; heap[p] = heap[i]; heap[i] = t
		i = p


static func _heap_pop(heap: Array) -> Array:
	var top: Array = heap[0]
	var last: Array = heap.pop_back()
	if heap.size() > 0:
		heap[0] = last
		var i := 0
		var n := heap.size()
		while true:
			var l := i * 2 + 1
			var r := l + 1
			var m := i
			if l < n and heap[l][0] < heap[m][0]:
				m = l
			if r < n and heap[r][0] < heap[m][0]:
				m = r
			if m == i:
				break
			var t = heap[m]; heap[m] = heap[i]; heap[i] = t
			i = m
	return top
