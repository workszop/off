## The Today diary: what has happened in the office, stamped with the clock
## time, kept in user://daylog.json for the rest of the day.
extends RefCounted

const PATH := "user://daylog.json"
const LIMIT := 80

var day := ""
var entries: Array = []      # [{ at, text }]


static func _day_of(d: Dictionary) -> String:
	return "%04d-%02d-%02d" % [d["year"], d["month"], d["day"]]


func _init() -> void:
	day = _day_of(Time.get_datetime_dict_from_system())
	if FileAccess.file_exists(PATH):
		var saved = JSON.parse_string(FileAccess.get_file_as_string(PATH))
		if saved is Dictionary and saved.get("day") == day and saved.get("entries") is Array:
			for e in saved["entries"]:
				if e is Dictionary and e.get("at") is String and e.get("text") is String:
					entries.append(e)
			entries = entries.slice(-LIMIT)


func _save() -> void:
	var f := FileAccess.open(PATH, FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify({ "day": day, "entries": entries }))


## Add an entry; returns it ({ at, text }).
func add(text: String) -> Dictionary:
	var now := Time.get_datetime_dict_from_system()
	if _day_of(now) != day:
		day = _day_of(now)
		entries.clear()
	var entry := { "at": "%02d:%02d" % [now["hour"], now["minute"]], "text": text }
	entries.append(entry)
	if entries.size() > LIMIT:
		entries.pop_front()
	_save()
	return entry


func recent(n: int) -> Array:
	return entries.slice(-n).map(func(e): return e["text"])
