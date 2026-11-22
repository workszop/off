## Dialogue banks, conversation topics, day phases and staff shifts.
## Loaded once from res://data/dialogue.json (generated from the old data.js),
## then shared. Everything here is plain data: no nodes.
extends RefCounted

const PATH := "res://data/dialogue.json"
const CAST := ["andy", "jazz", "olex", "ghost", "margo"]

static var _d: Dictionary = {}
static var _topics: Array = []
static var _topic_lines: Dictionary = {}


static func all() -> Dictionary:
	if _d.is_empty():
		var f := FileAccess.open(PATH, FileAccess.READ)
		assert(f != null, "missing " + PATH)
		_d = JSON.parse_string(f.get_as_text())
		_build_topics()
	return _d


static func bank(name: String) -> Dictionary:
	return all().get(name, {})


static func names() -> Dictionary:
	return all()["NAMES"]


static func display_name(type: String) -> String:
	return names().get(type, type.capitalize())


## Topics with compiled patterns: [{ key, label, regex }].
static func topics() -> Array:
	all()
	return _topics


## A character's general lines sorted by topic: type -> topic key -> lines.
static func topic_lines() -> Dictionary:
	all()
	return _topic_lines


static func matches(topic: Dictionary, line: String) -> bool:
	return (topic["regex"] as RegEx).search(line) != null


static func _build_topics() -> void:
	_topics.clear()
	for t in _d["TOPICS"]:
		var re := RegEx.new()
		re.compile(t["pattern"])
		_topics.append({ "key": t["key"], "label": t["label"], "regex": re })
	_topic_lines.clear()
	var banks: Dictionary = _d["DIALOGUE_BANKS"]
	for type in banks:
		var by_topic := {}
		for t in _topics:
			var lines: Array = []
			for l in banks[type]:
				if matches(t, l):
					lines.append(l)
			by_topic[t["key"]] = lines
		_topic_lines[type] = by_topic


static func day_phases() -> Array:
	return all()["DAY_PHASES"]


static func party_phase() -> Dictionary:
	return all()["PARTY_PHASE"]


static func phase_info(key: String) -> Dictionary:
	if key == "party":
		return party_phase()
	for p in day_phases():
		if p["key"] == key:
			return p
	return {}


## The phase key for an hour of the day (0-23).
static func phase_for_hour(hour: int) -> String:
	for p in day_phases():
		var from: int = int(p["from"])
		var to: int = int(p["to"])
		var inside := (hour >= from and hour < to) if from < to else (hour >= from or hour < to)
		if inside:
			return p["key"]
	return "midday"
