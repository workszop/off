// ---- Character-held props -------------------------------------------------
// A small, deterministic policy layer for the standees. It deliberately
// owns no simulation data and never mutates a character: office.js can call
// `carry.update(c, sim.time, flags)` once per frame and choose the matching
// prop texture. State is kept per character so a failed random roll is not
// repeated on every render tick.

// Who has cup and printout drawings. The ghost has none, and neither has
// Mr. T, the guest: he is only passing through.
const HUMAN_TYPES = new Set(['andy', 'jazz', 'olex', 'margo']);
const COFFEE_SPOT_TYPES = new Set(['coffee_station', 'table_cafe']);
const PRINTER_SPOT_TYPE = 'printer';
const COFFEE_RADIUS = 0.9;
const PRINTER_RADIUS = 1.1;
const STATIONARY_SPEED = 0.15;
const COFFEE_CHANCE = 0.65;
const PRINTOUT_CHANCE = 0.55;
const PRINTOUT_LIFETIME = 14;
const PRINTOUT_COOLDOWN = 30;

const finite = (value, fallback) => Number.isFinite(value) ? value : fallback;

function distanceTo(c, spot) {
  const x = finite(c?.pos?.x, NaN);
  const z = finite(c?.pos?.y, NaN);
  if (!Number.isFinite(x) || !Number.isFinite(z)) return Infinity;
  return Math.hypot(x - finite(spot?.x, Infinity), z - finite(spot?.z, Infinity));
}

function nearest(c, zones, radius) {
  let match = null;
  let best = radius;
  for (const zone of zones) {
    const distance = distanceTo(c, zone);
    if (distance <= best) {
      best = distance;
      match = zone;
    }
  }
  return match;
}

function insideAny(c, zones, radius) {
  return zones.some(zone => distanceTo(c, zone) <= radius);
}

export function createCarryController({ spots = [], random = Math.random } = {}) {
  const coffeeZones = spots.filter(spot => COFFEE_SPOT_TYPES.has(spot?.type));
  const printerZones = spots.filter(spot => spot?.type === PRINTER_SPOT_TYPE);
  const state = new WeakMap();

  const getState = c => {
    let value = state.get(c);
    if (!value) {
      value = {
        lastTime: 0,
        coffeeZone: null,
        coffeeAttempted: false,
        coffeeWon: false,
        printerInside: false,
        printoutsUntil: 0,
        printoutCooldownUntil: 0,
      };
      state.set(c, value);
    }
    return value;
  };

  const clear = (value, now) => {
    value.lastTime = now;
    value.coffeeZone = null;
    value.coffeeAttempted = false;
    value.coffeeWon = false;
    value.printerInside = false;
    value.printoutsUntil = 0;
    value.printoutCooldownUntil = 0;
  };

  const chance = threshold => {
    const draw = Number(random());
    return Number.isFinite(draw) && draw < threshold;
  };

  return {
    update(c, time, options = {}) {
      if (!c || typeof c !== 'object') return null;
      const value = getState(c);
      const incomingTime = Number(time);
      const now = Math.max(value.lastTime, Number.isFinite(incomingTime) ? incomingTime : value.lastTime);
      const { partyOn = false, printerJammed = false } = options || {};
      const eligible = HUMAN_TYPES.has(c.type)
        && c.present === true
        && c.shift === 'in'
        && !c.busy
        && !partyOn;
      if (!eligible) {
        clear(value, now);
        return null;
      }

      const speed = finite(c.speed, Infinity);
      const stationary = speed <= STATIONARY_SPEED;
      const coffeeZone = nearest(c, coffeeZones, COFFEE_RADIUS);
      if (coffeeZone !== value.coffeeZone) {
        value.coffeeZone = coffeeZone;
        value.coffeeAttempted = false;
        value.coffeeWon = false;
      }
      if (coffeeZone && stationary && !value.coffeeAttempted) {
        value.coffeeAttempted = true;
        value.coffeeWon = chance(COFFEE_CHANCE);
      }

      const printerInside = insideAny(c, printerZones, PRINTER_RADIUS);
      if (printerInside && !value.printerInside && !printerJammed && now >= value.printoutCooldownUntil) {
        if (chance(PRINTOUT_CHANCE)) {
          value.printoutsUntil = now + PRINTOUT_LIFETIME;
          value.printoutCooldownUntil = now + PRINTOUT_COOLDOWN;
          // A character cannot visibly carry both things. The coffee visit is
          // still marked as attempted, so returning later does not reroll it.
          value.coffeeWon = false;
        }
      }
      value.printerInside = printerInside;
      if (value.printoutsUntil <= now) value.printoutsUntil = 0;
      value.lastTime = now;

      // Printouts have priority because picking them up is the newer action.
      if (value.printoutsUntil > now) return 'printouts';
      if (coffeeZone && stationary && value.coffeeWon) return 'coffee';
      return null;
    },
  };
}
