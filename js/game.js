// ============================
//  Office Friends Playground
//  Pure HTML/CSS/JS - Vanilla
// ============================

// ---- Dialogue Banks ----
const DIALOGUE_BANKS = {
  andy: [
    // Office life — leaning into the bit
    "The new coffee machine has a touchscreen. I am not its biological friend.",
    "I swear the printer can smell fear. Mine, specifically.",
    "We had a meeting to plan the meeting. I took notes about the notes.",
    "My to-do list has its own to-do list. They're not on speaking terms.",
    "Lunch options: sandwich place, sad desk salad, or emotionally consuming a granola bar.",
    "I've been 'circling back' for so long I'm legally a roundabout.",
    "Is it 5pm yet? Asking for a friend. The friend is also me.",
    "Tried to print double-sided. Now I have a sequel.",
    "Boss said 'let's take this offline'. So I closed my laptop and went home.",
    "Spent 40 minutes phrasing an email so it didn't sound passive aggressive. Now it sounds aggressive aggressive.",
    "I have three plants on my desk. One's alive. I don't know which two are bluffing.",
    "Muted myself to sneeze. Then talked for three minutes still muted. Classic.",
    "My out-of-office reply has more personality than I do.",
    "If anyone asks, I'm 'in deep focus'. I'm watching a video about ducks.",
    // TikTok
    "My nephew tried to teach me a TikTok dance. I pulled something philosophical.",
    "Went on TikTok for 'two minutes' last night. Woke up at 3am as a different person.",
    "TikTok thinks I'm a 14-year-old who loves cake decorating now. I'm not correcting it.",
    // Books
    "Finally finished that thriller. The ending was… a choice.",
    "Started a self-help book. It told me to start another self-help book.",
    "Reading on the bus is great until your stop disappears behind you.",
    // Bikes
    "Bought a bike last spring. Still admiring it from the box.",
    "Commute is 12 minutes by bike, 45 by car. Guess which one I drive.",
    "Saw a guy on a unicycle this morning. He looked smug. He'd earned it.",
    // Broken arms
    "Broke my arm in 8th grade. Skateboard. Do not recommend.",
    "Got my cast off and one arm is noticeably skinnier. Free asymmetry.",
    "You can break a wrist tripping on a curb. I bring this up uninvited.",
    // Vegans
    "My brother went vegan. Now every family dinner is a diplomatic incident.",
    "Ordered a burger and the vegan at the table went quiet in a loud way.",
    "I respect veganism. I just can't explain cheese to myself without it.",
    "Tried a vegan sausage roll. It was fine. I will never say that again publicly.",
    "The vegan cheese at that party had the confidence of real cheese and none of the qualifications.",
    // Shrimps
    "Shrimps have a heart, brain, and stomach in their head. So basically me on Mondays.",
    "Ordered the shrimp cocktail. The shrimp had more presence than I do at standup.",
    "Apparently shrimps can see colours humans can't. Good for them, honestly.",
    "I ate a shrimp once and felt like something ancient was judging me.",
    "The prawn on my plate was bigger than my career ambitions.",
    // Ghosts
    "I don't believe in ghosts. I also turn every light on when I get home.",
    "My flat makes a sound at 3am. I've named him Gerald. We have an understanding.",
    "A ghost wouldn't haunt me. Not enough going on here to interest them.",
    "I watched one ghost documentary. Now I check under the bed. I'm 38.",
    "If ghosts are real, the office after 7pm is genuinely terrifying.",
    // Rolling Stones
    "Put on some Rolling Stones last weekend. Genuinely felt ten years younger and then twenty years older.",
    "'Gimme Shelter' came on shuffle and I had to sit down.",
    "Mick Jagger is in better shape than me and he is older than electricity.",
    "Rolling Stones or Beatles? I say this every time: wrong question.",
    "Started listening to Exile on Main St. Still don't know how it ends.",
    // Clothes
    "I've worn this jumper four days in a row. It's not a problem. It's a system.",
    "Bought new trousers. The waist fits. The legs have political opinions.",
    "My fashion sense is best described as 'tried to leave the house'.",
    "I have one good shirt. I refer to it as The Shirt. It knows what it is.",
    "Ironed my shirt this morning. The iron won.",
    // Tea
    "Tea solves a surprising percentage of problems. The rest need biscuits.",
    "Someone made tea in a coffee mug. I said nothing. I felt everything.",
    "I like my tea the colour of a sunset and strong enough to stand in.",
    "Offered herbal tea at a meeting. Smiled. Did not drink it.",
    "There's a specific kind of sadness that is a cold cup of tea.",
    // Rolling Stones — Andy's main musical passion
    "Can't You Hear Me Knocking has a guitar solo that lasts my entire commute. I arrive late. Worth it.",
    "Found a vinyl copy of Let It Bleed at a car boot sale. Retired on the spot, spiritually.",
    "Nineteenth Nervous Breakdown is my LinkedIn headline in spirit.",
    "'Start Me Up' plays in my head every morning when I try to remember my password.",
    "Beggars Banquet sounds like it was recorded in a pub toilet and that's exactly why it works.",
    "Loving Cup is the most underrated track on Exile. I've accepted nobody agrees.",
    // Ghosts — Andy genuinely unsure
    "Genuinely can't explain the cold spot by the photocopier. Gerald has expanded.",
    "Read a ghost story at 11pm. Slept with the TV on. I am 38.",
    "My gran said she saw my grandad after he died. Not going to argue with that.",
    "The ghost at my old flat was probably just bad insulation. I named him anyway.",
    "There's definitely something in the break room after 6pm. I'm blaming the leftover curry.",
    // Books — Andy reads slowly but sincerely
    "Currently on chapter three of the same book I started in January. Progress.",
    "I annotate in pencil. Feels permanent enough to matter, reversible enough for cowardice.",
    "Someone recommended a 900-page novel. We're no longer close.",
    "Finished a whole book on the beach. Technically it was a menu. Still counts.",
    "I only read before bed. I am also asleep by page six. This is a system.",
    "Bookmarks are for quitters. I fold corners. I know. I know.",
    // Music — general
    "My Spotify Wrapped was just Fleetwood Mac and two podcasts about cheese.",
    "I have a playlist called 'driving but parked' and I use it almost daily.",
    "Heard a song and cried. Looked it up. It was from a car advert.",
    "I think vinyl sounds better. I own one record. It's Abbey Road.",
    "The 70s had the best music and I will die on this hill, possibly listening to it.",
    "Put on a playlist at the office. Three people asked me to turn it off. Zero regrets.",
    // Kitchen & office life
    "The kitchen fridge has four identical Tupperware. Everyone thinks theirs is different. They're not.",
    "Someone ate my lunch again. The sticky note didn't work. The passive aggression has begun.",
    "The kettle here takes four minutes. I've started timing my existence around it.",
    "Microwave popcorn in an open-plan office. Nobody asked. Nobody stopped it. We all suffered.",
    "The good mugs have a pecking order and I am not high in it.",
  ],
  jazz: [
    "Have you tried turning it off and on again?",
    "I brought cookies! They're on the kitchen counter.",
    "This spreadsheet is going to be the death of me.",
    "Andy, you said you'd file that report yesterday!",
    "Team lunch Friday? I'm buying!",
    "Who keeps changing the thermostat? It's freezing!",
    "I organized the supply closet. You're welcome.",
    // TikTok
    "I posted a TikTok of the office plants. Twelve views and one is mine.",
    "My algorithm is just dogs in costumes and I'm not mad about it.",
    "Made a 'get ready with me' for putting together IKEA shelves.",
    // Books
    "Book club chose the longest novel imaginable. I'm three chapters in.",
    "Just finished a memoir — already buying the author's other one.",
    "Reading in the bath is a leap of faith. The book did not survive.",
    // Bikes
    "I started biking to work. My calves now have opinions.",
    "Got panniers! I'm one waterproof poncho away from a personality.",
    "Andy, want to bike to lunch tomorrow? It's like 15 minutes.",
    // Broken arms
    "My cousin broke her wrist roller-skating. Loving the cast signatures.",
    "When I broke my arm I learned ALL my friends have terrible handwriting.",
    "The worst part wasn't the break. It was showering with a plastic bag.",
    // Vegans
    "I've been vegan for three weeks! Mostly. Mostly mostly.",
    "Found an amazing vegan bakery. The croissants are technically not croissants but I respect the journey.",
    "Went vegan-adjacent. Basically I stopped apologising for the cheese.",
    "The vegan sausages were genuinely good. I refuse to say this where Andy can hear.",
    "Nutritional yeast is just cheese for people who are brave.",
    // Shrimps
    "Shrimp is such a strange word. Say it five times. Shrimp shrimp shrimp shrimp shrimp.",
    "I made prawn pasta from scratch! The prawns took it personally.",
    "Did you know shrimps can generate flashes of light? I'm bringing this to book club.",
    "Ate shrimp skewers at that rooftop thing and felt briefly glamorous.",
    "The shrimp at that restaurant came with the heads on and we all just agreed to move on.",
    // Ghosts
    "I absolutely believe in ghosts and I think that's a healthy attitude.",
    "Stayed in an old farmhouse. There were definitely noises. We left.",
    "My gran says she talks to grandad. I'm not going to unpack that.",
    "Ghost tours are my favourite type of educational experience.",
    "If there's a ghost in this office it's definitely in the stationery cupboard.",
    // Rolling Stones
    "I made a Rolling Stones playlist and now I feel like I should own a leather jacket.",
    "'Paint It Black' is literally a perfect song and I will not hear otherwise.",
    "Asked my mum if she'd ever seen the Stones live. She went quiet and smiled. Icon.",
    "Keith Richards just keeps going. There's a lesson there. I don't know what it is.",
    "Dancing to the Rolling Stones is different from dancing to anything else. More shoulder.",
    // Clothes
    "Found the perfect blazer at a vintage shop. It is mine now. We are bonded.",
    "Capsule wardrobe is the goal. Currently at capsule-adjacent wardrobe.",
    "Wearing colour today! This is growth. Please acknowledge it.",
    "Got compliments on this outfit and I have been riding that for three days.",
    "I reorganized my wardrobe by vibe. This helped a lot and also not at all.",
    // Tea
    "Matcha latte with oat milk is not tea, it's a whole personality, and I have it.",
    "I made loose-leaf tea at home and felt very cottagecore for about ten minutes.",
    "Earl Grey before noon is my version of a morning routine.",
    "Chamomile tea before bed. Yes I'm that person now. It's fine.",
    "Brought a fancy tea to the office and now everyone's asking where I got it. Power move.",
    // TikTok — Jazz's main platform
    "Went viral for seven minutes after a clip of me dropping my lunch. It's fine. I'm fine.",
    "I have three different TikTok accounts for three different vibes. This is normal and healthy.",
    "Dueted with a stranger's cooking video and now we follow each other. Digital friendship is real.",
    "My 'clean with me' TikTok got more views than my actual work presentation. The market has spoken.",
    "TikTok taught me a hairstyle I've attempted four times. Day five is the day.",
    "Sound on or sound off? Sound on. Always sound on. This is a moral position.",
    // Ghosts — Jazz is a true believer
    "There's a ghost in my building, second floor, only when it rains. I've started saying hello.",
    "Watched a ghost hunting show until 2am, regretted it deeply, watched more anyway.",
    "Old churches give me the feeling something is listening. I always whisper. Just in case.",
    "Olex says ghosts aren't real. Olex also said the build wouldn't break. I rest my case.",
    "I screenshot every orb in my holiday photos. They have a dedicated folder. Don't touch it.",
    // Clothes — Jazz takes this seriously
    "Linen is my summer personality and I will not apologize for wrinkling.",
    "Thrift shopping is sport. Three hours, twelve pounds, two perfect finds. Podium finish.",
    "I dressed for the job I want. Someone asked if I had an interview. I said: 'I'm always interviewing.'",
    "Colour blocking is commitment and I am fully committed.",
    "My coat has had three compliments this week. My coat is better at networking than I am.",
    // Tea — Jazz has opinions and rituals
    "Hibiscus tea is the best colour a drink can possibly be.",
    "I bought a tea subscription box. Every month is a new country. I rate them in a notes app.",
    "Ginger and lemon when I'm ill, green when I'm optimistic, English breakfast when I've accepted reality.",
    "Brought proper teacups to the office. Used them once. Someone put a biscuit in mine. In mine.",
    "Iced cold brew green tea in summer. Life-changing. Andy thought it was weird. Andy is wrong.",
    // Kitchen & office life
    "Made everyone thank-you cupcakes for my work anniversary. Nobody mentioned the anniversary. The cupcakes were exceptional.",
    "Someone reorganized the kitchen again. That person was me. I'm not sorry.",
    "The office lunch order is always wrong and yet we try again every week. That's hope.",
    "I bought nice hand soap for the bathroom. Gone in three days. We lived briefly with nice soap.",
    "I started a birthday calendar for the team. It's in a drawer. Someone should check it. That someone is me.",
  ],
  olex: [
    "I had the weirdest dream about code last night.",
    "Does anyone actually read these status reports?",
    "The WiFi name should be 'ItWorksOnMyMachine'.",
    "I just fixed a bug I created three months ago. Oops.",
    "Coffee is just bean water and I need it.",
    "My code compiled on the first try. Something's wrong.",
    "Monday morning: exists. Me: why.",
    // TikTok
    "TikTok is a content firehose pointed at your prefrontal cortex.",
    "I'm on dev TikTok. It is 90% people lying about their salaries.",
    "Watched a 47-second video about kerning. Reorganized my entire codebase.",
    // Books
    "Reading 'Designing Data-Intensive Applications'. Started in 2022.",
    "Finished the book. Plot twist: the database was the problem.",
    "Yesterday I read for 30 minutes. It was a TikTok transcript.",
    // Bikes
    "I bike to work. I arrive sweaty and somehow angrier.",
    "Replaced my brake pads with internet advice. Will report back.",
    "If I get one more flat tire I'm going back to the bus.",
    // Broken arms
    "Pretty sure I'd break my arm just thinking about a treadmill.",
    "Broke my arm coding once. Long story. It involved a standing desk.",
    "My cousin's cast had a QR code on it. Linked to his Venmo.",
    // Vegans
    "Veganism is statistically net positive. I have a spreadsheet. Do not ask to see the spreadsheet.",
    "I eat meat but I've started calling it 'legacy protein' so I feel better.",
    "The vegan options at that place were great. This is data, not an opinion.",
    "Someone in the thread said going vegan saved their life. Turns out they had a mild dairy intolerance.",
    "Plant-based beef is a solved problem at this point. Unsolved problem: why it's still twice the price.",
    // Shrimps
    "Shrimps process their environment faster than most people I've worked with.",
    "Mantis shrimps can punch with the force of a bullet. Nature is not subtle.",
    "Shrimps have hemocyanin instead of hemoglobin. Their blood is blue. Mine feels grey.",
    "I tried to explain shrimp nervous systems to someone at a party. I went home alone.",
    "If shrimps had keyboards we'd all be out of a job.",
    // Ghosts
    "There is no empirical evidence for ghosts. There is also no empirical evidence my pull request will get reviewed.",
    "Ghost stories are just distributed systems with poor documentation.",
    "I'd be open to ghost evidence. I have the same bar as any other hypothesis.",
    "Someone left the coffee machine on overnight and everyone blamed the ghost. It was Andy.",
    "If I die and become a ghost I'm haunting the CI server. First.",
    // Rolling Stones
    "The Rolling Stones have been touring longer than most tech companies have existed. That's the real disruption.",
    "Sympathy for the Devil has a time signature change nobody talks about. I talk about it.",
    "I used 'Wild Horses' as a variable name once. I regret nothing.",
    "Sticky Fingers was a genuinely weird album and I respect the commitment.",
    "Keith Richards as a concept is more stable than most infrastructure I've worked on.",
    // Clothes
    "I own four of the same shirt. Optimized decision-making. Reduced cognitive load.",
    "Dress code is 'smart casual'. I've been prototyping this look for six years.",
    "Bought a jacket with too many pockets. This is my best purchase of the decade.",
    "Wore a hoodie to a client meeting. It went fine. It will always go fine.",
    "My wardrobe is version-controlled. Not really. But it should be.",
    // Tea
    "Tea is 99% water and 100% attitude.",
    "Green tea has L-theanine. It's the only reason I drink it. I also just like it.",
    "The office has seventeen kinds of herbal tea and no good reason for any of them.",
    "I drink tea when the coffee has betrayed me. This happens more than I expected.",
    "Someone stole my mug. It had a lid. This is a hate crime.",
    // Rolling Stones — Olex has the data
    "I once debugged a production incident while Exile on Main St. played start to finish. Best session of my life.",
    "Honky Tonk Women is structurally perfect. I don't have a spreadsheet for this. It's just true.",
    "Tumbling Dice is the most underrated track in the catalog. I did the analysis.",
    "'Miss You' is a disco track and it's their best post-seventies song. This is not a take. This is a fact.",
    "Sympathy for the Devil runs exactly six minutes fifteen seconds. Every second justified.",
    // Shrimps — Olex's specialist subject
    "Shrimps are technically decapod crustaceans. So are crabs. The shrimp is just louder about it.",
    "The collective noun for shrimps is 'a troupe'. Fully deserved.",
    "Shrimps can survive in both fresh and saltwater. Flexible architecture. Respect.",
    "Mantis shrimps snap their claws so fast they create a cavitation bubble. That's engineering.",
    "Colossal shrimp is an oxymoron and a lie on every menu I have ever read.",
    // Vegans — Olex has a spreadsheet
    "Vegan leather is just leather for people who want to argue at dinner. I have eaten at that dinner.",
    "Tried oat milk. It's fine. I put this in a notes file. It is still there.",
    "The environmental data on beef is peer-reviewed and cited and ignored at every BBQ. I've checked.",
    "Went plant-based for a week as an experiment. Week two did not happen. The experiment concluded.",
    "Lab-grown meat is the correct long-term solution. I don't need to care about the cow. The cow should care about efficiency.",
    // Tea — Olex is precise about this
    "The office tea is technically tea in the same way tap water is technically wine.",
    "I have a tea timer. I set up the tea timer before I set up deployment monitoring. This was the right call.",
    "Yerba mate is tea with a marketing department. I respect the category.",
    "Put the milk in first. I will explain the thermodynamics to anyone who wants to argue.",
    "Rooibos is fine. Not tea. Fine.",
    // Kitchen & office life
    "The office Wi-Fi password is still 'welcome1'. I have raised this in seven separate tickets.",
    "There are four different coffee blends in this kitchen and all of them are disappointing.",
    "The dishwasher cycle is ninety minutes and people keep opening it at forty. This is why systems fail.",
    "There's a shared spreadsheet for kitchen supplies. Last updated in 2022. Classic.",
    "Someone left oat milk out on the counter. The oat milk had an opinion about this. So did I.",
  ],
};

const GREETINGS = {
  andy: [
    "Oh hey — am I in trouble?",
    "Currently 12% of a person. How can I help?",
    "You found me. I was hiding from the report.",
    "Hey! Pretend I look busy.",
    "Andy, reporting in. Mildly.",
  ],
  jazz: ["Hi! Great to see you ✨", "Jazz at your service.", "Hey friend, what's the plan?", "*finger guns*"],
  olex: ["Sup.", "You rang?", "Bean water acquired. What now?", "Oh, hello there."],
};

const COFFEE_DIALOGUE = {
  andy: [
    "Coffee time! ☕",
    "This mug is technically my third breakfast.",
    "If I don't get coffee the report won't survive. Honestly, neither will I.",
    "Strong enough to compile.",
  ],
  jazz: [
    "Coffee break! Who's joining? ☕",
    "A warm cup of productivity.",
    "I switched to oat milk. Don't tell my old self.",
    "I brought biscuits!",
  ],
  olex: [
    "Bean water, my only friend. ☕",
    "Coffee: because adulting is hard.",
    "If this mug had a personality, it'd be mine.",
    "I trust the machine more than the standup.",
  ],
};

const MEETING_DIALOGUE = {
  andy: [
    "So… are we starting?",
    "I have notes from last meeting. Possibly.",
    "Quick question — does anyone actually want to be here?",
    "Item one: do we need item one?",
  ],
  jazz: [
    "Okay team! Let's get aligned.",
    "I made a slide deck. There are 47 slides.",
    "Quick standup: what's blocking us?",
    "Let's parking-lot that and circle back.",
  ],
  olex: [
    "Is this meeting strictly necessary?",
    "I'll just listen. From the corner.",
    "Five-minute meeting? Bold prediction.",
    "Can we put my points in writing instead?",
  ],
};

const COLORS = {
  andy: { color: '#D4765F', border: '#D4765F', bg: '#FFF8F0' },
  jazz: { color: '#7BA38C', border: '#7BA38C', bg: '#F0FFF5' },
  olex: { color: '#A894C7', border: '#A894C7', bg: '#F5F0FF' },
};

// Each entry is { src, flip, scale }.
//   flip:  mirror horizontally (used when the art pack ships only one walk
//          direction — Andy ships walk_right, Olex ships walk_left).
//   scale: per-sprite multiplier that normalizes the on-screen figure height
//          across characters. The PNG frame is the same 1024x1536 for all
//          sprites, but the figures inside occupy different fractions of the
//          frame (Jazz idle fills 80.5% of frame height, Jazz walk_left only
//          65.2%). Without a corrective scale, the same character visibly
//          changes size when walking, and the three characters look like
//          different heights side-by-side. Scales chosen so every figure
//          renders at the same on-screen height as the smallest unscaled
//          figure (jazz_walk_left at ~78 px), so no scale is > 1 and the
//          sprite never overflows its 80x160 box.
const SPRITE_MAP = {
  andy: {
    idle:  { src: 'assets/andy_idle.png',       flip: false, scale: 0.868 },
    left:  { src: 'assets/andy_walk_right.png', flip: true,  scale: 0.960 },
    right: { src: 'assets/andy_walk_right.png', flip: false, scale: 0.960 },
  },
  jazz: {
    idle:  { src: 'assets/jazz_idle.png',       flip: false, scale: 0.810 },
    left:  { src: 'assets/jazz_walk_left.png',  flip: false, scale: 1.000 },
    right: { src: 'assets/jazz_walk_right.png', flip: false, scale: 0.897 },
  },
  olex: {
    idle:  { src: 'assets/olex_idle.png',       flip: false, scale: 0.856 },
    left:  { src: 'assets/olex_walk_left.png',  flip: false, scale: 0.836 },
    right: { src: 'assets/olex_walk_left.png',  flip: true,  scale: 0.836 },
  },
};

function spriteTransform(sprite) {
  const sx = sprite.flip ? -sprite.scale : sprite.scale;
  return `scale(${sx}, ${sprite.scale})`;
}

// ---- Obstacles ----
// Walls are fixed. Furniture obstacles are added by initFurniture() and
// stored in OBSTACLES (let so it can be rebuilt after furniture placement
// and whenever the canvas resizes and pixel→fraction ratios change).
const WALL_OBSTACLES = [
  { x: 0.00, y: 0.00, w: 1.00, h: 0.02 },  // top wall
  { x: 0.00, y: 0.98, w: 1.00, h: 0.02 },  // bottom wall
  { x: 0.00, y: 0.00, w: 0.02, h: 1.00 },  // left wall
  { x: 0.98, y: 0.00, w: 0.02, h: 1.00 },  // right wall
];
let OBSTACLES = WALL_OBSTACLES;

// Furniture pieces placed at runtime — kept here so the resize handler can
// recompute obstacle fractions when the canvas size changes.
const furniturePieces = []; // { type, rx, ry, pw, ph }

function rebuildObstacles() {
  const { w, h } = getCanvasSize();
  OBSTACLES = [
    ...WALL_OBSTACLES,
    ...furniturePieces.map(p => ({ x: p.rx, y: p.ry, w: p.pw / w, h: p.ph / h })),
  ];
}

// ---- Game Constants ----
const BASE_SPEED = 1.0;            // a touch quicker — characters cover more ground
const PROXIMITY = 70;              // chat only when characters are genuinely close
const REPULSION = 45;
const SPRITE_W = 80;
const SPRITE_H = 160;
const ATTRACT_RANGE = SPRITE_H * 2; // within 2 character-heights → walk toward each other
const CHAT_COOLDOWN_MS = 10000;     // pair can't re-engage for this long after chat ends
const WAVE_DURATION = 1500;
const TARGET_STUCK_FRAMES = 90;
const DOM_SYNC_INTERVAL_MS = 100;
const STATS_RENDER_DEBOUNCE_MS = 200;
const SPAWN_MARGIN = 40;           // safe distance from canvas edge for spawns

// ---- localStorage helpers (safe under private browsing / disabled storage) ----
function lsGet(key) {
  try { return localStorage.getItem(key); } catch (_) { return null; }
}
function lsSet(key, val) {
  try { localStorage.setItem(key, val); } catch (_) { /* no-op */ }
}

// ---- Game State ----
const state = {
  chars: [],
  selectedId: null,
  isPlaying: true,
  walkSpeed: 1.0,
  chatFreq: 50,
  stats: { conversations: 0, steps: 0, coffee: 0, meetings: 0 },
  stepsAcc: 0,
  convPairs: new Set(),
  pendingTimers: new Set(),
  keys: new Set(),
  lastTime: 0,
  rafId: 0,
  domSyncAcc: 0,
  statsDirty: false,
  statsRenderTimer: 0,
  panelOpen: true,
  hasSeenHelp: lsGet('office-friends-seen-help') === 'true',
  // True while a scripted scene (Coffee/Meeting) is gathering the characters
  // and running their conversation — suppresses autonomous chat triggers.
  activeScene: false,
  // Per-character set of recently-used line indices — prevents repeating the
  // same line until the recency window (≤ 1/3 of bank size) has cleared.
  recentLines: { andy: new Set(), jazz: new Set(), olex: new Set() },
};

// ---- DOM refs ----
const canvas = document.getElementById('gameCanvas');
const charsLayer = document.getElementById('charactersLayer');
const bubblesLayer = document.getElementById('bubblesLayer');
const furnitureLayer = document.getElementById('furnitureLayer');

// ---- Helpers ----
function rand(min, max) { return Math.random() * (max - min) + min; }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// Pick a line that wasn't recently used by this character type.
// The recency window is at most 1/3 of the bank size (capped at 15) so
// characters with small banks still cycle through all lines before repeating.
function pickFresh(bank, recentSet) {
  const max = Math.min(Math.floor(bank.length / 3), 15);
  const pool = bank.reduce((acc, _, i) => { if (!recentSet.has(i)) acc.push(i); return acc; }, []);
  const idx = pool.length > 0
    ? pool[Math.floor(Math.random() * pool.length)]
    : Math.floor(Math.random() * bank.length);
  recentSet.add(idx);
  if (recentSet.size > max) recentSet.delete(recentSet.values().next().value);
  return bank[idx];
}
function dist(a, b) { const dx = a.x - b.x, dy = a.y - b.y; return Math.sqrt(dx*dx + dy*dy); }

function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function getCanvasSize() {
  return { w: canvas.clientWidth, h: canvas.clientHeight };
}

function getScaledObstacles() {
  const { w, h } = getCanvasSize();
  return OBSTACLES.map(o => ({
    x: o.x * w, y: o.y * h,
    w: o.w * w, h: o.h * h,
  }));
}

// vx/vy are the character's current velocity — used to pick the push axis.
// When approaching a desk from the side (horizontal velocity dominant), we must
// push horizontally; the old min-overlap rule incorrectly pushed vertically
// because SPRITE_H > desk height makes the y-overlap smaller.
function wouldHitObstacle(x, y, vx, vy, obstacles) {
  for (const o of obstacles) {
    if (rectsOverlap(x, y, SPRITE_W, SPRITE_H, o.x, o.y, o.w, o.h)) {
      const cx = x + SPRITE_W / 2, cy = y + SPRITE_H / 2;
      const ocx = o.x + o.w / 2, ocy = o.y + o.h / 2;
      const dx = cx - ocx, dy = cy - ocy;
      const ox = (SPRITE_W + o.w) / 2 - Math.abs(dx);
      const oy = (SPRITE_H + o.h) / 2 - Math.abs(dy);
      // Resolve along the axis of motion when moving; fall back to min-overlap
      // for stationary characters (idle push-out).
      const speed = Math.hypot(vx, vy);
      const resolveX = speed > 0.1 ? Math.abs(vx) >= Math.abs(vy) : ox <= oy;
      if (resolveX) return { hit: true, px: dx > 0 ? ox : -ox, py: 0 };
      return { hit: true, px: 0, py: dy > 0 ? oy : -oy };
    }
  }
  return { hit: false, px: 0, py: 0 };
}

// Iterative pushback — repeat up to 3 times so a push into one obstacle
// doesn't silently embed the character in a second one.
// Each axis flips at most once per call (flipX/flipY guards) so a two-obstacle
// corner can't double-flip the velocity back to the original direction.
function resolveObstacles(c, obstacles, bounce = false) {
  let flipX = false, flipY = false;
  for (let iter = 0; iter < 3; iter++) {
    const col = wouldHitObstacle(c.x, c.y, c.vx, c.vy, obstacles);
    if (!col.hit) break;
    c.x += col.px;
    c.y += col.py;
    if (bounce) {
      if (col.px !== 0 && !flipX) { c.vx = -c.vx; flipX = true; }
      if (col.py !== 0 && !flipY) { c.vy = -c.vy; flipY = true; }
    }
  }
}

// Find a valid point near (x, y) that is inside the room and clear of obstacles.
function safeGatherPoint(x, y) {
  const { w, h } = getCanvasSize();
  const obstacles = getScaledObstacles();
  const cx = Math.max(SPAWN_MARGIN, Math.min(w - SPRITE_W - SPAWN_MARGIN, x));
  const cy = Math.max(SPAWN_MARGIN, Math.min(h - SPRITE_H - SPAWN_MARGIN, y));
  if (!wouldHitObstacle(cx, cy, 0, 0, obstacles).hit) return { x: cx, y: cy };
  for (let r = 20; r <= 160; r += 20) {
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
      const nx = Math.max(SPAWN_MARGIN, Math.min(w - SPRITE_W - SPAWN_MARGIN, cx + Math.cos(a) * r));
      const ny = Math.max(SPAWN_MARGIN, Math.min(h - SPRITE_H - SPAWN_MARGIN, cy + Math.sin(a) * r));
      if (!wouldHitObstacle(nx, ny, 0, 0, obstacles).hit) return { x: nx, y: ny };
    }
  }
  return findSpawnPoint();
}

// Tracked timers — clearable on pause/reset so they can't fire after state changes
function trackedTimeout(fn, ms) {
  const id = setTimeout(() => {
    state.pendingTimers.delete(id);
    fn();
  }, ms);
  state.pendingTimers.add(id);
  return id;
}
function clearPendingTimers() {
  for (const id of state.pendingTimers) clearTimeout(id);
  state.pendingTimers.clear();
  // A pending scene's whole timeline lives in these timers, so cancelling
  // them ends the scene.
  state.activeScene = false;
}
function clearAllBubbles() {
  state.chars.forEach(c => {
    if (c.bubbleEl) { c.bubbleEl.remove(); c.bubbleEl = null; }
  });
}

// ---- Character Factory ----
function createCharacter(id, name, type, x, y, speedMod) {
  const c = COLORS[type];
  return {
    id, name, type, x, y,
    vx: (Math.random() - 0.5) * 2,
    vy: (Math.random() - 0.5) * 2,
    speed: BASE_SPEED * speedMod,
    speedMod,
    color: c.color, borderColor: c.border, bgColor: c.bg,
    state: 'walking',
    facing: Math.random() > 0.5 ? 'right' : 'left',
    targetX: null, targetY: null,
    targetStuckFrames: 0,
    idleTimer: 0, waveTimer: 0,
    isChatting: false,
    approachPartner: null,
    el: null, innerEl: null, imgEl: null, bubbleEl: null,
    lastSpriteSrc: '',
    lastSpriteTransform: '',
    lastInnerClass: '',
  };
}

// Pick a random spawn point that's safely inside the room and not overlapping
// any obstacle. Used for init and reset so characters never start clipped
// into the walls or desks.
function findSpawnPoint(existing = []) {
  const { w, h } = getCanvasSize();
  const obstacles = getScaledObstacles();
  for (let i = 0; i < 60; i++) {
    const x = rand(SPAWN_MARGIN, w - SPRITE_W - SPAWN_MARGIN);
    const y = rand(SPAWN_MARGIN, h - SPRITE_H - SPAWN_MARGIN);
    if (wouldHitObstacle(x, y, 0, 0, obstacles).hit) continue;
    // Keep characters from spawning on top of each other.
    let overlapsOther = false;
    for (const p of existing) {
      if (Math.hypot(p.x - x, p.y - y) < SPRITE_W) { overlapsOther = true; break; }
    }
    if (!overlapsOther) return { x, y };
  }
  return { x: w / 2 - SPRITE_W / 2, y: h / 2 - SPRITE_H / 2 };
}

function initCharacters() {
  state.chars = [
    createCharacter('andy', 'Andy', 'andy', 0, 0, 1.0),
    createCharacter('jazz', 'Jazz', 'jazz', 0, 0, 1.2),
    createCharacter('olex', 'Olex', 'olex', 0, 0, 0.85),
  ];
  const placed = [];
  for (const c of state.chars) {
    const p = findSpawnPoint(placed);
    c.x = p.x; c.y = p.y;
    placed.push(p);
  }
  state.chars.forEach(c => renderCharacter(c));
}

// ---- DOM Rendering ----
function renderCharacter(c) {
  const el = document.createElement('div');
  el.className = 'character';
  el.dataset.id = c.id;
  el.dataset.type = c.type;
  el.tabIndex = 0;
  el.setAttribute('role', 'button');
  el.setAttribute('aria-label', `${c.name} — click or press Enter to select`);
  el.setAttribute('aria-pressed', 'false');
  el.style.transform = `translate3d(${c.x}px, ${c.y}px, 0)`;

  // Inner element carries the walking/wave bob so it composes cleanly
  // with the root's translate3d positioning.
  const inner = document.createElement('div');
  inner.className = 'character-inner walking';

  const initialSprite = SPRITE_MAP[c.type][c.facing === 'right' ? 'right' : 'left'];
  const initialTransform = spriteTransform(initialSprite);
  const img = document.createElement('img');
  img.src = initialSprite.src;
  img.style.transform = initialTransform;
  img.alt = '';
  img.draggable = false;
  c.lastSpriteSrc = img.src;
  c.lastSpriteTransform = initialTransform;
  c.lastInnerClass = inner.className;

  const label = document.createElement('span');
  label.className = 'name-label';
  label.textContent = c.name;

  inner.appendChild(img);
  el.appendChild(inner);
  el.appendChild(label);   // sibling of inner — not clipped by character-inner's clip-path

  el.addEventListener('click', (e) => { e.stopPropagation(); onCharClick(c.id); });
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onCharClick(c.id); }
  });

  c.el = el;
  c.innerEl = inner;
  c.imgEl = img;
  charsLayer.appendChild(el);
}

function updateCharDOM(c) {
  if (!c.el) return;

  // Position via transform — no layout, GPU-accelerated.
  c.el.style.transform = `translate3d(${c.x}px, ${c.y}px, 0)`;

  const isMoving = Math.abs(c.vx) > 0.1 || Math.abs(c.vy) > 0.1;
  let innerCls = 'character-inner';
  let sprite;

  if (c.state === 'waving') {
    innerCls += ' waving';
    sprite = SPRITE_MAP[c.type].idle;
  } else if (c.state === 'idle' || c.state === 'chatting') {
    sprite = SPRITE_MAP[c.type].idle;
  } else if (isMoving) {
    innerCls += ' walking';
    sprite = SPRITE_MAP[c.type][c.facing === 'right' ? 'right' : 'left'];
  } else {
    sprite = SPRITE_MAP[c.type].idle;
  }

  if (innerCls !== c.lastInnerClass) {
    c.innerEl.className = innerCls;
    c.lastInnerClass = innerCls;
  }
  if (sprite.src !== c.lastSpriteSrc) {
    c.imgEl.src = sprite.src;
    c.lastSpriteSrc = sprite.src;
  }
  const tx = spriteTransform(sprite);
  if (tx !== c.lastSpriteTransform) {
    c.imgEl.style.transform = tx;
    c.lastSpriteTransform = tx;
  }

  // is-walking drives the CSS waist-up crop: full body when moving or waving,
  // portrait crop when idle / chatting.
  const showFullBody = c.state === 'waving' || isMoving;
  c.el.classList.toggle('is-walking', showFullBody);

  const sel = state.selectedId === c.id;
  c.el.classList.toggle('selected', sel);
  c.el.setAttribute('aria-pressed', sel ? 'true' : 'false');
}

function showBubble(c, text, duration = 4000) {
  if (c.bubbleEl) { c.bubbleEl.remove(); c.bubbleEl = null; }

  const b = document.createElement('div');
  b.className = 'speech-bubble';
  b.dataset.type = c.type;

  const name = document.createElement('div');
  name.className = 'bubble-name';
  name.textContent = c.name;

  const msg = document.createElement('div');
  msg.textContent = text;

  b.appendChild(name);
  b.appendChild(msg);
  bubblesLayer.appendChild(b);
  c.bubbleEl = b;

  // Position after appending so offsetWidth is correct.
  positionBubble(c);

  trackedTimeout(() => {
    if (!c.bubbleEl) return;
    const el = c.bubbleEl;
    el.classList.add('exiting');
    trackedTimeout(() => {
      el.remove();
      if (c.bubbleEl === el) c.bubbleEl = null;
    }, 300);
  }, duration);
}

function positionBubble(c) {
  if (!c.bubbleEl) return;
  const { w } = getCanvasSize();
  const bw = c.bubbleEl.offsetWidth || 220;
  const bh = c.bubbleEl.offsetHeight || 70;
  const centerX = c.x + SPRITE_W / 2;
  let left = centerX - bw / 2;
  // Clamp horizontally so the bubble can't clip off the canvas edge.
  left = Math.max(8, Math.min(w - bw - 8, left));
  // The character box is 160px tall; object-fit:contain places the image
  // content starting ~20px from the box top, so the head sits at c.y + 20.
  // Place the bubble so its triangle tip (8px below the bubble's bottom
  // edge) lands just above that point, giving a 4px clearance gap.
  let top = c.y + 20 - bh - 8 - 4;
  // Don't let the bubble disappear above the canvas.
  top = Math.max(8, top);
  c.bubbleEl.style.left = left + 'px';
  c.bubbleEl.style.top = top + 'px';
  // Keep the pointer triangle aimed at the character's head.
  const pointerLeft = Math.max(12, Math.min(bw - 12, centerX - left));
  c.bubbleEl.style.setProperty('--pointer-x', pointerLeft + 'px');
}

// ---- Stats ----
// Mutate state immediately; only debounce the DOM render. This prevents
// back-to-back updates from losing increments inside the debounce window.
function bumpStat(name, by = 1) {
  state.stats[name] += by;
  scheduleStatsRender();
}
function setStat(name, value) {
  if (state.stats[name] === value) return;
  state.stats[name] = value;
  scheduleStatsRender();
}
function scheduleStatsRender() {
  state.statsDirty = true;
  if (state.statsRenderTimer) return;
  state.statsRenderTimer = setTimeout(() => {
    state.statsRenderTimer = 0;
    if (!state.statsDirty) return;
    state.statsDirty = false;
    document.getElementById('statConversations').textContent = state.stats.conversations;
    document.getElementById('statSteps').textContent = state.stats.steps;
    document.getElementById('statCoffee').textContent = state.stats.coffee;
    document.getElementById('statMeetings').textContent = state.stats.meetings;

    const bar = document.getElementById('statsBar');
    bar.querySelectorAll('.stat-pill').forEach(p => {
      p.classList.remove('pulse');
      void p.offsetWidth;
      p.classList.add('pulse');
    });
  }, STATS_RENDER_DEBOUNCE_MS);
}

// ---- Game Loop ----
function gameLoop(timestamp) {
  if (!state.lastTime) state.lastTime = timestamp;
  const frameDelta = timestamp - state.lastTime;
  const dt = Math.min(frameDelta / 16.667, 3);
  state.lastTime = timestamp;

  if (state.isPlaying) {
    const { w, h } = getCanvasSize();
    const obstacles = getScaledObstacles();
    let stepsAcc = 0;

    for (const c of state.chars) {
      // willBounce: only autonomous walkers reflect off obstacles billiard-style.
      let willBounce = false;

      if (c.waveTimer > 0) {
        // ---- waving (no movement) ----
        c.waveTimer -= frameDelta;
        if (c.waveTimer <= 0) { c.state = 'walking'; c.waveTimer = 0; }

      } else if (c.idleTimer > 0) {
        // ---- idle countdown (no movement) ----
        c.idleTimer -= frameDelta;
        if (c.idleTimer <= 0) { c.state = 'walking'; c.idleTimer = 0; }

      } else if (c.isChatting) {
        // ---- chatting: freeze in place, face each other ----
        c.vx = 0; c.vy = 0;

      } else if (c.approachPartner !== null) {
        // ---- approach: walk toward partner ----
        // Cancel if the partner is unreachable for this frame (e.g. taken over
        // by user, scene running, or partner is busy chatting with someone
        // else). The pair scan re-establishes the link next frame if both
        // characters are still free and in range.
        const partner = state.chars.find(p => p.id === c.approachPartner);
        const blocked = !partner || partner.isChatting
                     || state.selectedId === c.id || state.selectedId === partner.id
                     || state.activeScene;
        if (blocked) {
          c.approachPartner = null;
          c.vx = 0; c.vy = 0;
          c.state = 'walking';
        } else {
          const adx = partner.x - c.x, ady = partner.y - c.y;
          const ad = Math.sqrt(adx * adx + ady * ady);
          if (ad < PROXIMITY) {
            // Reached — stop here. The pair scan below promotes this to a
            // chat the same frame because both characters are partnered.
            c.vx = 0; c.vy = 0;
            c.state = 'idle';
          } else {
            const spd = c.speed * state.walkSpeed;
            c.vx = (adx / ad) * spd;
            c.vy = (ady / ad) * spd;
            c.x += c.vx * dt; c.y += c.vy * dt;
            stepsAcc += Math.abs(c.vx * dt) + Math.abs(c.vy * dt);
            c.facing = c.vx > 0 ? 'right' : 'left';
            c.state = 'walking';
          }
        }

      } else if (c.targetX !== null && c.targetY !== null) {
        // ---- target-based movement (scene gather, scatter, click-to-move) ----
        const tdx = c.targetX - c.x, tdy = c.targetY - c.y;
        const td = Math.sqrt(tdx * tdx + tdy * tdy);
        if (td < 10) {
          c.targetX = null; c.targetY = null;
          c.targetStuckFrames = 0;
          c.state = 'idle';
          c.idleTimer = state.activeScene ? 999999 : 2000;
          c.vx = 0; c.vy = 0;
        } else {
          const spd = c.speed * state.walkSpeed;
          c.vx = (tdx / td) * spd;
          c.vy = (tdy / td) * spd;
          const prevX = c.x, prevY = c.y;
          c.x += c.vx * dt; c.y += c.vy * dt;
          stepsAcc += Math.abs(c.vx * dt) + Math.abs(c.vy * dt);
          c.facing = c.vx > 0 ? 'right' : 'left';
          // Inline resolve gives correct position for stuck detection.
          resolveObstacles(c, obstacles, false);
          if (Math.hypot(c.x - prevX, c.y - prevY) < 0.5) {
            c.targetStuckFrames++;
            if (c.targetStuckFrames > TARGET_STUCK_FRAMES) {
              c.targetStuckFrames = 0;
              if (state.activeScene) {
                const angle = Math.random() * Math.PI * 2;
                c.x += Math.cos(angle) * 8;
                c.y += Math.sin(angle) * 8;
              } else {
                c.targetX = null; c.targetY = null;
                c.vx = 0; c.vy = 0;
                c.state = 'idle'; c.idleTimer = 600;
              }
            }
          } else {
            c.targetStuckFrames = 0;
          }
        }

      } else if (state.selectedId === c.id) {
        // ---- keyboard control ----
        const keys = state.keys;
        let kx = 0, ky = 0;
        if (keys.has('arrowleft') || keys.has('a')) kx -= 1;
        if (keys.has('arrowright') || keys.has('d')) kx += 1;
        if (keys.has('arrowup') || keys.has('w')) ky -= 1;
        if (keys.has('arrowdown') || keys.has('s')) ky += 1;
        if (kx !== 0 || ky !== 0) {
          const len = Math.sqrt(kx * kx + ky * ky) || 1;
          const spd = c.speed * state.walkSpeed * 1.5;
          c.vx = (kx / len) * spd;
          c.vy = (ky / len) * spd;
          c.state = 'walking';
          c.x += c.vx * dt; c.y += c.vy * dt;
          stepsAcc += Math.abs(c.vx * dt) + Math.abs(c.vy * dt);
          c.facing = c.vx > 0 ? 'right' : 'left';
        } else {
          c.vx = 0; c.vy = 0;
          c.state = 'idle';
        }

      } else if (state.activeScene) {
        // ---- scene: arrived characters stand still ----
        c.vx = 0; c.vy = 0;
        if (c.state !== 'chatting') c.state = 'idle';

      } else {
        // ---- autonomous random walk ----
        willBounce = true;
        const roll = Math.random();
        if (roll < 0.012 * dt) {
          const angle = Math.random() * Math.PI * 2;
          c.vx = Math.cos(angle) * c.speed * state.walkSpeed;
          c.vy = Math.sin(angle) * c.speed * state.walkSpeed;
          c.state = 'walking';
        } else if (roll < 0.018 * dt) {
          const mx = w / 2, my = h / 2;
          const mdx = mx - c.x, mdy = my - c.y;
          const md = Math.sqrt(mdx * mdx + mdy * mdy) || 1;
          c.vx += (mdx / md) * 0.3 * state.walkSpeed;
          c.vy += (mdy / md) * 0.3 * state.walkSpeed;
        } else if (roll < 0.022 * dt) {
          c.state = 'idle';
          c.idleTimer = 600 + Math.random() * 1000;
          c.vx = 0; c.vy = 0;
        }
        const sp = Math.hypot(c.vx, c.vy);
        const minSp = 0.4 * c.speed * state.walkSpeed;
        if (sp < minSp && c.state === 'walking') {
          const angle = Math.random() * Math.PI * 2;
          c.vx = Math.cos(angle) * c.speed * state.walkSpeed;
          c.vy = Math.sin(angle) * c.speed * state.walkSpeed;
        }
        c.x += c.vx * dt; c.y += c.vy * dt;
        stepsAcc += Math.abs(c.vx * dt) + Math.abs(c.vy * dt);
        if (Math.abs(c.vx) > 0.1) c.facing = c.vx > 0 ? 'right' : 'left';

        // Repulsion from other characters (only in autonomous mode)
        for (const o of state.chars) {
          if (o.id === c.id) continue;
          const rd = dist(c, o);
          if (rd < REPULSION && rd > 0) {
            const ov = REPULSION - rd;
            const rdx = c.x - o.x, rdy = c.y - o.y;
            c.x += (rdx / rd) * ov * 0.05 * dt;
            c.y += (rdy / rd) * ov * 0.05 * dt;
          }
        }
      }

      // ---- ALWAYS: resolve obstacles + clamp — runs for EVERY character ----
      // This guarantees characters in ANY state (idle, chatting, wave, scene)
      // are pushed out of walls and desks if they end up inside one.
      resolveObstacles(c, obstacles, willBounce);
      // After a bounce, ensure there's enough velocity to keep moving.
      if (willBounce && Math.hypot(c.vx, c.vy) < 0.3) {
        const angle = Math.random() * Math.PI * 2;
        c.vx = Math.cos(angle) * c.speed * state.walkSpeed;
        c.vy = Math.sin(angle) * c.speed * state.walkSpeed;
      }
      // Hard clamp inside the wall band as a final safety net.
      const wallW = w * 0.02, wallH = h * 0.02;
      c.x = Math.max(wallW, Math.min(w - SPRITE_W - wallW, c.x));
      c.y = Math.max(wallH, Math.min(h - SPRITE_H - wallH, c.y));
    }

    if (stepsAcc > 0) {
      state.stepsAcc += stepsAcc;
      setStat('steps', Math.floor(state.stepsAcc / 100));
    }

    // Conversations — suppressed while a scripted scene is running so the
    // gather-and-talk dialogue isn't drowned in random chatter.
    const chatProb = state.activeScene ? 0 : state.chatFreq / 100;
    const chars = state.chars;
    for (let i = 0; i < chars.length; i++) {
      for (let j = i + 1; j < chars.length; j++) {
        const a = chars[i], b = chars[j];
        if (a.isChatting || b.isChatting) continue;
        const pairKey = [a.id, b.id].sort().join('-');
        if (state.convPairs.has(pairKey)) continue;
        // Don't auto-engage the character the user is driving.
        if (state.selectedId === a.id || state.selectedId === b.id) continue;

        const d = dist(a, b);
        const partnered = a.approachPartner === b.id && b.approachPartner === a.id;

        if (d < PROXIMITY) {
          // Within talking distance. Deterministic if they just walked here
          // on purpose; otherwise still gated by the chat-frequency slider
          // so two random passers-by don't always strike up a conversation.
          if (partnered || Math.random() < chatProb * 0.02 * dt) {
            a.approachPartner = null; b.approachPartner = null;
            state.convPairs.add(pairKey);
            a.isChatting = true; b.isChatting = true;
            a.state = 'chatting'; b.state = 'chatting';
            // Stop them in place and face each other.
            a.vx = 0; a.vy = 0; a.targetX = null; a.targetY = null;
            b.vx = 0; b.vy = 0; b.targetX = null; b.targetY = null;
            a.facing = a.x <= b.x ? 'right' : 'left';
            b.facing = b.x <= a.x ? 'right' : 'left';

            showBubble(a, pickFresh(DIALOGUE_BANKS[a.type], state.recentLines[a.type]), 2800);

            trackedTimeout(() => {
              if (!b.isChatting) return;
              showBubble(b, pickFresh(DIALOGUE_BANKS[b.type], state.recentLines[b.type]), 2800);
            }, 3000);

            // Release chat lock at 6s so they can move again, but keep the
            // pair in convPairs until CHAT_COOLDOWN_MS so they don't immediately
            // glue back together — they get a chance to wander off first.
            trackedTimeout(() => {
              a.isChatting = false; b.isChatting = false;
              if (a.state === 'chatting') a.state = 'walking';
              if (b.state === 'chatting') b.state = 'walking';
            }, 6000);
            trackedTimeout(() => {
              state.convPairs.delete(pairKey);
            }, CHAT_COOLDOWN_MS);

            bumpStat('conversations');
          }
        } else if (d < ATTRACT_RANGE && !a.approachPartner && !b.approachPartner) {
          // Within 2 character-heights → roll for approach. Once committed,
          // both characters walk toward each other until d < PROXIMITY and
          // the close-range branch above fires deterministically.
          if (Math.random() < chatProb * 0.02 * dt) {
            a.approachPartner = b.id;
            b.approachPartner = a.id;
            a.targetX = null; a.targetY = null;
            b.targetX = null; b.targetY = null;
            a.state = 'walking'; b.state = 'walking';
            a.idleTimer = 0; b.idleTimer = 0;
          }
        }
      }
    }
  }

  // Sync DOM at ~10Hz using a frame-rate-independent accumulator.
  state.domSyncAcc += frameDelta;
  if (state.domSyncAcc >= DOM_SYNC_INTERVAL_MS) {
    state.domSyncAcc = 0;
    for (const c of state.chars) {
      updateCharDOM(c);
      if (c.bubbleEl) positionBubble(c);
    }
  }

  state.rafId = requestAnimationFrame(gameLoop);
}

// ---- Event Handlers ----
function onCharClick(id) {
  const c = state.chars.find(ch => ch.id === id);
  if (!c) return;

  if (state.selectedId === id) {
    state.selectedId = null;
  } else {
    state.selectedId = id;
    // Selecting cancels any in-progress approach for / toward this character.
    c.approachPartner = null;
    state.chars.forEach(other => {
      if (other.approachPartner === id) other.approachPartner = null;
    });
    // Trigger the wave animation that was previously dead code.
    c.state = 'waving';
    c.waveTimer = WAVE_DURATION;
    showBubble(c, pickFresh(GREETINGS[c.type], state.recentLines[c.type]), 2600);

    if (!state.hasSeenHelp) {
      trackedTimeout(() => {
        showBubble(c, 'Use WASD or click to move!', 2600);
      }, 3000);
    }
  }
  updateCanvasCursor();
  state.chars.forEach(updateCharDOM);
}

function onCanvasClick(e) {
  if (!state.selectedId) return;
  if (e.target.closest('[data-id]')) return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left - SPRITE_W / 2;
  const y = e.clientY - rect.top - SPRITE_H / 2;
  const c = state.chars.find(ch => ch.id === state.selectedId);
  if (!c) return;
  c.targetX = x;
  c.targetY = y;
  c.targetStuckFrames = 0;
  c.state = 'walking';
}

function updateCanvasCursor() {
  canvas.classList.toggle('has-selection', !!state.selectedId);
}

// ---- Control Panel ----
document.getElementById('btnPlay').addEventListener('click', () => {
  state.isPlaying = !state.isPlaying;
  document.getElementById('playIcon').textContent = state.isPlaying ? '⏸' : '▶';
  document.getElementById('playText').textContent = state.isPlaying ? 'Pause' : 'Play';
  if (!state.isPlaying) {
    // Don't let queued chat callbacks pop bubbles on paused characters.
    clearPendingTimers();
    state.convPairs.clear();
    for (const c of state.chars) {
      c.isChatting = false;
      c.approachPartner = null;
      if (c.state === 'chatting') c.state = 'idle';
    }
  }
});

document.getElementById('speedSlider').addEventListener('input', (e) => {
  state.walkSpeed = parseFloat(e.target.value);
  document.getElementById('speedValue').textContent = state.walkSpeed.toFixed(1) + 'x';
});

const CHAT_LABELS = [
  [0, 'Silent'], [10, 'Rare'], [30, 'Low'],
  [50, 'Normal'], [70, 'Chatty'], [100, 'Non-stop'],
];
document.getElementById('chatSlider').addEventListener('input', (e) => {
  state.chatFreq = parseInt(e.target.value);
  let label = CHAT_LABELS[0][1];
  for (const [thr, name] of CHAT_LABELS) {
    if (state.chatFreq >= thr) label = name;
  }
  document.getElementById('chatValue').textContent = label;
});

// ---- Scripted "gather" scenes (Coffee / Meeting) -------------------------
// Send everyone to a clustered set of positions, then run a short scripted
// conversation in turn. Autonomous chat is suppressed while a scene runs
// (see state.activeScene) so the scripted dialogue isn't talked over.

const SCENE_LINE_GAP_MS = 1400;     // delay between characters in a cycle
const SCENE_CYCLE_PAUSE_MS = 800;   // beat between dialogue cycles
const SCENE_ARRIVAL_TIMEOUT_MS = 12000; // start talking anyway after this long
const SCENE_ARRIVAL_POLL_MS = 200;

function gatherAndChat(positions, dialogueBank, lineCount = 2) {
  // Cancel any prior scene, drop existing bubbles, and reset chat locks
  // so the new conversation can show cleanly.
  clearPendingTimers();
  clearAllBubbles();
  state.convPairs.clear();
  state.chars.forEach(c => {
    c.isChatting = false;
    c.approachPartner = null;
    c.idleTimer = 0;
    c.waveTimer = 0;
  });
  state.selectedId = null;
  updateCanvasCursor();
  state.activeScene = true;

  state.chars.forEach((c, i) => {
    const p = positions[i];
    c.targetX = p.x; c.targetY = p.y;
    c.targetStuckFrames = 0;
    c.state = 'walking';
  });

  const sceneStartedAt = performance.now();

  const startDialogue = () => {
    const cycleDuration = state.chars.length * SCENE_LINE_GAP_MS + SCENE_CYCLE_PAUSE_MS;
    for (let line = 0; line < lineCount; line++) {
      state.chars.forEach((c, i) => {
        const delay = line * cycleDuration + i * SCENE_LINE_GAP_MS;
        trackedTimeout(() => {
          showBubble(c, pickFresh(dialogueBank[c.type], state.recentLines[c.type]), 2800);
        }, delay);
      });
    }
    const sceneEnd = lineCount * cycleDuration + 1500;
    trackedTimeout(() => { state.activeScene = false; }, sceneEnd);
  };

  // Poll for arrival. Each character clears its targetX when it reaches its
  // gather spot (or gives up via the stuck-frame logic). Once everyone has
  // resolved one way or another, kick off the dialogue.
  const tickArrival = () => {
    if (!state.activeScene) return;
    const settled = state.chars.every(c => c.targetX === null);
    const timeoutHit = performance.now() - sceneStartedAt > SCENE_ARRIVAL_TIMEOUT_MS;
    if (settled || timeoutHit) {
      // Snap any still-moving stragglers so they don't fidget through dialogue.
      state.chars.forEach(c => {
        if (c.targetX !== null) { c.targetX = null; c.targetY = null; }
        c.vx = 0; c.vy = 0;
        c.state = 'idle';
      });
      startDialogue();
    } else {
      trackedTimeout(tickArrival, SCENE_ARRIVAL_POLL_MS);
    }
  };
  trackedTimeout(tickArrival, 600);
}

function coffeeGatherPositions() {
  const { w, h } = getCanvasSize();
  // Cluster just below the coffee-station obstacle (top-center of the room).
  const cx = Math.min(Math.max(w * 0.5, 250), w - 250);
  const y = Math.max(h * 0.18, 90);
  return [
    safeGatherPoint(cx - 110 - SPRITE_W / 2, y),
    safeGatherPoint(cx - SPRITE_W / 2,        y + 6),
    safeGatherPoint(cx + 110 - SPRITE_W / 2, y),
  ];
}

function meetingGatherPositions() {
  const { w, h } = getCanvasSize();
  // Open spot in the lower-left quadrant, clear of desks and plants.
  const cx = Math.min(Math.max(w * 0.3, 200), w - 260);
  const y = Math.min(Math.max(h * 0.62, h - SPRITE_H - 120), h - SPRITE_H - 60);
  return [
    safeGatherPoint(cx - 100 - SPRITE_W / 2, y),
    safeGatherPoint(cx - SPRITE_W / 2,        y + 6),
    safeGatherPoint(cx + 100 - SPRITE_W / 2, y),
  ];
}

document.getElementById('btnCoffee').addEventListener('click', () => {
  bumpStat('coffee');
  gatherAndChat(coffeeGatherPositions(), COFFEE_DIALOGUE, 2);
});

document.getElementById('btnScatter').addEventListener('click', () => {
  const { w, h } = getCanvasSize();
  // Keep targets a safe distance inside the sealed walls so characters
  // don't immediately collide and get stuck against the perimeter.
  const M = SPAWN_MARGIN;
  state.chars.forEach(c => {
    const edge = Math.floor(Math.random() * 4);
    switch (edge) {
      case 0: c.targetX = rand(M, w - SPRITE_W - M); c.targetY = M; break;
      case 1: c.targetX = w - SPRITE_W - M; c.targetY = rand(M, h - SPRITE_H - M); break;
      case 2: c.targetX = rand(M, w - SPRITE_W - M); c.targetY = h - SPRITE_H - M; break;
      default: c.targetX = M; c.targetY = rand(M, h - SPRITE_H - M); break;
    }
    c.targetStuckFrames = 0;
    c.state = 'walking';
  });
});

document.getElementById('btnMeeting').addEventListener('click', () => {
  bumpStat('meetings');
  gatherAndChat(meetingGatherPositions(), MEETING_DIALOGUE, 3);
});

document.getElementById('btnReset').addEventListener('click', () => {
  clearPendingTimers();
  const placed = [];
  state.chars.forEach(c => {
    const p = findSpawnPoint(placed);
    c.x = p.x; c.y = p.y;
    placed.push(p);
    c.vx = (Math.random() - 0.5) * 2; c.vy = (Math.random() - 0.5) * 2;
    c.targetX = null; c.targetY = null;
    c.targetStuckFrames = 0;
    c.state = 'walking'; c.isChatting = false;
    c.approachPartner = null;
    c.waveTimer = 0; c.idleTimer = 0;
    if (c.bubbleEl) { c.bubbleEl.remove(); c.bubbleEl = null; }
  });
  state.convPairs.clear();
  state.selectedId = null;
  state.stepsAcc = 0;
  state.stats = { conversations: 0, steps: 0, coffee: 0, meetings: 0 };
  state.recentLines = { andy: new Set(), jazz: new Set(), olex: new Set() };
  scheduleStatsRender();
  updateCanvasCursor();
  state.chars.forEach(updateCharDOM);
});

document.getElementById('panelToggle').addEventListener('click', () => {
  state.panelOpen = !state.panelOpen;
  document.getElementById('controlPanel').classList.toggle('collapsed', !state.panelOpen);
});

// ---- Canvas click ----
canvas.addEventListener('click', onCanvasClick);

// ---- Keyboard ----
window.addEventListener('keydown', (e) => {
  state.keys.add(e.key.toLowerCase());
  if (e.key === 'Escape') {
    state.selectedId = null;
    updateCanvasCursor();
    state.chars.forEach(updateCharDOM);
  }
  if (state.selectedId && ['arrowup','arrowdown','arrowleft','arrowright'].includes(e.key.toLowerCase())) {
    // Stop arrow keys from scrolling the page while driving a character.
    e.preventDefault();
  }
});
window.addEventListener('keyup', (e) => {
  state.keys.delete(e.key.toLowerCase());
});

// ---- Modal ----
const modal = document.getElementById('howToPlayModal');
function openModal() { modal.classList.add('active'); }
function closeModal() {
  modal.classList.remove('active');
  lsSet('office-friends-seen-help', 'true');
  state.hasSeenHelp = true;
}
document.getElementById('helpBtn').addEventListener('click', openModal);
document.getElementById('modalClose').addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

if (!state.hasSeenHelp) {
  setTimeout(openModal, 800);
}

// ---- Floating Particles ----
function initParticles() {
  const container = document.getElementById('particles');
  for (let i = 0; i < 18; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const size = 4 + Math.random() * 4;
    p.style.cssText = `
      left: ${Math.random() * 100}%;
      width: ${size}px; height: ${size}px;
      animation-duration: ${15 + Math.random() * 10}s;
      animation-delay: ${Math.random() * 20}s;
    `;
    container.appendChild(p);
  }
}

// ---- Resize ----
window.addEventListener('resize', () => {
  // Furniture pixel sizes are fixed; obstacle fractions change as canvas resizes.
  rebuildObstacles();
  const { w, h } = getCanvasSize();
  const wallW = w * 0.02, wallH = h * 0.02;
  state.chars.forEach(c => {
    c.x = Math.max(wallW, Math.min(w - SPRITE_W - wallW, c.x));
    c.y = Math.max(wallH, Math.min(h - SPRITE_H - wallH, c.y));
    if (c.bubbleEl) positionBubble(c);
    updateCharDOM(c);
  });
});

// ---- Furniture ----
// Each entry: display size (pw×ph px) and the asset path.
// Obstacle uses the full display box — the white space in each PNG acts as
// natural clearance so characters don't clip through the visible object.
const FURNITURE_DEFS = [
  { src: 'assets/desk_cluster.png',   pw: 160, ph: 160, count: 2 },
  { src: 'assets/coffee_station.png', pw: 150, ph: 150, count: 1 },
  { src: 'assets/plant_tall.png',     pw: 90,  ph: 90,  count: 3 },
  { src: 'assets/sofa.png',           pw: 180, ph: 180, count: 1 },
  { src: 'assets/water_cooler.png',   pw: 80,  ph: 80,  count: 2 },
];

function initFurniture() {
  const { w, h } = getCanvasSize();
  furnitureLayer.innerHTML = '';
  furniturePieces.length = 0;

  const placed = [];
  const GAP    = 32;   // minimum gap between any two pieces
  const WALL   = 28;   // minimum distance from canvas edge

  for (const def of FURNITURE_DEFS) {
    for (let n = 0; n < def.count; n++) {
      let ok = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        const px = rand(WALL, w - def.pw - WALL);
        const py = rand(WALL, h - def.ph - WALL);
        let clear = true;
        for (const q of placed) {
          if (rectsOverlap(px - GAP, py - GAP, def.pw + GAP * 2, def.ph + GAP * 2,
                           q.px, q.py, q.pw, q.ph)) {
            clear = false; break;
          }
        }
        if (!clear) continue;

        placed.push({ px, py, pw: def.pw, ph: def.ph });
        const rx = px / w, ry = py / h;
        furniturePieces.push({ rx, ry, pw: def.pw, ph: def.ph });

        const el = document.createElement('div');
        el.className = 'furniture';
        el.style.cssText = `left:${rx*100}%;top:${ry*100}%;width:${def.pw}px;height:${def.ph}px;`;
        const img = document.createElement('img');
        img.src = def.src;
        img.alt = '';
        img.draggable = false;
        el.appendChild(img);
        furnitureLayer.appendChild(el);
        ok = true;
        break;
      }
      if (!ok) console.warn(`initFurniture: could not place ${def.src}`);
    }
  }

  rebuildObstacles();
}

// ---- Init ----
initParticles();
initFurniture();   // must come before initCharacters so spawn avoids furniture
initCharacters();
updateCanvasCursor();
state.rafId = requestAnimationFrame(gameLoop);
