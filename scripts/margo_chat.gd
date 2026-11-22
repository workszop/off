## Talk to Margo: messages go to the chat proxy (worker/margo), which adds
## Margo's persona and calls the model. With no endpoint configured, Margo
## explains, in character, that she's offline. The proxy needs a password:
## the panel asks for it once, checks it with /auth and remembers it in
## user://settings.cfg.
##
## Settings (Project Settings, "offquarium/"):
##   margo_endpoint  the proxy's /chat address ("" = offline)
##   margo_origin    the Origin header a desktop build sends; add the same
##                   value to the proxy's ALLOWED_ORIGINS (a web build sends
##                   its page origin itself)
extends Node

signal reply(text: String)

const GREETING := "Status: available. Enthusiasm: pending. What do you need?"
const LOCKED_GREETING := "Access control engaged. Password first. I didn't make the rules. Fine, I made this one."
const ERRORS := {
	429: "Too many messages. Rate limiter engaged. I didn't make the rules. I agree with them, though.",
	0: "Connection dropped. Not my fault. Probably. Try again in a moment.",
}
const PASSWORD_LINES := {
	"granted": "Password accepted. Enthusiasm: pending. What do you need?",
	"wrong": "Password rejected. Try again, or don't. Episode 212 isn't going to watch itself.",
	"expired": "My password changed and yours did not. Enter the new one.",
}
const DEFAULT_ENDPOINT := "https://offquarium-margo.andrzey-jankowski.workers.dev/chat"
const SETTINGS := "user://settings.cfg"
const HISTORY_LIMIT := 16
const TIMEOUT_S := 30.0

var hud
var offline_lines: Array = []
var get_context: Callable = func() -> String: return ""
var endpoint := ""
var origin := ""
var password := ""
var lock := "offline"       # offline | locked | unlocked
var history: Array = []
var busy := false
var _greeted := false


func setup(a_hud, lines: Array, context: Callable) -> void:
	hud = a_hud
	offline_lines = lines
	get_context = context
	endpoint = str(ProjectSettings.get_setting("offquarium/margo_endpoint", DEFAULT_ENDPOINT)).strip_edges()
	origin = str(ProjectSettings.get_setting("offquarium/margo_origin", "app://offquarium")).strip_edges()
	var cfg := ConfigFile.new()
	cfg.load(SETTINGS)
	password = cfg.get_value("margo", "password", "") if endpoint != "" else ""
	_set_lock("offline" if endpoint == "" else ("unlocked" if password != "" else "locked"))
	hud.margo_message.connect(_on_message)
	hud.margo_open_changed.connect(func(open):
		if open and not _greeted:
			_greeted = true
			hud.add_chat("margo", LOCKED_GREETING if lock == "locked" else GREETING))


func _status() -> String:
	if busy:
		return "Processing. Reluctantly…"
	return { "offline": "Office construct · chat link not connected", "locked": "Office construct · password needed", "unlocked": "Office construct · reluctantly available" }[lock]


func _set_lock(next: String) -> void:
	lock = next
	hud.set_chat_secret(lock == "locked")
	hud.set_chat_busy(busy, _status())


func _set_busy(on: bool) -> void:
	busy = on
	hud.set_chat_busy(on, _status())


func _store_password(value: String) -> void:
	var cfg := ConfigFile.new()
	cfg.load(SETTINGS)
	cfg.set_value("margo", "password", value)
	cfg.save(SETTINGS)


## POST JSON; returns [status code (0 on failure), parsed body or null].
func _post(url: String, body: Dictionary) -> Array:
	var http := HTTPRequest.new()
	http.timeout = TIMEOUT_S
	add_child(http)
	var headers := PackedStringArray(["Content-Type: application/json", "X-Margo-Password: " + password])
	if not OS.has_feature("web") and origin != "":
		headers.append("Origin: " + origin)
	var err := http.request(url, headers, HTTPClient.METHOD_POST, JSON.stringify(body))
	if err != OK:
		http.queue_free()
		return [0, null]
	var res: Array = await http.request_completed
	http.queue_free()
	if res[0] != HTTPRequest.RESULT_SUCCESS:
		return [0, null]
	var text: String = (res[3] as PackedByteArray).get_string_from_utf8()
	return [int(res[1]), JSON.parse_string(text) if text != "" else null]


func _unlock(candidate: String) -> String:
	password = candidate
	var r := await _post(endpoint.trim_suffix("/chat") + "/auth", {})
	if r[0] >= 200 and r[0] < 300:
		_store_password(password)
		_set_lock("unlocked")
		return PASSWORD_LINES["granted"]
	password = ""
	return PASSWORD_LINES["wrong"] if r[0] == 401 else ERRORS.get(r[0], ERRORS[0])


func _ask() -> Array:
	if endpoint == "":
		await get_tree().create_timer(0.6).timeout
		return [offline_lines[randi() % offline_lines.size()], false]
	var r := await _post(endpoint, { "messages": history.slice(-HISTORY_LIMIT), "context": get_context.call() })
	if r[0] == 401:
		password = ""
		_store_password("")
		_set_lock("locked")
		return [PASSWORD_LINES["expired"], false]
	if r[0] < 200 or r[0] >= 300:
		return [ERRORS.get(r[0], ERRORS[0]), false]
	var data = r[1]
	if data is Dictionary and data.get("reply") is String and data["reply"] != "":
		return [data["reply"], true]
	return [ERRORS[0], false]


func _on_message(text: String) -> void:
	if busy:
		return
	if lock == "locked":
		hud.add_chat("you", "•".repeat(mini(text.length(), 12)))  # never show the password
		_set_busy(true)
		var line: String = await _unlock(text)
		_set_busy(false)
		hud.add_chat("margo", line)
		reply.emit(line)
		return
	hud.add_chat("you", text)
	history.append({ "role": "user", "content": text })
	_set_busy(true)
	var r: Array = await _ask()
	_set_busy(false)
	if r[1]:
		history.append({ "role": "assistant", "content": r[0] })
	else:
		history.pop_back()  # keep history to completed exchanges only
	hud.add_chat("margo", r[0])
	reply.emit(r[0])
