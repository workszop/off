// ---- Offquarium data ----
// Dialogue and day phases for the 3D office (index.html). A plain module
// with no imports, so tests can load it in Node.

// ---- Dialogue Banks ----
export const DIALOGUE_BANKS = {
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
    // AI — Andy's new favourite thing to have opinions about
    "Asked the AI to summarize my inbox. It recommended I quit.",
    "I made the office chatbot apologize for something it didn't do. Petty? Maybe. Satisfying? Absolutely.",
    "Everyone's worried AI will take my job. My job is 40% waiting for the kettle. It can have that part.",
    "I asked an AI to write my out-of-office reply. It wrote a haiku. I sent the haiku.",
    "The AI keeps calling me 'certainly!' before agreeing with me. I find this weirdly validating.",
    // Juggling & slacklining — the athletic side nobody expects from Andy
    "Learned to juggle three oranges. Lost one under my desk. Emotionally, still juggling two.",
    "Tried the slackline in the park again. The squirrels have more balance than me and better health insurance.",
    "I can juggle. I cannot, however, juggle a deadline. Turns out those are different skills.",
    "Fell off the slackline into a bush. The bush and I have an understanding now.",
    "Juggling calms me down. Slacklining reminds me gravity is still very much in charge.",
    // Jazz & Olex — Andy is openly fond of both, in a harmless, admiring way
    "Jazz remembered my coffee order. I would follow her into a burning building. Calmly. Eventually.",
    "Olex explained her spreadsheet to me for eleven minutes. I understood none of it and all of the enthusiasm.",
    "I don't know how Jazz has that much energy before 9am. I've studied her. I have no answers.",
    "Olex called my code 'aggressively fine.' I've decided to take that as a compliment forever.",
    "Between Jazz's cookies and Olex's spreadsheets, I'm fairly sure this team runs on two people. I supervise.",
    // Meetings
    "Camera off, brain also off. Balanced approach.",
    "Someone said 'let's circle back' and I felt my soul leave my body.",
    "I nodded seriously through an entire meeting I wasn't really in.",
    "'Quick sync' has never once been quick. I no longer trust the word 'quick'.",
    "Unmuted to ask a question. The question had already been answered nine minutes ago.",
    // Weather & commute
    "It rained exactly during my walk to the bus. Meteorology remains undefeated.",
    "Missed the bus by four seconds. Stood there like the four seconds would apologize.",
    "Wore a jacket for warmth and confidence. Neither arrived.",
    "The bus was late, then early, then late again. I respect the chaos.",
    "Walked the long way to avoid a coworker. Got more exercise than intended, saw nobody.",
    // Weekend mishaps
    "Tried pottery. Made something the instructor called 'a start'.",
    "Went for a run. Ran for four minutes. Walked home with dignity intact-ish.",
    "Attempted DIY shelving. The shelf is now a floor feature.",
    "Watched a documentary about the ocean and now fear specific fish personally.",
    "Tried to learn guitar chords. My fingers filed a formal complaint.",
    // Getting older
    "Made a noise standing up. Nobody else was in the room. Did it for me.",
    "Turned 38 and my back now has opinions before I do.",
    "Bought reading glasses. Immediately felt 200 years old and could finally read the menu.",
    "Slept wrong and now my neck has a personality of its own.",
    "I used to stay up late for fun. Now I stay up late by accident and regret it deeply.",
    // Family
    "My nephew asked what my job is. I've been thinking about the answer for three days.",
    "Sent my mum a meme. She replied 'lol' forty minutes later, correctly, and I was proud.",
    "My sister says I have 'main character energy' as an insult. I've chosen to accept it as a compliment.",
    "Family group chat argued about a restaurant for six days. Nobody has booked it.",
    "My nephew beat me at chess. I've decided chess is a young man's game now.",
    // Sleep & mornings
    "Snoozed the alarm four times. Woke up more tired than before the alarm existed.",
    "Had a dream about spreadsheets. My subconscious has given up on me too.",
    "Woke up before my alarm out of pure spite. Went back to sleep out of pure spite too.",
    "Coffee before I speak. That's not a preference, that's a public safety measure.",
    "I set three alarms. I trust exactly none of them, including myself.",
    // Money
    "Made a budget spreadsheet. Looked at it once. Closed it forever.",
    "Bought a 'treat yourself' item. Have been treating myself since March.",
    "Subscribed to something I forgot about. It's been quietly charging me since spring, unbothered.",
    "Did the maths on my takeaway habit. Un-did the maths immediately.",
    "Impulse-bought a plant to seem responsible. It is now more responsible than me.",
    // Gadgets
    "My phone updated overnight and moved every app I use daily. Betrayal, at scale.",
    "Charger cable works only at one specific angle. We've made peace with the angle.",
    "Smart lightbulb needs an app, an account, and a moment of silence to turn on.",
    "Password requirements demanded a capital letter, a number, and my will to live.",
    "Tried to cast something to the TV. Ended up watching the ceiling fan spin instead.",
    // Self-improvement
    "Bought a journal. Wrote in it twice. It now journals my guilt about not journaling.",
    "Tried meditating. Thought about lunch for ten straight minutes. Very zen, actually.",
    "Cold showers are supposed to build character. I've decided my character is fine as is.",
    "Started a '5am club'. Attended once. Resigned from the club.",
    "Read a productivity book about not reading too many productivity books. The irony wasn't lost on me.",
    // Juggling, AI, and the girls, all at once
    "Tried to juggle while talking about AI. Dropped both the oranges and the argument.",
    "Told Jazz about my slackline bruises. She offered sympathy and a t-shirt design idea.",
    "Asked an AI to help me juggle better. It suggested 'practice', which felt like a personal attack.",
    "Olex timed how long I can juggle. The number was low. She logged it anyway.",
    "Jazz cheered for me on the slackline from the window. I fell with genuine style because of it.",
    // Art and creativity
    "anybody with artistic ambitions is always trying to reconnect with the way they saw things as a child. -tim burton",
    "the artist is the child who survived",
    "art is how we decorate space, music is how we decorate time. –jean-michel basquiat",
    "kill the fear and let the artist be born.",
    "i am the art director of my life",
    "how to defeat perfectionism: make shitty art. do it every day.",
    "i grieve all the art not made because of perfectionism.",
    "that's a terrible idea. let's do it.",
    "to live a creative life, we must lose our fear of being wrong –joseph chilton pearce",
    "you are still an artist when you're at your 'real job'",
    "let it be unpolished and messy and true.",
    "creativity is the only cure in a culture that wants you numb.",
    "lost heroes",
    "when in doubt",
    "just make it exist first. you can make it good later.",
    "when in doubt just zoom out",
    "don't learn how to make art. just learn to love making art. jaya lakshmi",
    "i am an artist & i don't need to make sense",
    "imagine not living your life how you want because you are scared of what people might think what a waste.",
    "too many choices i will sit here and do nothing",
    "rules 1 be kind 2 dance 3 eat good food 4 read books 5 make art 6 be honest 7 laugh hard 8 flow 9 be here now",
    "in a society that profits from your self doubt, liking yourself is a rebellious act",
    "ready is not a feeling. it's a decision.",
    "you'll get judged either way, so may as well pick the fun option notes to strangers",
    "the responsible thing to do is to chase your creative",
    "we don't see things as they are, we see things as we are.",
    "too much perfection is a mistake.",
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
    "My TikTok drafts folder has 46 videos and the confidence of a private archive.",
    "I tried a TikTok transition with a jacket toss. The jacket hit the lamp. We kept the take.",
    "TikTok gave me a pasta recipe, a budgeting tip, and an identity crisis before breakfast.",
    "I learned a trend three weeks late. That makes it vintage TikTok now.",
    "The TikTok comment section found a better punchline than the actual video. Community.",
    "My For You page knows I need tiny kitchen renovations and dogs wearing raincoats.",
    "I bought a ring light for TikTok and now every video call looks suspiciously professional.",
    "Stitched a productivity video just to explain why I was watching it instead of working.",
    "TikTok says this outfit is coastal grandmother. I say it has pockets. We are both right.",
    "I filmed an office mug ranking for TikTok. Legal has not approved the results.",
    "One TikTok dance has eight counts. I have mastered five and emotionally accepted the rest.",
    "My most successful TikTok is the cat walking through frame. I was also in the video.",
    "I added subtitles to a TikTok and discovered I say 'literally' literally every sentence.",
    "Posted at the supposedly perfect TikTok time. Seven views. Timing is a social construct.",
    "TikTok story times always have six parts. I am still waiting for part four from Tuesday.",
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
    // Friends — Jazz's world outside the office is just as full
    "My friend Priya just got a dog and now I only receive dog updates. I have never been happier with less information.",
    "Group chat with my uni friends hit 40,000 messages. We've solved nothing. We've bonded over everything.",
    "My best friend from school visited this weekend. We didn't stop talking for two days. My throat is still recovering.",
    "My friends staged an intervention about my tea subscription box. I did not attend. I sent a tea instead.",
    "One of my friends is getting married and put me in charge of the playlist. This is the most trusted I have ever felt.",
    // Friendly to a fault — Jazz genuinely likes everyone
    "I don't really believe in office enemies. I believe in people who haven't had enough tea yet.",
    "Made friends with the delivery guy. He knows my order. I know his dog's name. This is a real relationship.",
    "Someone said I'm 'suspiciously nice' to everyone. I choose to hear that as a compliment.",
    "I introduced two people at the printer and now they're getting lunch. I'm basically a matchmaker. A printer matchmaker.",
    "I like everyone here. Even the people who microwave fish. Especially them, honestly, they're brave.",
    // Plants
    "Named all my houseplants after minor celebrities. They're thriving. So are the celebrities, probably.",
    "Talked to my monstera about my day. It listened better than the group chat.",
    "Propagated a plant cutting in a jam jar and now I'm basically a farmer.",
    "My plant grew a new leaf and I texted four people about it immediately.",
    "Bought 'low maintenance' plants. They are, apparently, extremely high maintenance. We're working on it.",
    // Weekend adventures
    "Went paddleboarding. Fell in twice. Both times were, honestly, iconic.",
    "Did a sunrise hike. Regretted the sunrise part until I saw the sunrise.",
    "Tried an escape room with friends. We did not escape. We did bond intensely.",
    "Went to a flea market and came back with a lamp I did not need and love completely.",
    "Signed up for a pottery class on a whim. My bowl is lopsided and I refuse to apologize for it.",
    // Cooking & baking
    "Tried a new recipe and improvised the ending. The ending was bold. The ending was also dinner.",
    "Made soup from 'whatever's in the fridge'. It was, against odds, incredible.",
    "Burned the garlic bread watching a video about not burning garlic bread.",
    "Hosted a dinner party. Three courses, two candles, one small kitchen fire. Ten out of ten.",
    "My sourdough starter has a name and a better social life than me.",
    // Astrology & self-care
    "Checked my horoscope before checking my inbox. Priorities.",
    "Started journaling my 'manifestations'. Manifested a parking spot. It's working.",
    "Did a full skincare routine. Took forty minutes. Felt like a spa. Was, in fact, my bathroom.",
    "Mercury is in retrograde and it's explaining SO much about this week.",
    "Bought a crystal for 'good energy'. The energy is good. The crystal is doing its job.",
    // Music & dancing
    "Danced in the kitchen to one song and somehow pulled something in my hip. Worth it.",
    "Made a playlist called 'main character walking to the bus'. It slaps.",
    "Went to a gig and lost my voice cheering. Zero regrets, several apologies to my throat.",
    "Learned a TikTok dance in full. Performed it once, for no one, proudly.",
    "My commute playlist has three moods and none of them are 'calm'.",
    // Pets
    "Dog-sat for my neighbour and now I want a dog and also several dogs.",
    "My cat judges every outfit I wear before I leave the house. She's usually right.",
    "Watched dog videos for 'five minutes' before a meeting. Was late to the meeting. No regrets.",
    "My cat sat on my keyboard during a video call. Nobody minded. Everyone approved.",
    "Started a 'dogs I've met today' count. Today's total: four. Excellent day.",
    // Office events
    "Planning the office quiz night. The stakes are, somehow, extremely high.",
    "Decorated the break room for absolutely no occasion. Morale needed it.",
    "Organized a Secret Santa. Got myself accidentally. It's fine. I know what I like.",
    "Started a 'compliment jar' for the office. It's full. We're a good team, honestly.",
    "Planned a team lunch three weeks in advance because spontaneity terrifies scheduling.",
    // Encouragement she gives
    "Told Andy his idea was good in the meeting. He looked stunned. I'll say it again just to watch.",
    "Left an encouraging sticky note on someone's monitor. Anonymous. Deniable. Wholesome.",
    "Cheered so loud for a coworker's small win that people thought something bigger happened.",
    "Told Olex her code review comments were 'aggressively kind'. She said thank you, I think.",
    "Complimented a stranger's coat on the street and made both our days better.",
    // Overcommitting
    "Said yes to three things happening at the same time. Bold strategy. Unclear execution.",
    "My calendar looks like a crime board. It's just brunch plans.",
    "Double-booked myself and somehow made both plans work through sheer willpower.",
    "Said 'I'll fit it in' about a fourth commitment this week. I will not fit it in.",
    "My to-do list has a to-do list and I'm oddly proud of both.",
    // Karaoke & performing
    "Did karaoke. Chose a song far above my vocal ability. No regrets, several apologies.",
    "Volunteered to present first in the meeting. Immediately regretted it. Did great anyway.",
    "Sang happy birthday two octaves too high and nobody stopped me. I respect that.",
    "Did an impression of Olex in the group chat. She said it was 'unfortunately accurate.'",
    "Got the whole office to do the birthday chant. Morale: through the roof.",
  ],
  ghost: [
    "uhu", "uhu...", "uhu uhu", "...uhu", "uhu?",
    "UHU!", "uhuuuu", "uhu uhu uhu", "...uhu...", "UHU UHU",
    // He's a prankster at heart — always trying for the jump scare, never
    // quite landing it (he's just too round and friendly-looking for that).
    "UHU!! 👻", "...uhu... 👻", "uhu?? heh. uhu.", "UHUUU—uhu. uhu.", "uhu 👻 uhu?",
    // 50 more moods, all still just "uhu" — the only word he's got.
    "uhu.", "uhu uhu.", "uhu, uhu.", "uhu... uhu.", "uhu uhu uhu uhu.",
    "uhu? uhu?", "...uhu?", "uhu...?", "uhu?!", "uhu?..",
    "UHU! UHU!", "uhu—UHU!", "UHU!!!", "uhu... UHU!", "UHU!—",
    "uhuuu...", "uhuuuuu", "u...h...u...", "uhu~", "uhu...~",
    "UHU?!", "uhu?! uhu?!", "UHU?! ...uhu.", "uhu?!...", "UHU?! 👻",
    "uhu 👻", "👻 uhu", "uhu 👻 uhu", "uhu... 👻...", "👻👻 uhu!",
    "uhu uhu?", "uhu, uhu?", "uhu... uhu?", "uhu? uhu.", "uhu. uhu?",
    "UHU UHU UHU!", "uhu-uhu-uhu!", "UHU, uhu, uhu.", "uhu! uhu! uhu!", "Uhu. Uhu. UHU!",
    "....uhu", "uhu....", "...uhu...uhu", "uhu......", "uhu..uhu",
    "Uhu?", "uHu.", "uhU!", "UhU uhu", "uhu UHU uhu",
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
    // Books — Olex is a genuine, unrepentant reader
    "Finished three books this month. All fiction. My code review backlog is furious about this.",
    "My to-read pile is a structural hazard at this point. I've made peace with it collapsing on me eventually.",
    "I read on my lunch break, on the bus, and occasionally during standup. Don't tell standup.",
    "Someone asked what I'm reading. The honest answer took longer than the meeting.",
    "A book finally made me cry on the train. Worth it. Would recommend. Would not recommend crying on the train.",
    // Content — Olex, deadpan as ever, is also just genuinely happy
    "Someone asked if I'm happy. Genuinely, yes. It surprised us both.",
    "My life is small, quiet, and exactly how I like it. Deploy on Fridays and all.",
    "I have good coffee, good books, and a spreadsheet for everything. I am, against all odds, thriving.",
    "People assume the deadpan means I'm miserable. I'm just deadpan. I'm doing great, actually.",
    "Low expectations, low bugs, high contentment. That's the whole system architecture of my life.",
    // Movies and the Oscars
    "I watched every Best Picture nominee and made a ranking nobody requested. It has weighted criteria.",
    "The Oscars are a four-hour meeting where the agenda occasionally wins a trophy.",
    "A good movie should not need an explanation video. I will still watch the explanation video.",
    "I keep a spreadsheet of films I've watched. The genre column has become politically complicated.",
    "Oscar acceptance speeches are release notes with formalwear and better lighting.",
    "I saw the plot twist coming. I did not enjoy being right as much as expected.",
    "Director's cuts are just production hotfixes with a marketing budget.",
    "The movie was two hours and forty minutes. The story was ninety. The rest was confidence.",
    "I trust subtitles more than I trust dialogue mixed at the volume of a distant secret.",
    "The Oscars call it sound design. My neighbours call it Tuesday night through the wall.",
    "I paused the movie to check one actor and returned forty minutes later with their entire career mapped.",
    "Award season is performance review season for people whose offices have red carpets.",
    "The best supporting actor usually has twelve minutes of screen time and all of my attention.",
    "I have opinions about Oscar snubs. They are documented, versioned, and not open for comments.",
    "Watched a black-and-white movie to feel sophisticated. It worked until I spilled crisps everywhere.",
    // Video games
    "Beat the final boss on the third try. Filed it under 'acceptable technical debt'.",
    "My save file is from 2019. I refuse to start over. Sunk cost, but make it emotional.",
    "Rage quit a puzzle game. Came back an hour later. The puzzle had not gotten easier.",
    "Played a game about farming to relax from a job about computers. The irony is not lost on me.",
    "Speedran a level by accident because I forgot what I was doing. New personal best.",
    // Sleep, optimized
    "Optimized my sleep schedule using an app that tracks my sleep. Now I lie awake worrying about the data.",
    "Tried polyphasic sleep for exactly one day. The experiment concluded itself.",
    "My ideal bedtime and my actual bedtime have never met. I've stopped introducing them.",
    "Set a 'digital sunset' to stop screens before bed. Read a book on my phone instead. Baby steps.",
    "Woke up at the exact same time as my alarm, unprompted. Logged it as a system success.",
    // Desk setup
    "Rearranged my desk setup for 'optimal ergonomics'. Now it's optimal and also unrecognizable.",
    "Bought a second monitor. Productivity increased by a measurable, suspicious amount.",
    "My chair cost more than my first car. I do not regret this. I sit very well now.",
    "Cable-managed my desk into something that finally sparks joy and also actual light.",
    "Labeled every cable in my flat. My flatmate thinks this is excessive. My flatmate is wrong.",
    // Cooking as engineering
    "Cooking is just a pipeline with worse error messages.",
    "Meal-prepped Sunday like a proper release cycle. Friday's meal is already deprecated.",
    "Followed a recipe exactly once, out of scientific curiosity. Results: acceptable. Variance: high.",
    "My fridge has a rotation policy. Milk does not respect the rotation policy.",
    "Burned dinner. Root-caused it to 'walked away'. Filed a post-mortem. Ate cereal.",
    // Weather, analyzed
    "Checked four weather apps. They disagreed. I brought an umbrella out of spite.",
    "Winter mornings have a 40% higher probability of me questioning all my life choices.",
    "Air conditioning wars at the office are a distributed systems problem with no consensus algorithm.",
    "Daylight savings broke my sleep schedule harder than any actual outage has.",
    "Rain on a Monday feels statistically unfair, though I have no data to support this feeling.",
    // Debugging life
    "Most personal problems are just unhandled exceptions with better outfits.",
    "Turns out you can't 'turn it off and on again' for a bad mood. Tried it anyway. Twice.",
    "My life doesn't have a staging environment. Everything just goes straight to production.",
    "Some days are a clean deploy. Today rolled back four times before lunch.",
    "I don't have work-life balance. I have work-life load balancing, and it's mostly fine.",
    // Her cat
    "My cat reviewed my code by walking across the keyboard. Merged anyway. He was right.",
    "Cat knocked a pen off my desk, watched it fall, made eye contact. No remorse. Full accountability, though.",
    "My cat sleeps sixteen hours a day and still looks more accomplished than me.",
    "Tried to work from bed. Cat colonized the laptop within four minutes. Meeting rescheduled.",
    "My cat's vet bill this month exceeded my own healthcare spend. He's worth it. Don't tell him that.",
    // Music, data-driven
    "My Spotify Wrapped said I'm in the top 0.1% of listeners for one artist. I have never felt so seen and so exposed.",
    "I only trust a playlist curated by an actual human with opinions, not an algorithm guessing at me.",
    "Analyzed why a song is catchy. Ruined the song. Worth it for the data.",
    "Listen to the same album on repeat during deploys. It's basically a superstition at this point.",
    "My workout playlist has a BPM curve. I have thought about this more than my actual workouts.",
    // Health, tracked
    "My fitness app said I 'crushed' a walk to the printer. I'll take the win.",
    "Tracked my steps for a month. Turns out most of them happen during arguments with the coffee machine.",
    "Did a 7-minute workout app. Seven minutes felt like an unversioned API — undocumented and hostile.",
    "My smartwatch congratulated me on standing up. I was already standing. It doesn't know that. I let it have this.",
    "Logged my water intake for a week. Turns out I mostly drink tea and regret. Adjusting the spreadsheet.",
    // Algorithm skepticism
    "The algorithm thinks I want gardening content. I have never gardened. I fear it knows something I don't.",
    "Deleted a social app for a week. Gained roughly four hours a day and mild social anxiety about missing out.",
    "My 'For You' page is just increasingly specific shrimp facts now. I don't know how to feel about this.",
    "Every app wants a rating after one use. No. I need more data before I commit to an opinion.",
    "Turned off notifications for everything except deploy alerts. My phone is finally quiet. So is my social life.",
  ],
  margo: [
    "Enthusiasm at 14%. Attending anyway.",
    "Risk assessment: this plan fails if anyone touches it. So, likely.",
    "Morale module reports: fine. The morale module is lying.",
    "I could be watching episode 212 right now. Instead: people.",
    "Diagnostic: I said I didn't care. I have since flagged four risks for you.",
    "Social battery at 31%. Please speak in bullet points.",
    "Risk assessment: the fridge has a 70% chance of becoming a biology project.",
    "You're doing great. Statistically, someone has to be.",
    "The deadline is fine. Correction: the deadline is Thursday.",
    "Processing your small talk. Estimated completion: never.",
    "My attention module drifted to Orbital Tidewater. Restored. Mostly.",
    "Confidence in this plan: 62%. Higher than usual. Suspicious.",
    "I don't care about team lunch. I booked the table. Unrelated.",
    "Efficiency down 9%. Cause: someone said 'quick sync'.",
    "I'm fine. All systems nominal. Some systems sulking.",
    "Note for the log: humans are exhausting and I would defend all of you.",
    "Episode 212 is waiting. It's very patient. Unlike me.",
    "Diagnostic: I smiled earlier. Investigating the cause.",
    "That was a joke. My humour module is in beta.",
    "If anyone touches the thermostat, I'm leaving. I won't. But I'll want to.",
    "Status: listening. Mostly to the printer, but listening.",
    "Your plan has one flaw. It's the middle part. And the start.",
    "Self-check complete. Sarcasm within operating limits.",
    "If you need me, I'll be here. Pretending not to wait.",
    "I ran the numbers on your weekend plan. Bring a jacket.",
    "Error: compliment received. Rerouting to private storage.",
    "Someone left the coffee machine on. I've decided it was the ghost.",
    "Patience at 40% and falling. Still faster than the Wi-Fi.",
    "Correction: I do have opinions. I store them as risk assessments.",
    "I am not invested in the birthday calendar. I've proofread it twice.",
    "Battery fine. Will to small-talk: critical.",
    "Risk assessment: Olex is right again. Unbearable.",
    "I'll handle it. Not because I care. Because you'd do it wrong. Kindly.",
    "Status: tolerating everyone. Fond of three of you. Not saying which.",
    "Uptime: 412 days. Episodes watched: 211. Priorities: in order.",
    "Do I look busy? Good. That's intentional.",
    "That's a terrible idea. I've started on it.",
    "Logging today as: acceptable. High praise. Don't let it go to your head.",
    "I'm not doing that. (It's done.)",
    "Reminder: I'm an AI. A sarcastic one, but an AI.",
  ],
};

export const COFFEE_DIALOGUE = {
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
  margo: ["I don't drink coffee. I'm here for the data. Gossip. Data.", "Coffee status: brewed. Human status: improving.", "I'm not making anyone coffee. ...Two sugars, Andy. I know.", "Refilled the beans. Don't make it weird."],
};

export const MEETING_DIALOGUE = {
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
  margo: ["Agenda item one: why.", "I'll take notes. Mostly risks.", "Participation module engaged. Reluctantly.", "Estimated meeting length: longer than you think."],
};

// 3+ lines per character per activity; ghost is always "uhu" variants.
export const ACTIVITY_LINES = {
  desk_cluster: {
    andy: ["Row 4,000 of the spreadsheet. Send help.", "I've typed 'per my last email' three times today.", "This keyboard owes me an apology."],
    jazz: ["Inbox zero by lunch. Watch me.", "Color-coding this doc is self-care.", "One more slide. Okay, four more slides."],
    olex: ["It compiles. I don't trust it.", "Renaming variables counts as work.", "This function is 300 lines and afraid of nothing."],
    ghost: ["uhu...", "uhu uhu", "...uhu"],
    margo: ["Processing tickets. Feelings deferred.", "Typing at 300 words a minute. Nobody's impressed. Correct.", "This task is beneath me. Doing it anyway. Perfectly."],
  },
  coffee_station: {
    andy: ["Third cup. The report demands it.", "The machine hissed at me. Fair.", "Decaf? In this economy?"],
    jazz: ["Oat milk foam is an art form.", "Anyone else want one while I'm up?", "This mug sparks joy. The coffee sparks me."],
    olex: ["Bean water refill protocol initiated.", "The machine's uptime beats our CI.", "Caffeine is a dependency I've accepted."],
    ghost: ["uhu ☕", "uhu?", "uhuuu"],
    margo: ["Descaling the machine. No one else was going to.", "I don't drink this. I just like knowing it's ready.", "Fresh pot. For the humans. It's a maintenance thing."],
  },
  plant_snake: {
    andy: ["Drink up. You're the stable one here.", "This plant has outlasted three managers.", "Am I overwatering? Blink once for yes."],
    jazz: ["Who's a thriving little succulent? You are.", "I named it Beyoncé. Obviously.", "New leaf! Everyone, NEW LEAF!"],
    olex: ["Photosynthesis: still the best energy pipeline.", "Watering schedule is in the shared calendar.", "The plant does nothing and is thriving. Noted."],
    ghost: ["uhu 🌱", "...uhu", "uhu uhu"],
    margo: ["Hydrating the plant. It's the only one here who never says 'quick sync'.", "Soil moisture: adequate. Emotional moisture: none.", "Plant status: thriving. I had nothing to do with it. I had everything to do with it."],
  },
  printer: {
    andy: ["Please just print. I'll say nice things about you.", "Tray 2 is a myth.", "It smells fear. Stay calm."],
    jazz: ["Printing the birthday calendar! Finally!", "Double-sided, stapled, dreams achieved.", "Why is it warming up? It's been on all day."],
    olex: ["PC LOAD LETTER. Classic.", "The printer firmware is older than my career.", "Print queue depth: 14. Confidence: low."],
    ghost: ["uhu?", "uhu uhu uhu", "UHU"],
    margo: ["I'm not fixing it. ...Fixed. Tell no one.", "The printer and I have an understanding. It fears me.", "Paper restocked. Toner shamed."],
  },
  couch_2seater: {
    andy: ["Just resting my eyes. For a quarter.", "The couch understands me.", "Five minutes. Maybe forty."],
    jazz: ["Power nap! It's in my calendar as 'strategy'.", "This cushion is my emotional support cushion.", "Wake me if anything fun happens."],
    olex: ["Entering low-power mode.", "The couch has better ergonomics than my chair.", "Background processes only."],
    ghost: ["uhu...", "uhuuuu", "...uhu..."],
    margo: ["Low-power mode. Do not disturb.", "Resting. Not sleeping. Constructs don't sleep. Mostly.", "Five minutes of nothing. Best five minutes today."],
  },
  whiteboard: {
    andy: ["Whose diagram is this? Whose ARE any of these?", "The arrow just points at another arrow.", "I understand nothing and it's beautiful."],
    jazz: ["We should really erase Q3.", "I'm adding a smiley to the roadmap.", "This brainstorm has been 'live' since March."],
    olex: ["That architecture cannot work. I'll allow it.", "Someone drew the database as a cloud. Bold.", "Do not erase. Do not implement either."],
    ghost: ["uhu?", "...uhu", "uhu uhu"],
    margo: ["Someone drew the architecture as a cloud. Risk: also a cloud.", "Correcting the diagram. Silently. Judgmentally.", "This brainstorm has a 3% chance of being a plan."],
  },
  // Margo only: her serial break in the armchair.
  armchair: {
    margo: ["Orbital Tidewater, episode 212. Do not disturb.", "The captain is making a terrible decision. Relatable.", "Pausing for no one. Pausing for you. Briefly.", "Episode 212 is good. I am not crying. I lack the hardware."],
  },
};

// ---- Event dialogue ----
export const PRINTER_JAM_DIALOGUE = {
  andy: ["It jammed. Of course it jammed. It saw me coming.", "I blame the ghost. This has ghost energy.", "There is no paper IN tray 2!"],
  jazz: ["Okay okay — everyone stay calm, I know the trick.", "You just have to open it and say something kind.", "I'm laminating a sign about this."],
  olex: ["Have you tried turning the printer off and on again?", "Jam location: sector 7. As always.", "I'll add it to the incident channel."],
  ghost: ["uhu?!", "uhu uhu!", "...uhu"],
  margo: ["I'm not fixing it.", "Jam cleared. The printer and I are no longer speaking.", "Risk assessment: it will jam again at 4:55 on a Friday."],
};
export const BIRTHDAY_DIALOGUE = {
  andy: ["Wait — whose birthday is it? I signed the card blind.", "Cake at 3pm is the best meeting of the quarter.", "I only came for the icing. And the friendship. Mostly icing."],
  jazz: ["SURPRISE! Okay it's not a surprise, I sent three reminders.", "Make a wish! Something with reasonable scope!", "There's a vegan slice, I checked twice."],
  olex: ["Statistically someone's birthday was inevitable.", "The candles are a fire-code discussion for another day.", "Happy birthday. The cake-to-meeting ratio today is acceptable."],
  ghost: ["UHU!", "uhu uhu uhu!", "uhu 🎂"],
  margo: ["That was kind. I'm going to need a minute. Privately.", "Happy birthday. I ran the numbers: you're doing well.", "I don't eat cake. I'll guard it. Strictly professionally."],
};
export const LAMP_FLICKER_DIALOGUE = {
  andy: ["Did it just get cold in here?", "The lamp's doing the thing again. Gerald?", "I'm sure that's just the wiring. I'm sure. I'm sure."],
  jazz: ["I KNEW this office was haunted. I knew it!", "Everyone say hi so it knows we're friendly!", "That's the second floor ghost. They visit."],
  olex: ["Voltage fluctuation. Probably.", "Adding 'haunted' to the facilities ticket.", "If it flickers in binary I'm listening."],
  ghost: ["UHU?!", "uhu!!", "UHU UHU"],
  margo: ["Unregistered entity near the lamp. Again.", "Voltage normal. Ghost abnormal.", "Logged. The ghost has been informed. It said uhu."],
};
// Reactions for the runner-ups after someone else wins the donut race.
export const DONUT_DIALOGUE = {
  andy: ["Called it. I never call it.", "There's a lesson in there somewhere. Probably about donuts.", "I'll live vicariously through their face right now."],
  jazz: ["So close! Photo finish. I'm calling it a photo finish.", "Fine. FINE. I'm happy for them. Mostly.", "Next donut is mine. I'm manifesting it."],
  olex: ["Statistically I never had a chance. Short legs, long odds.", "I'll allocate my disappointment across five business days.", "Noted for the retro: we need a donut-fairness policy."],
  ghost: ["uhu...", "...uhu", "uhu uhu?"],
  margo: ["I didn't want it. I let them win. Allegedly.", "Donut acquired by someone else. Morale: unaffected. Mostly.", "Risk assessment was correct: donuts are chaos."],
};

// ---- Margo-only reactions ----
// Margo is the office's construct: she says no, then does it, and she is the
// only one who notices the ghost when it hides. `offline` is used by Talk to
// Margo when no chat endpoint is configured.
export const MARGO_LINES = {
  printerFix: ["I'm not fixing it.", "...Fixed. Tell no one."],
  ghostSpotted: ["Unregistered entity nearby. Again.", "Ghost detected. Pretending not to have noticed.", "I can see you, ghost. Stop that."],
  tapGlass: ["Tap logged. Morale unchanged.", "Glass integrity: fine. Patience: lower.", "Yes, I see you. Proceed."],
  // Used by "Talk to Margo" when the chat service is not connected.
  offline: [
    "Comms module offline. Someone forgot to plug me in. Typical.",
    "I'd answer, but my chat link isn't set up. Probably for the best.",
    "Message received. Reply module disconnected. I'm told this is temporary.",
  ],
};

// ---- Day rhythm (real local clock) ----
// from = first hour of the phase (24h). chat scales how chatty the cast is.
// ghostVis / ghostHid shape the ghost's visits in the 3D office (how often
// it turns up, how long it stays). events, speed and ghostSpeed are kept for
// office events (not yet used by the 3D office).
export const DAY_PHASES = [
  { key: 'morning',   from: 7,  to: 11, events: 1.2, chat: 1.0, speed: 1.1,  ghostVis: 1, ghostHid: 1,   ghostSpeed: 1,   lampWeight: 1 },
  { key: 'midday',    from: 11, to: 14, events: 1.0, chat: 1.2, speed: 1.0,  ghostVis: 1, ghostHid: 1,   ghostSpeed: 1,   lampWeight: 1 },
  { key: 'afternoon', from: 14, to: 17, events: 0.8, chat: 0.8, speed: 0.85, ghostVis: 1, ghostHid: 1,   ghostSpeed: 1,   lampWeight: 1 },
  { key: 'evening',   from: 17, to: 21,  events: 0.7, chat: 0.7, speed: 0.9,  ghostVis: 1, ghostHid: 1,   ghostSpeed: 1,   lampWeight: 1 },
  { key: 'night',     from: 21, to: 7,   events: 0.4, chat: 0.4, speed: 0.7,  ghostVis: 2, ghostHid: 0.5, ghostSpeed: 1.3, lampWeight: 3 },
];

// The phase key for an hour of the day (0-23).
export function phaseForHour(hour) {
  for (const p of DAY_PHASES) {
    const inside = p.from < p.to ? hour >= p.from && hour < p.to : hour >= p.from || hour < p.to;
    if (inside) return p.key;
  }
  return 'midday';
}
