## Ambient sound, synthesised (no audio files): a quiet room tone, a soft
## blip when someone speaks, a few event sounds, and the party's boombox (a
## 124 BPM beat). Off until the visitor turns it on; the choice is
## remembered in user://settings.cfg.
##
##   sound.set_enabled(true)
##   sound.play("speak", { "pitch": 1.2 })
##   sound.start_music(); sound.beat()   # 0..1, how hard the last kick hit
##
## Everything is mixed by hand into an AudioStreamGenerator: a short list of
## voices (enveloped oscillators and noise bursts), filled a few hundred
## samples a frame.
extends Node

const SETTINGS := "user://settings.cfg"
const RATE := 22050.0
const VOLUME := 0.5
const MAX_VOICES := 24
const BPM := 124.0
const STEP_S := 60.0 / BPM / 4.0
const BASS := [55.0, 0, 55.0, 0, 82.4, 0, 55.0, 0, 65.4, 0, 65.4, 0, 73.4, 0, 82.4, 0]
const ARP := [220.0, 261.6, 329.6, 261.6, 220.0, 329.6, 392.0, 329.6]

var enabled := false
var music_wanted := false

var _player: AudioStreamPlayer
var _playback: AudioStreamGeneratorPlayback
var _clock := 0            # samples mixed so far
var _voices: Array = []    # see _tone / _burst
var _master := 0.0
var _master_goal := 0.0
var _bus := 1.0            # music gain (ducking)
var _duck := 1.0
var _step := 0
var _next_step := -1       # sample of the next music step, -1 = not running
var _kicks: Array = []     # sample times of recent kicks
var _brown := 0.0
var _hum_lp := 0.0
var _buffer_frames := 0


func _ready() -> void:
	var gen := AudioStreamGenerator.new()
	gen.mix_rate = RATE
	gen.buffer_length = 0.1
	_player = AudioStreamPlayer.new()
	_player.stream = gen
	add_child(_player)
	_buffer_frames = int(RATE * gen.buffer_length)


func _start() -> bool:
	if _playback != null:
		return true
	if _player == null:
		return false
	_player.play()
	_playback = _player.get_stream_playback() as AudioStreamGeneratorPlayback
	return _playback != null


func was_on() -> bool:
	var cfg := ConfigFile.new()
	if cfg.load(SETTINGS) != OK:
		return false
	return bool(cfg.get_value("sound", "on", false))


func _store(on: bool) -> void:
	var cfg := ConfigFile.new()
	cfg.load(SETTINGS)  # keep the other sections
	cfg.set_value("sound", "on", on)
	cfg.save(SETTINGS)


func set_enabled(on: bool) -> bool:
	if on and not _start():
		return false
	enabled = on
	_store(on)
	_master_goal = VOLUME if on else 0.0
	return enabled


func play(name: String, opts := {}) -> void:
	if not enabled or _playback == null:
		return
	match name:
		"speak":
			_tone(520.0 * float(opts.get("pitch", 1.0)), 0.0, 0.09, "sine", 0.07, 1.25)
		"tap":
			_tone(190.0, 0.0, 0.07, "triangle", 0.3, 0.6)
			_tone(170.0, 0.13, 0.07, "triangle", 0.22, 0.6)
		"jam":
			for i in 4:
				_tone(96.0, i * 0.11, 0.08, "square", 0.07)
		"fixed":
			_tone(660.0, 0.0, 0.1, "sine", 0.12)
			_tone(880.0, 0.1, 0.16, "sine", 0.12)
		"donut":
			_tone(784.0, 0.0, 0.1, "sine", 0.12)
			_tone(1047.0, 0.09, 0.2, "sine", 0.12)
		"win":
			var notes := [523.0, 659.0, 784.0, 1047.0]
			for i in notes.size():
				_tone(notes[i], i * 0.08, 0.14, "sine", 0.11)
		"ghost":
			_tone(300.0, 0.0, 0.9, "sine", 0.06, 1.9)
		"flicker":
			for i in 3:
				_tone(1400.0, i * 0.16, 0.03, "square", 0.03)
		"door":
			_tone(140.0, 0.0, 0.1, "triangle", 0.2, 0.7)
		"cake":
			var tune := [523.0, 523.0, 587.0, 523.0, 698.0, 659.0]
			for i in tune.size():
				_tone(tune[i], i * 0.17, 0.15, "sine", 0.1)


# ---- Boombox ----

func start_music() -> void:
	music_wanted = true
	_step = 0
	_next_step = -1


func stop_music() -> void:
	music_wanted = false
	_kicks.clear()
	_next_step = -1
	_voices = _voices.filter(func(v): return not v["music"])


## 0.3 (quiet, someone is talking) .. 1.
func duck(level: float) -> void:
	_duck = level


## How hard the last kick hit: 1 right on it, fading within a beat.
func beat() -> float:
	if _playback == null or not music_wanted or _kicks.is_empty():
		return 0.0
	var heard := _clock - (_buffer_frames - _playback.get_frames_available())
	var last := -1
	for k in _kicks:
		if k <= heard:
			last = maxi(last, k)
	if last < 0:
		return 0.0
	return exp(-float(heard - last) / RATE * 7.0) * _duck


func _music_step(step: int, at: int) -> void:
	if step % 4 == 0:
		_tone(150.0, 0.0, 0.22, "sine", 0.55, 0.28, true, at)
		_kicks.append(at)
	if step % 8 == 4:
		_burst(at, 0.13, 0.22, 1500.0)
	if step % 2 == 0 and step % 4 != 0:
		_burst(at, 0.04, 0.12, 7000.0)
	elif step % 2 == 1:
		_burst(at, 0.02, 0.04, 7000.0)
	if BASS[step] != 0:
		_tone(BASS[step], 0.0, STEP_S * 1.7, "sawtooth", 0.17, 0.0, true, at)
	if step % 2 == 0:
		_tone(ARP[(step / 2) % ARP.size()], 0.0, STEP_S * 1.4, "square", 0.035, 0.0, true, at)


# ---- Voices ----

## One enveloped oscillator note, `at` seconds from now (or at sample `start`).
func _tone(freq: float, at: float, length: float, wave: String, gain: float, slide := 0.0, music := false, start := -1) -> void:
	if _voices.size() >= MAX_VOICES:
		return
	var s0 := start if start >= 0 else _clock + int(at * RATE)
	_voices.append({ "kind": "tone", "start": s0, "len": int(length * RATE), "freq": freq, "slide": slide,
		"wave": wave, "gain": gain, "phase": 0.0, "music": music })


## A burst of filtered white noise (hats, clap), on the music bus.
func _burst(start: int, length: float, gain: float, cutoff: float) -> void:
	if _voices.size() >= MAX_VOICES:
		return
	var k := exp(-TAU * cutoff / RATE)
	_voices.append({ "kind": "noise", "start": start, "len": int(length * RATE), "gain": gain, "k": k, "lp": 0.0, "music": true })


static func _env(t: float, length: float, gain: float) -> float:
	if t < 0.012:
		return gain * t / 0.012
	return gain * exp(log(0.0001 / gain) * (t - 0.012) / maxf(0.001, length - 0.012))


func _process(_dt: float) -> void:
	if _playback == null:
		return
	var n := _playback.get_frames_available()
	if n <= 0:
		return
	if not enabled and _master < 0.0005:
		# Silent: push zeros without the per-sample work.
		_master = 0.0
		var silence := PackedVector2Array()
		silence.resize(n)
		_playback.push_buffer(silence)
		_clock += n
		_voices.clear()
		return
	# Schedule the beat a little ahead.
	if music_wanted and enabled:
		if _next_step < 0 or _next_step < _clock:
			_next_step = _clock + int(0.05 * RATE)
		while _next_step < _clock + n:
			_music_step(_step % 16, _next_step)
			_step += 1
			_next_step += int(STEP_S * RATE)
		var keep := _clock - int(RATE)
		_kicks = _kicks.filter(func(k): return k > keep)
	var out := PackedVector2Array()
	out.resize(n)
	var m_k := 1.0 - exp(-1.0 / (0.08 * RATE))
	var b_k := 1.0 - exp(-1.0 / (0.15 * RATE))
	var hum_k := 1.0 - exp(-TAU * 420.0 / RATE)
	var finished: Array = []
	for i in n:
		var s := _clock + i
		# Room tone: brown noise, low-passed.
		_brown = (_brown + (randf() * 2.0 - 1.0) * 0.04) / 1.02
		_hum_lp += (_brown * 3.2 - _hum_lp) * hum_k
		var dry := _hum_lp * 0.16
		var wet := 0.0
		for v in _voices:
			var t: int = s - v["start"]
			if t < 0 or t >= v["len"]:
				continue
			var sec := float(t) / RATE
			var length := float(v["len"]) / RATE
			var x := 0.0
			if v["kind"] == "tone":
				var f: float = v["freq"]
				if v["slide"] != 0.0:
					f = maxf(30.0, f * pow(v["slide"], sec / length))
				v["phase"] = fmod(v["phase"] + f / RATE, 1.0)
				var p: float = v["phase"]
				match v["wave"]:
					"sine": x = sin(p * TAU)
					"square": x = 1.0 if p < 0.5 else -1.0
					"triangle": x = 4.0 * absf(p - 0.5) - 1.0
					_: x = 2.0 * p - 1.0
				x *= _env(sec, length, v["gain"])
			else:
				var w := randf() * 2.0 - 1.0
				v["lp"] = v["lp"] * v["k"] + w * (1.0 - v["k"])
				x = (w - v["lp"]) * v["gain"] * exp(log(0.0001 / v["gain"]) * sec / length)
			if v["music"]:
				wet += x
			else:
				dry += x
		_master += (_master_goal - _master) * m_k
		_bus += (_duck - _bus) * b_k
		var y := clampf((dry + wet * _bus) * _master, -1.0, 1.0)
		out[i] = Vector2(y, y)
	_playback.push_buffer(out)
	_clock += n
	for v in _voices:
		if _clock - v["start"] >= v["len"]:
			finished.append(v)
	for v in finished:
		_voices.erase(v)
