// Office Friends — static data

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
  ghost: [
    "uhu", "uhu...", "uhu uhu", "...uhu", "uhu?",
    "UHU!", "uhuuuu", "uhu uhu uhu", "...uhu...", "UHU UHU",
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
  ghost: ["uhu", "...uhu", "UHU?!", "uhu!"],
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
  ghost: ["uhu ☕", "uhu...", "UHU!", "uhu uhu"],
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
  ghost: ["uhu.", "uhu uhu", "...uhu", "UHU"],
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
  andy:  { color: '#D4765F', border: '#D4765F', bg: '#FFF8F0' },
  jazz:  { color: '#7BA38C', border: '#7BA38C', bg: '#F0FFF5' },
  olex:  { color: '#A894C7', border: '#A894C7', bg: '#F5F0FF' },
  ghost: { color: '#6AA3D8', border: '#6AA3D8', bg: '#EDF5FF' },
};

// Ghost SVGs are inlined as data URIs — the ghost.png / ghost_walk.png
// assets referenced previously were never committed to the repo, so the
// ghost rendered as a broken image. No external asset needed.
function _svg(s) { return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s); }
const GHOST_IDLE_URI = _svg(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 200">' +
  '<path d="M50 18C22 18 10 52 10 88L10 162Q19 148 28 162Q37 176 46 162Q55 148 64 162Q73 176 82 162Q87 153 90 158L90 88C90 52 78 18 50 18Z" fill="#D8EDFF" stroke="#8AB8E0" stroke-width="1.5"/>' +
  '<ellipse cx="36" cy="88" rx="14" ry="16" fill="#3A72B0"/><ellipse cx="39" cy="85" rx="5" ry="6" fill="white"/>' +
  '<ellipse cx="64" cy="88" rx="14" ry="16" fill="#3A72B0"/><ellipse cx="67" cy="85" rx="5" ry="6" fill="white"/>' +
  '<ellipse cx="50" cy="116" rx="10" ry="8" fill="#3A72B0"/>' +
  '</svg>'
);
const GHOST_WALK_URI = _svg(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 200">' +
  '<path d="M54 18C26 16 12 52 14 88L16 162Q25 148 34 162Q43 176 52 162Q61 148 70 162Q79 176 86 162Q89 155 90 158L88 88C86 52 76 20 54 18Z" fill="#D8EDFF" stroke="#8AB8E0" stroke-width="1.5"/>' +
  '<ellipse cx="38" cy="88" rx="14" ry="16" fill="#3A72B0"/><ellipse cx="42" cy="85" rx="5" ry="6" fill="white"/>' +
  '<ellipse cx="66" cy="88" rx="14" ry="16" fill="#3A72B0"/><ellipse cx="70" cy="85" rx="5" ry="6" fill="white"/>' +
  '<ellipse cx="52" cy="116" rx="10" ry="8" fill="#3A72B0"/>' +
  '<path d="M3 108L11 108M1 120L11 120" stroke="#BDD8F5" stroke-width="2" stroke-linecap="round"/>' +
  '</svg>'
);

// Each entry is { src, flip, scale }.
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
  ghost: {
    // Walk SVG faces right; left is a CSS flip of the same sprite.
    idle:  { src: GHOST_IDLE_URI, flip: false, scale: 0.90 },
    left:  { src: GHOST_WALK_URI, flip: true,  scale: 0.90 },
    right: { src: GHOST_WALK_URI, flip: false, scale: 0.90 },
  },
};

function spriteTransform({ flip, scale }) {
  return `scale(${flip ? -scale : scale}, ${scale})`;
}

// ---- Furniture palette ----
// Catalogue of furniture types available in the right-panel picker.
// scale is relative to SPRITE_H; flip sets the initial horizontal mirror.
// Users place items by clicking the palette — pieces are not auto-placed at load.

// Printer and whiteboard have no PNG asset — inline SVG, same style family.
const PRINTER_URI = _svg(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
  '<rect x="14" y="38" width="72" height="34" rx="6" fill="#E8E2D8" stroke="#2C2C2C" stroke-width="2.5"/>' +
  '<rect x="28" y="20" width="44" height="22" rx="3" fill="#F5F0E8" stroke="#2C2C2C" stroke-width="2.5"/>' +
  '<rect x="26" y="60" width="48" height="16" rx="2" fill="#FFFDF8" stroke="#2C2C2C" stroke-width="2.5"/>' +
  '<circle cx="76" cy="48" r="3.5" fill="#7BA38C"/>' +
  '<rect x="24" y="46" width="20" height="4" rx="2" fill="#2C2C2C" opacity="0.35"/>' +
  '</svg>'
);
const WHITEBOARD_URI = _svg(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
  '<rect x="10" y="14" width="80" height="54" rx="4" fill="#FFFDF8" stroke="#2C2C2C" stroke-width="3"/>' +
  '<path d="M22 32c10-8 18 6 28-2s16 2 26-4" fill="none" stroke="#D4765F" stroke-width="2.5" stroke-linecap="round"/>' +
  '<path d="M24 48h24M24 56h34" stroke="#6AA3D8" stroke-width="2.5" stroke-linecap="round"/>' +
  '<circle cx="72" cy="52" r="7" fill="none" stroke="#7BA38C" stroke-width="2.5"/>' +
  '<path d="M30 68l-8 20M70 68l8 20" stroke="#2C2C2C" stroke-width="3" stroke-linecap="round"/>' +
  '</svg>'
);

const FURNITURE_PALETTE = [
  { type: 'desk_cluster',   src: 'assets/desk_cluster.png',   scale: 1.00, flip: false, label: 'Desk'     },
  { type: 'coffee_station', src: 'assets/coffee_station.png', scale: 0.90, flip: false, label: 'Coffee'   },
  { type: 'couch_2seater',  src: 'assets/couch_2seater.png',  scale: 1.05, flip: false, label: 'Sofa'     },
  { type: 'armchair',       src: 'assets/armchair.png',       scale: 0.72, flip: false, label: 'Armchair' },
  { type: 'table_cafe',     src: 'assets/table_cafe.png',     scale: 0.70, flip: false, label: 'Table'    },
  { type: 'plant_snake',    src: 'assets/plant_snake.png',    scale: 0.45, flip: false, label: 'Plant'    },
  { type: 'boxes_stack',    src: 'assets/boxes_stack.png',    scale: 0.50, flip: false, label: 'Boxes'    },
  { type: 'filing_cabinet', src: 'assets/filing_cabinet.png', scale: 0.55, flip: false, label: 'Cabinet'  },
  { type: 'lamp_arc_big',   src: 'assets/lamp_arc_big.png',   scale: 0.55, flip: false, label: 'Lamp'     },
  { type: 'printer',        src: PRINTER_URI,                 scale: 0.42, flip: false, label: 'Printer'  },
  { type: 'whiteboard',     src: WHITEBOARD_URI,              scale: 0.80, flip: false, label: 'Board'    },
];

// ---- Ambient activities (idle vignettes) ----
// spot = fractional offset inside the furniture rect; the character's box is
// placed so its bottom edge lands at ry + dy*ph, centered at rx + dx*pw,
// then nudged to a free spot via safeGatherPoint().
const ACTIVITIES = {
  desk_cluster:   { spot: { dx: 0.5,  dy: 1.05 }, label: 'typing at a desk',          dur: [15000, 40000], weight: 3 },
  coffee_station: { spot: { dx: 0.5,  dy: 1.05 }, label: 'getting a coffee',          dur: [8000, 15000],  weight: 2 },
  plant_snake:    { spot: { dx: 0.5,  dy: 1.05 }, label: 'watering the plant',        dur: [6000, 12000],  weight: 1 },
  printer:        { spot: { dx: 0.5,  dy: 1.05 }, label: 'printing something',        dur: [6000, 12000],  weight: 2 },
  couch_2seater:  { spot: { dx: 0.35, dy: 0.8 },  label: 'dozing on the couch',       dur: [20000, 50000], weight: 2 },
  whiteboard:     { spot: { dx: 0.5,  dy: 1.1 },  label: 'staring at the whiteboard', dur: [10000, 25000], weight: 2 },
};

// 3+ lines per character per activity; ghost is always "uhu" variants.
const ACTIVITY_LINES = {
  desk_cluster: {
    andy: ["Row 4,000 of the spreadsheet. Send help.", "I've typed 'per my last email' three times today.", "This keyboard owes me an apology."],
    jazz: ["Inbox zero by lunch. Watch me.", "Color-coding this doc is self-care.", "One more slide. Okay, four more slides."],
    olex: ["It compiles. I don't trust it.", "Renaming variables counts as work.", "This function is 300 lines and afraid of nothing."],
    ghost: ["uhu...", "uhu uhu", "...uhu"],
  },
  coffee_station: {
    andy: ["Third cup. The report demands it.", "The machine hissed at me. Fair.", "Decaf? In this economy?"],
    jazz: ["Oat milk foam is an art form.", "Anyone else want one while I'm up?", "This mug sparks joy. The coffee sparks me."],
    olex: ["Bean water refill protocol initiated.", "The machine's uptime beats our CI.", "Caffeine is a dependency I've accepted."],
    ghost: ["uhu ☕", "uhu?", "uhuuu"],
  },
  plant_snake: {
    andy: ["Drink up. You're the stable one here.", "This plant has outlasted three managers.", "Am I overwatering? Blink once for yes."],
    jazz: ["Who's a thriving little succulent? You are.", "I named it Beyoncé. Obviously.", "New leaf! Everyone, NEW LEAF!"],
    olex: ["Photosynthesis: still the best energy pipeline.", "Watering schedule is in the shared calendar.", "The plant does nothing and is thriving. Noted."],
    ghost: ["uhu 🌱", "...uhu", "uhu uhu"],
  },
  printer: {
    andy: ["Please just print. I'll say nice things about you.", "Tray 2 is a myth.", "It smells fear. Stay calm."],
    jazz: ["Printing the birthday calendar! Finally!", "Double-sided, stapled, dreams achieved.", "Why is it warming up? It's been on all day."],
    olex: ["PC LOAD LETTER. Classic.", "The printer firmware is older than my career.", "Print queue depth: 14. Confidence: low."],
    ghost: ["uhu?", "uhu uhu uhu", "UHU"],
  },
  couch_2seater: {
    andy: ["Just resting my eyes. For a quarter.", "The couch understands me.", "Five minutes. Maybe forty."],
    jazz: ["Power nap! It's in my calendar as 'strategy'.", "This cushion is my emotional support cushion.", "Wake me if anything fun happens."],
    olex: ["Entering low-power mode.", "The couch has better ergonomics than my chair.", "Background processes only."],
    ghost: ["uhu...", "uhuuuu", "...uhu..."],
  },
  whiteboard: {
    andy: ["Whose diagram is this? Whose ARE any of these?", "The arrow just points at another arrow.", "I understand nothing and it's beautiful."],
    jazz: ["We should really erase Q3.", "I'm adding a smiley to the roadmap.", "This brainstorm has been 'live' since March."],
    olex: ["That architecture cannot work. I'll allow it.", "Someone drew the database as a cloud. Bold.", "Do not erase. Do not implement either."],
    ghost: ["uhu?", "...uhu", "uhu uhu"],
  },
};

// ---- Event dialogue ----
const PRINTER_JAM_DIALOGUE = {
  andy: ["It jammed. Of course it jammed. It saw me coming.", "I blame the ghost. This has ghost energy.", "There is no paper IN tray 2!"],
  jazz: ["Okay okay — everyone stay calm, I know the trick.", "You just have to open it and say something kind.", "I'm laminating a sign about this."],
  olex: ["Have you tried turning the printer off and on again?", "Jam location: sector 7. As always.", "I'll add it to the incident channel."],
  ghost: ["uhu?!", "uhu uhu!", "...uhu"],
};
const BIRTHDAY_DIALOGUE = {
  andy: ["Wait — whose birthday is it? I signed the card blind.", "Cake at 3pm is the best meeting of the quarter.", "I only came for the icing. And the friendship. Mostly icing."],
  jazz: ["SURPRISE! Okay it's not a surprise, I sent three reminders.", "Make a wish! Something with reasonable scope!", "There's a vegan slice, I checked twice."],
  olex: ["Statistically someone's birthday was inevitable.", "The candles are a fire-code discussion for another day.", "Happy birthday. The cake-to-meeting ratio today is acceptable."],
  ghost: ["UHU!", "uhu uhu uhu!", "uhu 🎂"],
};
const LAMP_FLICKER_DIALOGUE = {
  andy: ["Did it just get cold in here?", "The lamp's doing the thing again. Gerald?", "I'm sure that's just the wiring. I'm sure. I'm sure."],
  jazz: ["I KNEW this office was haunted. I knew it!", "Everyone say hi so it knows we're friendly!", "That's the second floor ghost. They visit."],
  olex: ["Voltage fluctuation. Probably.", "Adding 'haunted' to the facilities ticket.", "If it flickers in binary I'm listening."],
  ghost: ["UHU?!", "uhu!!", "UHU UHU"],
};
const DONUT_DIALOGUE = {
  andy: ["A donut just... appeared? Not questioning it.", "Dibs on the sprinkles half.", "This undoes the whole morning. Thank you."],
  jazz: ["DONUT! Office morale +10!", "We split it four ways, no arguments.", "Someone out there loves us."],
  olex: ["Donut acquired. Source: unknown. Risk: acceptable.", "The torus is the perfect pastry topology.", "I'll log this as a production sugar incident."],
  ghost: ["uhu 🍩", "uhu uhu", "UHU!"],
};

// ---- Autonomous event deck ----
// cooldownMs = per-event minimum gap between firings.
const EVENT_DECK = [
  { key: 'coffee',      weight: 4, cooldownMs: 5 * 60 * 1000 },
  { key: 'meeting',     weight: 3, cooldownMs: 8 * 60 * 1000 },
  { key: 'birthday',    weight: 1, cooldownMs: 20 * 60 * 1000 },
  { key: 'lampFlicker', weight: 2, cooldownMs: 4 * 60 * 1000 },
];

// ---- Day rhythm (real local clock) ----
// from = first hour of the phase (24h). tint/tintOpacity drive #dayOverlay.
// ghostVis/ghostHid scale the ghost's visible/hidden interval ranges;
// ghostSpeed scales ghost walk speed; lampWeight scales the lampFlicker deck weight.
const DAY_PHASES = [
  { key: 'morning',   from: 7,  to: 11, tint: 'transparent',          tintOpacity: 0,    events: 1.2, chat: 1.0, speed: 1.1,  ghostVis: 1, ghostHid: 1,   ghostSpeed: 1,   lampWeight: 1 },
  { key: 'midday',    from: 11, to: 14, tint: '#FFB347',              tintOpacity: 0.05, events: 1.0, chat: 1.2, speed: 1.0,  ghostVis: 1, ghostHid: 1,   ghostSpeed: 1,   lampWeight: 1 },
  { key: 'afternoon', from: 14, to: 17, tint: 'transparent',          tintOpacity: 0,    events: 0.8, chat: 0.8, speed: 0.85, ghostVis: 1, ghostHid: 1,   ghostSpeed: 1,   lampWeight: 1 },
  { key: 'evening',   from: 17, to: 21, tint: '#E8722C',              tintOpacity: 0.08, events: 0.7, chat: 0.7, speed: 0.9,  ghostVis: 1, ghostHid: 1,   ghostSpeed: 1,   lampWeight: 1 },
  { key: 'night',     from: 21, to: 7,  tint: '#1B2A4A',              tintOpacity: 0.25, events: 0.4, chat: 0.4, speed: 0.7,  ghostVis: 2, ghostHid: 0.5, ghostSpeed: 1.3, lampWeight: 3 },
];

// ---- Observation-card mood words (default rotation per character) ----
const MOOD_WORDS = {
  andy: ['coping', 'peckish', 'contemplative', 'circling back'],
  jazz: ['sparkling', 'organized', 'plotting a surprise', 'cozy'],
  olex: ['compiling', 'skeptical', 'optimizing', 'low power'],
  ghost: ['uhu'],
};
