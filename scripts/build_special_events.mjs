/**
 * Generates data/special-events.json from squad roster + curated event lines.
 * Run: node scripts/build_special_events.mjs
 */
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const squads = JSON.parse(readFileSync(join(ROOT, "data", "squads.json"), "utf8"));

const VALID_EFFECTS = new Set([
  "boost", "disrupt", "chaos", "chance", "gk_moment", "momentum_up", "momentum_down",
  "stamina_opp", "stamina_self", "yellow", "wide", "set_piece", "turnover",
]);

const L = (text, effect) => {
  if (!VALID_EFFECTS.has(effect)) throw new Error(`Invalid effect: ${effect} for "${text}"`);
  return { text, effect };
};

const pools = {
  quidditch_seeker: {
    members: ["Harry Potter", "Oliver Wood", "Viktor Krum", "Cedric Diggory"],
    lines: [
      L("{name} looks distracted — eyes on the sky for a Snitch?", "disrupt"),
      L("{name} breaks into a seeker dive down the wing!", "wide"),
      L("{name} spots gold glinting — wrong ball, full sprint!", "boost"),
    ],
  },
  force_user: {
    members: [
      "Luke Skywalker", "Darth Vader", "Yoda", "Obi-Wan Kenobi", "Emperor Palpatine",
      "Anakin Skywalker", "Mace Windu", "Qui-Gon Jinn", "Rey", "Kylo Ren",
    ],
    lines: [
      L("{name} uses the Force — the ball swerves unnaturally!", "chaos"),
      L("{name} meditates mid-press... then explodes forward.", "boost"),
      L("{name} extends a hand — the pass obeys.", "boost"),
    ],
  },
  slasher_stalk: {
    members: [
      "Jason Voorhees", "Michael Myers", "Leatherface", "Ghostface", "Chucky", "Freddy Krueger",
    ],
    lines: [
      L("{name} emerges from nowhere — silent footsteps.", "disrupt"),
      L("{name} raises the weapon — pure menace.", "yellow"),
      L("{name} stalks through the mist — defenders freeze.", "stamina_opp"),
    ],
  },
  wwe_promo: {
    members: [], // filled from WWE Legends squad below
    lines: [
      L("{name} grabs the mic — crowd goes wild, play stops briefly.", "chaos"),
      L("{name} hits a stiff worked shot off the ball!", "yellow"),
      L("{name} cuts a promo on the touchline — momentum shifts!", "momentum_up"),
    ],
  },
  super_strength: {
    members: [
      "Hulk", "Thor", "Superman", "Doomsday", "André the Giant", "Great Dragon",
      "Mongo", "Bowser", "Titan", "Donkey Kong", "Bane", "Thanos",
    ],
    lines: [
      L("{name} absolutely clatters someone — legal, somehow.", "yellow"),
      L("{name} shoots from downtown — power only!", "chance"),
      L("{name} launches the ball like a freight train!", "boost"),
    ],
  },
  mad_scientist: {
    members: ["Professor Frink", "Professor Hubert Farnsworth", "Lex Luthor", "Stewie Griffin"],
    lines: [
      L("{name} unveils an untested gadget on the pitch!", "chaos"),
      L("{name}'s invention backfires spectacularly.", "gk_moment"),
      L("{name} calculates trajectory with a slide rule — chaos ensues.", "chaos"),
    ],
  },
  trickster: {
    members: ["Stewie Griffin", "Bart Simpson", "Loki", "Beetlejuice", "Rumpelstiltskin"],
    lines: [
      L("{name} plots something off the ball...", "chaos"),
      L("{name} pulls a prank — chaos in the box!", "set_piece"),
      L("{name} says the magic words — reality wobbles.", "chaos"),
    ],
  },
  tv_antihero: {
    members: [
      "Tony Soprano", "Walter White", "Jesse Pinkman", "Saul Goodman", "Don Draper",
      "Dexter Morgan", "Omar Little", "Stringer Bell", "Tyrion Lannister", "Jack Bauer",
      "Vic Mackey", "Tommy Shelby",
    ],
    lines: [
      L("{name} calculates coldly — slow build, then knife.", "boost"),
      L("{name}'s mask slips — reckless lunge!", "chaos"),
      L("{name} plays the long con — defense overcommits.", "disrupt"),
    ],
  },
};

// WWE pool members from squad
const wweUniverse = squads.universes.find((u) => u.id === "wwe-legends");
pools.wwe_promo.members = wweUniverse.players.map((p) => p.name);

/** @type {Record<string, Array<{text: string, effect: string}>>} */
const players = {
  // ── Lord of the Rings ──
  Gandalf: [
    L("You shall not pass! Gandalf with a heroic last-ditch block.", "boost"),
    L("Gandalf's staff glows — sudden long ball over the top.", "momentum_up"),
    L("A wizard is never late — nor is his through ball.", "boost"),
  ],
  Aragorn: [
    L("Ranger sprint down the flank from Aragorn.", "wide"),
    L("Kingly rally — teammates surge with Aragorn.", "momentum_up"),
  ],
  Legolas: [
    L("Legolas surfing a shield down the wing!", "wide"),
    L("Pinpoint elven volley from Legolas.", "chance"),
  ],
  Gimli: [
    L("And my axe! Gimli with a crunching tackle.", "yellow"),
    L("Gimli refuses to tire — second wind in the press.", "stamina_opp"),
  ],
  Boromir: [
    L("Boromir overcommits for glory.", "chaos"),
    L("Gondor needs this goal! Boromir roars.", "momentum_up"),
  ],
  Faramir: [
    L("Patient captain's pass from Faramir.", "boost"),
    L("Faramir sacrifices his body in the press.", "boost"),
  ],
  Frodo: [
    L("The Ring weighs heavy — Frodo hesitates.", "disrupt"),
    L("Unexpected Samwise-style heart from Frodo.", "boost"),
  ],
  "Samwise Gamgee": [
    L("Mr. Frodo! — Sam carries the move forward.", "boost"),
    L("Potatoes and perseverance — Sam wins the duel.", "boost"),
  ],
  Merry: [
    L("Merry stabs the play in the foot — literally.", "chaos"),
    L("Merry and Pippin partner crime down the wing.", "wide"),
  ],
  Pippin: [
    L("Second breakfast energy — Pippin's late run.", "boost"),
    L("Pippin knocks over a corner flag for no reason.", "chaos"),
  ],
  Gollum: [
    L("My precious... wrong kind of ball, says Gollum.", "disrupt"),
    L("Split personality dribble — Gollum baffles the defender.", "chaos"),
  ],
  Sauron: [
    L("Eye of Sauron — the entire pitch freezes.", "momentum_up"),
    L("Dark power shot from Sauron — goal or wide only.", "chance"),
  ],
  "Witch-king": [
    L("No man can foul him... the ref is unsure.", "chaos"),
    L("Screech of terror — the keeper flinches.", "gk_moment"),
  ],
  Elrond: [
    L("Council wisdom — Elrond's perfect switch.", "boost"),
    L("Half-Elven calm under the press.", "boost"),
  ],
  Galadriel: [
    L("Mirror vision — Galadriel sees the through ball.", "chance"),
    L("Terrifying light — opponents stumble.", "disrupt"),
  ],
  Treebeard: [
    L("Don't be hasty... then Treebeard stomps forward.", "stamina_opp"),
    L("Ent mangle — slow but unstoppable from Treebeard.", "boost"),
  ],
  Eomer: [
    L("Rohan charge! Eomer flies down the line.", "wide"),
    L("Horse-lord fury tackle from Eomer.", "yellow"),
  ],
  Eowyn: [
    L("I am no man! — Eowyn bursts past her marker.", "wide"),
    L("Eowyn slays the angle — clinical finish setup.", "boost"),
  ],
  Theoden: [
    L("Forth Eorlingas! — Theoden's roar lifts the team.", "momentum_up"),
    L("Death ride — Theoden's kamikaze run.", "chaos"),
  ],
  Saruman: [
    L("Isengard industrial press from Saruman.", "boost"),
    L("Palantir scry — Saruman reads the pass.", "disrupt"),
  ],
  Denethor: [
    L("Steward madness — Denethor's wrong-sub energy.", "disrupt"),
    L("Denethor burns the playbook — chaos.", "chaos"),
  ],
  Shelob: [
    L("Web across the channel — Shelob traps the winger.", "disrupt"),
    L("Night ambush from the shadows.", "chaos"),
  ],

  // ── Harry Potter ──
  "Oliver Wood": [
    L("Obsessive keeper drill — Wood refuses to punt.", "gk_moment"),
    L("Wood treats every save like the Quidditch Cup final.", "boost"),
  ],
  "Ron Weasley": [
    L("Chess gambit pass from Ron.", "boost"),
    L("Keeper instincts in the outfield — Ron's accidental save.", "gk_moment"),
  ],
  "Harry Potter": [
    L("Expelliarmus! — Harry strips the ball.", "boost"),
    L("Harry's scar prickles — he anticipates the pass.", "disrupt"),
  ],
  "Hermione Granger": [
    L("Hermione reads the game three moves ahead.", "boost"),
    L("Honestly! — Hermione corrects the ref's angle.", "chaos"),
  ],
  "Draco Malfoy": [
    L("Father will hear about this — Draco dives.", "chaos"),
    L("Slytherin cunning foul from Malfoy.", "yellow"),
  ],
  "Neville Longbottom": [
    L("Neville remembers the feet — textbook tackle!", "boost"),
    L("Sudden bravery surge from Neville.", "momentum_up"),
  ],
  Dumbledore: [
    L("Elder Wand touch — physics optional for Dumbledore.", "chaos"),
    L("Calm twinkle — Dumbledore resets the team.", "momentum_up"),
  ],
  "Severus Snape": [
    L("Always. — Snape cuts the passing lane.", "disrupt"),
    L("Potions master spin on the ball from Snape.", "boost"),
  ],
  "Rubeus Hagrid": [
    L("You're a wizard, Harry — wrong sport, right power from Hagrid.", "yellow"),
    L("Fang chases the ball onto the pitch!", "chaos"),
  ],
  "Lord Voldemort": [
    L("Avada— wait, that's a through ball from Voldemort.", "chance"),
    L("Horcrux split — Voldemort appears twice off the ball.", "chaos"),
  ],
  "Bellatrix Lestrange": [
    L("Unhinged cackle press from Bellatrix.", "yellow"),
    L("Crucio curl — nasty bend on the shot.", "chaos"),
  ],
  "Luna Lovegood": [
    L("Nargles stole the ball! — Luna's explanation.", "chaos"),
    L("Luna sees the play nobody else does.", "boost"),
  ],
  "Fred Weasley": [
    L("Weasley Wizard Wheeze on the touchline!", "chaos"),
    L("Twin confusion — who's on the ball?", "disrupt"),
  ],
  "George Weasley": [
    L("George's prank smoke — visibility zero.", "chaos"),
    L("Synchronized twin run — defense bamboozled.", "boost"),
  ],
  "Cedric Diggory": [
    L("Hufflepuff fair play... then Cedric burns past.", "wide"),
    L("Cedric's sportsmanship masks ruthless pace.", "boost"),
  ],
  "Viktor Krum": [
    L("Wronski Feint! — Krum leaves defenders diving.", "wide"),
    L("Krum's international class on show.", "chance"),
  ],
  "Minerva McGonagall": [
    L("Transfiguration — the ball becomes a moth briefly.", "chaos"),
    L("Strict glare — McGonagall's opponent hesitates.", "disrupt"),
  ],
  "Remus Lupin": [
    L("Full moon approaching — edgy press from Lupin.", "chaos"),
    L("Defensive professor's reading from Lupin.", "boost"),
  ],
  "Sirius Black": [
    L("Padfoot pace burst from Sirius.", "wide"),
    L("Azkaban street-fight tackle from Sirius.", "yellow"),
  ],
  Dobby: [
    L("Master gave Dobby a sock! — freed run from Dobby.", "wide"),
    L("Dobby's iron fist — surprisingly fierce.", "boost"),
  ],
  "Sybill Trelawney": [
    L("Prophecy of a goal... eventually, says Trelawney.", "chaos"),
    L("Crystal ball distraction on the touchline.", "disrupt"),
  ],
  "Crabbe & Goyle": [
    L("Combined lump tackle from Crabbe & Goyle.", "yellow"),
    L("Crabbe & Goyle confused which way to run.", "disrupt"),
  ],

  // ── The Simpsons ──
  "Homer Simpson": [
    L("D'oh! — Homer trips over his own feet.", "disrupt"),
    L("Donut break — Homer stops play.", "chaos"),
  ],
  "Bart Simpson": [
    L("Bart skateboards down the wing!", "wide"),
    L("Eat my shorts! — Bart's nutmeg attempt.", "boost"),
  ],
  "Marge Simpson": [
    L("Disapproving hum — Marge makes the team behave.", "momentum_up"),
    L("Hidden steel — Marge wins the header.", "boost"),
  ],
  "Lisa Simpson": [
    L("Sax solo on the touchline — Lisa shifts the tempo.", "momentum_up"),
    L("Smart pass with environmental impact report attached.", "boost"),
  ],
  "Ned Flanders": [
    L("Okilly dokilly — Ned's sportsmanship overload.", "chaos"),
    L("Bible verse calm under press from Ned.", "boost"),
  ],
  "Mr. Burns": [
    L("Release the hounds! — Burns interrupts play.", "chaos"),
    L("Excellent... — Burns's offside trap somehow works.", "disrupt"),
  ],
  "Waylon Smithers": [
    L("Burnsian loyalty block from Smithers.", "boost"),
    L("Secret dance routine — defender lost.", "wide"),
  ],
  "Moe Szyslak": [
    L("Bar rag wipe — Moe's keeper style.", "gk_moment"),
    L("I'm a whale! — Moe's hopeless lunge.", "chaos"),
  ],
  "Barney Gumble": [
    L("Burp wave — the ball wobbles off Barney.", "chaos"),
    L("Belly block — Barney's accidental save.", "gk_moment"),
  ],
  "Apu Nahasapeemapetilon": [
    L("Thank you come again — Apu's rapid counter.", "wide"),
    L("Kwik-E-Mart shift stamina from Apu.", "stamina_opp"),
  ],
  "Chief Clancy Wiggum": [
    L("Chief Wiggum books the wrong person.", "chaos"),
    L("Donut crumb trail — Wiggum slips the defender.", "boost"),
  ],
  "Krusty the Clown": [
    L("Hey hey! — Krusty's showbiz flick.", "boost"),
    L("Pie to the face for the opponent.", "yellow"),
  ],
  "Sideshow Bob": [
    L("High culture step-over from Sideshow Bob.", "boost"),
    L("Rake step — classic trip hazard from Bob.", "chaos"),
  ],
  "Nelson Muntz": [
    L("Ha-ha! — Nelson's brutal shoulder.", "yellow"),
    L("Wedgie distraction off the ball.", "chaos"),
  ],
  "Milhouse Van Houten": [
    L("Everything's coming up Milhouse!", "chance"),
    L("Allergic to grass — Milhouse's sneezing fit.", "disrupt"),
  ],
  "Ralph Wiggum": [
    L("I'm a football! — Ralph chases the wrong object.", "chaos"),
    L("Deep thoughts — Ralph's accidental genius pass.", "boost"),
  ],
  "Comic Book Guy": [
    L("Worst. Pass. Ever. — still works for Comic Book Guy.", "chaos"),
    L("Mint condition tackle — never touched.", "disrupt"),
  ],
  "Groundskeeper Willie": [
    L("Freedom! — Willie's scythe clearance.", "yellow"),
    L("Scottish fury in the box from Willie.", "boost"),
  ],
  "Snake Jailbird": [
    L("Prison break pace from Snake.", "wide"),
    L("Stick 'em up — Snake robs possession.", "boost"),
  ],
  Duffman: [
    L("Oh yeah! — Duffman's belly bounce pass.", "chaos"),
    L("Sponsored celebration — play delayed.", "chaos"),
  ],
  "Otto Mann": [
    L("School bus drift onto the pitch from Otto.", "wide"),
    L("Spicoli energy — Otto's totally wasted press.", "disrupt"),
  ],
  "Professor Frink": [
    L("Glavin! — Frink's science shot.", "chance"),
    L("Hover Frink — offside by inches.", "chaos"),
  ],

  // ── Futurama ──
  "Bender Bending Rodriguez": [
    L("Bite my shiny metal— tackle from Bender.", "yellow"),
    L("Blackjack and hookers break on the touchline.", "chaos"),
  ],
  "Philip J. Fry": [
    L("Not sure if football... — Fry's wrong-sport legend moment.", "chaos"),
    L("Luck of Fry — the ball finds him.", "boost"),
  ],
  "Turanga Leela": [
    L("Cyclops sniper pass from Leela.", "boost"),
    L("Captain's charge from Leela.", "momentum_up"),
  ],
  "Professor Hubert Farnsworth": [
    L("Good news everyone! — Farnsworth's experimental tactic.", "chaos"),
    L("Senile wander — Farnsworth's offside trap fails.", "disrupt"),
  ],
  "Dr. John Zoidberg": [
    L("Whoop whoop — Zoidberg's scuttle dribble.", "wide"),
    L("Poor sad sack — Zoidberg's accidental block.", "gk_moment"),
  ],
  "Hermes Conrad": [
    L("Bureaucratic filing of the opponent by Hermes.", "disrupt"),
    L("Limbo! — absurd flexibility from Hermes.", "boost"),
  ],
  "Amy Wong": [
    L("Clumsy rich kid trap from Amy.", "chaos"),
    L("Martian sweatshop work rate from Amy.", "stamina_opp"),
  ],
  Nibbler: [
    L("Dark matter dump — Nibbler's speed burst.", "wide"),
    L("Cute then cosmic horror from Nibbler.", "chaos"),
  ],
  Lrrr: [
    L("I am Lrrr! — demands the ball.", "momentum_up"),
    L("Omicronian stomp from Lrrr.", "yellow"),
  ],
  Morbo: [
    L("Morbo will crush puny ball!", "boost"),
    L("WINDMILLS DO NOT WORK THAT WAY!", "chaos"),
  ],
  "Robot Devil": [
    L("Your soul for that chance — Robot Devil deals.", "chaos"),
    L("Unnecessarily evil foul from the Robot Devil.", "yellow"),
  ],
  Calculon: [
    L("Dramatic monologue before Calculon's shot.", "chaos"),
    L("Oscar-worthy dive from Calculon.", "yellow"),
  ],
  "Kif Kroker": [
    L("Sigh — Kif's passive aggressive pass.", "boost"),
    L("Zapp's victim — Kif spills coffee on the pitch.", "chaos"),
  ],
  "Zapp Brannigan": [
    L("Sexlexia formation from Zapp.", "disrupt"),
    L("Velour uniform distraction.", "chaos"),
  ],
  "Carol Miller (Mom)": [
    L("Mother knows best — robotic press from Mom.", "boost"),
    L("Pop and lock discipline foul.", "yellow"),
  ],
  "Scruffy the Janitor": [
    L("Scruffy's on break. — then he appears.", "boost"),
    L("Mop bucket slide tackle from Scruffy.", "chaos"),
  ],
  Hypnotoad: [
    L("ALL GLORY TO THE HYPNOTOAD.", "disrupt"),
    L("Ribbit — everyone stops.", "chaos"),
  ],
  "Richard Nixon's Head": [
    L("Aroo! — crookery in midfield from Nixon.", "chaos"),
    L("Watergate hold — subtle shirt pull.", "yellow"),
  ],
  Donbot: [
    L("Mob calculation — efficient foul from Donbot.", "yellow"),
    L("Cement shoes metaphor tackle.", "boost"),
  ],
  Fleming: [
    L("James Bond parody run from Fleming.", "wide"),
    L("Martini spill — slick surface.", "chaos"),
  ],
  "Cubert Farnsworth": [
    L("Smarter than grandpa — Cubert's wrong anyway.", "disrupt"),
    L("Puberty whine — tempo killed.", "chaos"),
  ],
  "Dr. Zoidberg (Claw Keeper)": [
    L("Claw save! — Zoidberg between the sticks.", "gk_moment"),
    L("Medical malpractice punch clear.", "yellow"),
  ],

  // ── Family Guy ──
  "Peter Griffin": [
    L("Bird is the word — Peter's dance break.", "chaos"),
    L("Freakin' sweet belly flop from Peter.", "yellow"),
  ],
  "Stewie Griffin": [
    L("Victory shall be mine! — Stewie's laser sight on goal.", "chance"),
    L("Stewie's diaper dash through midfield.", "wide"),
  ],
  "Brian Griffin": [
    L("Pretentious novelist touch from Brian.", "boost"),
    L("Dog chase instinct — Brian loses the ball.", "disrupt"),
  ],
  "Lois Griffin": [
    L("Mom rage tackle from Lois.", "yellow"),
    L("Piano lesson discipline — Lois restores team shape.", "boost"),
  ],
  "Chris Griffin": [
    L("Giant baby stumble from Chris.", "chaos"),
    L("Buttermilk keyword — random power from Chris.", "boost"),
  ],
  "Meg Griffin": [
    L("Shut up Meg — ignored, then Meg's open.", "boost"),
    L("Self-esteem surge — shock run from Meg.", "wide"),
  ],
  "Glenn Quagmire": [
    L("Giggity — Quagmire's off-ball creepiness.", "chaos"),
    L("Helicopter spin celebration too early.", "chaos"),
  ],
  "Joe Swanson": [
    L("Leg day — iron tackle from Joe.", "boost"),
    L("Police chase intensity from Joe.", "momentum_up"),
  ],
  "Cleveland Brown": [
    L("Tub accident flashback — Cleveland slips.", "disrupt"),
    L("Quahog deli calm finish from Cleveland.", "boost"),
  ],
  "Carter Pewterschmidt": [
    L("Billionaire bribe ref attempt from Carter.", "chaos"),
    L("Heart attack fake from Carter.", "chaos"),
  ],
  Consuela: [
    L("No no no... — Consuela refuses to release the ball.", "chaos"),
    L("Lemon pledge slide from Consuela.", "boost"),
  ],
  "Greased-up Deaf Guy": [
    L("Can't catch him! — Greased-up Deaf Guy sprints.", "wide"),
    L("Too slippery to tackle — defenders slide off.", "boost"),
  ],
  "Ernie the Giant Chicken": [
    L("Epic chicken fight off the ball.", "chaos"),
    L("Pecker peck — possession won.", "boost"),
  ],
  "Tom Tucker": [
    L("Live from the pitch! — Tom Tucker reports.", "chaos"),
    L("Bird pun — the crowd groans.", "momentum_up"),
  ],
  "Mayor Adam West": [
    L("Batman mayor logic from Adam West.", "chaos"),
    L("Adam West name confusion delays kickoff.", "chaos"),
  ],
  Death: [
    L("Touch of death — legal tackle from Death.", "boost"),
    L("Reap what you sow — turnover.", "turnover"),
  ],
  Bruce: [
    L("Oh honey honey — Bruce distracts.", "chaos"),
    L("Camp run — defender embarrassed.", "wide"),
  ],
  "Mort Goldman": [
    L("Hypochondriac timeout from Mort.", "chaos"),
    L("Pharmacy stamina boost for Mort.", "stamina_opp"),
  ],
  "Seamus Levine": [
    L("Everything's on fire! — Seamus keeps playing.", "boost"),
    L("Peg leg cannon shot from Seamus.", "chance"),
  ],
  "Evil Monkey": [
    L("Points from the closet — psychological warfare.", "disrupt"),
    L("Chris's monkey business on the wing.", "chaos"),
  ],
  "Herbert the Pervert": [
    L("Uh-oh — inappropriate slide from Herbert.", "yellow"),
    L("Walker pace deception from Herbert.", "wide"),
  ],
  "Jasper T. Jaspers": [
    L("Old gay army bit — vintage press from Jasper.", "boost"),
    L("Hip replacement delay.", "chaos"),
  ],

  // ── Famous Retards ──
  "Forrest Gump": [
    L("Run Forrest run! — pace down the channel.", "wide"),
    L("Life is like a through ball — Forrest delivers.", "boost"),
  ],
  "Lennie Small": [
    L("Tell me about the rabbits — Lennie's distraction.", "disrupt"),
    L("Soft thing grip — Lennie won't let the ball go.", "chaos"),
  ],
  "Karl Childers": [
    L("Mmhmm — Karl's throat-slash metaphor tackle.", "yellow"),
    L("Biscuits discipline — Karl's slow build.", "boost"),
  ],
  "Raymond Babbitt (Rain Man)": [
    L("Definitely definitely — Raymond's count-pass rhythm.", "boost"),
    L("Vegas meltdown — chaos from Raymond.", "chaos"),
  ],
  "Simple Jack": [
    L("You never go full retard — wrong tactic works for Simple Jack.", "boost"),
    L("Thumbs up forever from Simple Jack.", "chaos"),
  ],
  "Brick Tamland": [
    L("I love lamp — Brick carries a lamp on the pitch.", "chaos"),
    L("Brick yells a random city name.", "chaos"),
  ],
  "Napoleon Dynamite": [
    L("Vote for Pedro dance from Napoleon.", "momentum_up"),
    L("Liger roar — intimidation from Napoleon.", "disrupt"),
  ],
  "Lloyd Christmas": [
    L("So you're telling me there's a chance!", "chance"),
    L("Most annoying sound in the world from Lloyd.", "disrupt"),
  ],
  "Harry Dunne": [
    L("Dumb and dumber tandem run from Harry.", "wide"),
    L("Pet store bird on Harry's shoulder.", "chaos"),
  ],
  "Johnny Knoxville": [
    L("Jackass stunt tackle from Knoxville.", "yellow"),
    L("Cup check foul from Knoxville.", "yellow"),
  ],
  "Andy Stitzer": [
    L("Action figure collection huddle from Andy.", "chaos"),
    L("Wax off — unexpected skill from Andy.", "boost"),
  ],
  "Borat Sagdiyev": [
    L("Very nice! Great success! — Borat celebrates early.", "boost"),
    L("Kazakhstan national anthem confusion.", "chaos"),
  ],
  "Mr. Bean": [
    L("Mr. Bean's knee save from nowhere.", "gk_moment"),
    L("Teddy in goal consultation.", "chaos"),
  ],
  "Derek Zoolander": [
    L("Blue steel — Zoolander freezes the defender.", "disrupt"),
    L("Magnum — Zoolander can't turn left.", "disrupt"),
  ],
  Gilligan: [
    L("Skipper! — Gilligan's botched escape plan.", "chaos"),
    L("Island coconut ball from Gilligan.", "chaos"),
  ],
  "Johnny Bravo": [
    L("Hey mama — Johnny's flex off.", "chaos"),
    L("Hair gel slip hazard from Johnny.", "chaos"),
  ],
  "Patrick Star": [
    L("Is mayonnaise an instrument? — Patrick wonders.", "chaos"),
    L("Rock under box — Patrick hides from the ball.", "disrupt"),
  ],
  "Ed (Ed, Edd n Eddy)": [
    L("Jawbreaker fuel sprint from Ed.", "wide"),
    L("Scam play — ref bamboozled by Ed.", "chaos"),
  ],
  Mongo: [
    L("Mongo punch horse energy — Mongo charges.", "yellow"),
    L("Only pawn in game of life — Mongo wanders.", "chaos"),
  ],
  "Tommy Callahan": [
    L("Fat guy in a little coat run from Tommy.", "wide"),
    L("Salesman pitch to the ref from Tommy.", "chaos"),
  ],
  "Ace Ventura": [
    L("Laces out! — Ace's placement.", "chance"),
    L("Pet detective sniffs out the pass.", "boost"),
  ],
  "Cosmo Kramer": [
    L("Kramer entrance — sliding through the door.", "wide"),
    L("Mocha Joe sabotage from Kramer.", "chaos"),
  ],

  // ── World Leaders ──
  "Winston Churchill": [
    L("We shall never surrender — Churchill's last-ditch block.", "boost"),
    L("Finest hour speech — tempo rises.", "momentum_up"),
  ],
  "Napoleon Bonaparte": [
    L("Hand in jacket — Napoleon's tactical masterstroke.", "boost"),
    L("Waterloo flashback — Napoleon overcommits.", "disrupt"),
  ],
  "Julius Caesar": [
    L("Et tu — Caesar's betrayal pass to the wrong player.", "chaos"),
    L("Alea iacta est — all-out attack from Caesar.", "momentum_up"),
  ],
  Cleopatra: [
    L("Charm offensive — Cleopatra, ref lenient.", "chaos"),
    L("Asp bite drama on the touchline.", "yellow"),
  ],
  "Genghis Khan": [
    L("Mongol horde counter from Genghis Khan.", "wide"),
    L("Pillage press from the Khan.", "yellow"),
  ],
  "Alexander the Great": [
    L("Alexander conquers the flank.", "wide"),
    L("Alexander weeps — no more worlds to dribble.", "chaos"),
  ],
  "Queen Elizabeth I": [
    L("Virgin queen regal pivot from Elizabeth.", "boost"),
    L("Armada spirit — long range from the Queen.", "chance"),
  ],
  "Abraham Lincoln": [
    L("Emancipation through ball from Lincoln.", "boost"),
    L("Theatre box distraction.", "chaos"),
  ],
  "Mahatma Gandhi": [
    L("Non-violent resistance — Gandhi refuses to foul.", "chaos"),
    L("Salt march stamina from Gandhi.", "stamina_opp"),
  ],
  "Adolf Hitler": [
    L("Bunker rant — Hitler's meltdown.", "disrupt"),
    L("Questionable tactic — the crowd boos.", "momentum_down"),
  ],
  "Joseph Stalin": [
    L("Gulag press — no escape from Stalin.", "disrupt"),
    L("Purge — teammate sacrificed.", "chaos"),
  ],
  "Mao Zedong": [
    L("Cultural revolution chaos from Mao.", "chaos"),
    L("Little red book set piece.", "set_piece"),
  ],
  "Franklin D. Roosevelt": [
    L("Nothing to fear — FDR's comeback spirit.", "momentum_up"),
    L("Fireside chat — slows the game.", "chaos"),
  ],
  "John F. Kennedy": [
    L("Ask not — JFK's header attempt.", "chance"),
    L("Dallas motorcade pace from JFK.", "wide"),
  ],
  "Margaret Thatcher": [
    L("Handbag swing from Thatcher.", "yellow"),
    L("Iron lady won't turn.", "boost"),
  ],
  "Vladimir Putin": [
    L("Shirtless horse riding aura from Putin.", "momentum_up"),
    L("Poison pass — subtle from Putin.", "disrupt"),
  ],
  "Donald Trump": [
    L("Tremendous shot — believe me.", "chance"),
    L("Executive order — ref confused.", "chaos"),
  ],
  "Barack Obama": [
    L("Yes we can — Obama's patient build-up.", "boost"),
    L("Mic drop celebration pending.", "chaos"),
  ],
  "Angela Merkel": [
    L("Pragmatic sideways pass from Merkel.", "boost"),
    L("EU summit hold — slow play.", "chaos"),
  ],
  "Kim Jong-un": [
    L("Dear leader applause — 110th minute energy.", "chaos"),
    L("Nuclear option long shot from Kim.", "chance"),
  ],
  "Emmanuel Macron": [
    L("Baguette diplomacy from Macron.", "chaos"),
    L("Yellow vest protest on the pitch.", "chaos"),
  ],
  "Boris Johnson": [
    L("Zip line stuck — Boris kills momentum.", "chaos"),
    L("Bus lie metaphor — wrong direction run.", "disrupt"),
  ],

  // ── Fighting Legends ──
  "Muhammad Ali": [
    L("Float like a butterfly — Ali stings with the pass.", "boost"),
    L("Rope-a-dope — Ali absorbs the press.", "stamina_opp"),
  ],
  "Mike Tyson": [
    L("Tyson bites the ear — even the ball isn't safe.", "yellow"),
    L("Iron Mike body blow foul.", "yellow"),
  ],
  "Bruce Lee": [
    L("Be water — Lee's untouchable dribble.", "wide"),
    L("One-inch punch clearance from Bruce Lee.", "boost"),
  ],
  "Rocky Balboa": [
    L("Adrian! — Rocky finds mountain stamina.", "stamina_opp"),
    L("Meat house training — power shot from Rocky.", "chance"),
  ],
  "Ronda Rousey": [
    L("Armbar attempt on the marker from Rousey.", "yellow"),
    L("Judo throw — turnover from Rousey.", "turnover"),
  ],
  "Conor McGregor": [
    L("Mystic Mac prediction — McGregor scores.", "chance"),
    L("Bus throw energy from McGregor.", "yellow"),
  ],
  "Anderson Silva": [
    L("Matrix dodge — Silva baits the offside trap.", "boost"),
    L("Front kick — keeper stunned.", "gk_moment"),
  ],
  "Fedor Emelianenko": [
    L("Expressionless destruction from Fedor.", "boost"),
    L("Ring of red pressure from Fedor.", "disrupt"),
  ],
  "Jon Jones": [
    L("Eye poke — Jones gets away with it.", "chaos"),
    L("Cocaine chicken celebration from Jones.", "chaos"),
  ],
  "Georges St-Pierre": [
    L("Superhuman distance control from GSP.", "boost"),
    L("Canadian politeness foul.", "yellow"),
  ],
  "Khabib Nurmagomedov": [
    L("Smesh — Khabib smothers the tackle.", "disrupt"),
    L("Dagestani chain wrestling press.", "disrupt"),
  ],
  "Ip Man": [
    L("Wing Chun rapid touches from Ip Man.", "boost"),
    L("Wooden dummy training — reflex save.", "gk_moment"),
  ],
  "Chuck Norris": [
    L("Roundhouse — goal from midfield, Chuck Norris style.", "chance"),
    L("Facts say Chuck Norris scored twice.", "chaos"),
  ],
  "Jean-Claude Van Damme": [
    L("Split dodge between defenders from Van Damme.", "wide"),
    L("Epic split — groin pull risk.", "stamina_self"),
  ],
  "Manny Pacquiao": [
    L("Pac-man multi-angle shot from Pacquiao.", "chance"),
    L("Congressman pace down the wing.", "wide"),
  ],
  "Tyson Fury": [
    L("Gypsy king get-up — Fury never stays down.", "momentum_up"),
    L("Singing walkout — play delayed.", "chaos"),
  ],
  "Canelo Alvarez": [
    L("Body shot specialist — Canelo digs in.", "boost"),
    L("Red hair dye trail on the turf.", "chaos"),
  ],
  "Hulk Hogan": [
    L("Brother! — Hogan's leg drop foul.", "yellow"),
    L("Hulk up — Hogan's second wind.", "stamina_opp"),
    L("Leg drop! — Hogan clears the area.", "yellow"),
    L("Hulkamania running wild on the wing!", "momentum_up"),
  ],
  "Dwayne 'The Rock' Johnson": [
    L("Can you smell what— tackle from The Rock.", "yellow"),
    L("People's eyebrow — defender freezes.", "disrupt"),
  ],
  "John Cena": [
    L("You can't see me — Cena's invisible run.", "wide"),
    L("Five moves of doom from Cena.", "boost"),
  ],
  Ryu: [
    L("Hadouken! — 35-yard screamer from Ryu.", "chance"),
    L("Shoryuken — Ryu lifts the defender.", "yellow"),
  ],
  "Sub-Zero": [
    L("Ice slide tackle from Sub-Zero.", "yellow"),
    L("Fatality — ref plays on.", "chaos"),
  ],

  // ── Star Wars ──
  "Luke Skywalker": [
    L("Trust your feelings — Luke curls into the top corner.", "chance"),
    L("Father... — Luke hesitates.", "disrupt"),
  ],
  "Darth Vader": [
    L("I find your lack of faith disturbing.", "disrupt"),
    L("Vader's breathing intimidates the press.", "momentum_up"),
  ],
  "Han Solo": [
    L("Never tell me the odds! — Han charges.", "boost"),
    L("Han shoots first.", "boost"),
  ],
  Chewbacca: [
    L("Rawr — Chewbacca's riposte tackle.", "yellow"),
    L("Co-pilot scream — tempo rises.", "momentum_up"),
  ],
  Yoda: [
    L("Do or do not — Yoda's wisdom pass.", "boost"),
    L("900 years of offsides knowledge from Yoda.", "chaos"),
  ],
  "Obi-Wan Kenobi": [
    L("Hello there — Obi-Wan's surprise tackle.", "boost"),
    L("High ground — unstoppable cross from Obi-Wan.", "wide"),
  ],
  "Emperor Palpatine": [
    L("Unlimited power! — Palpatine unleashes.", "chaos"),
    L("Deceptive old man flop from Palpatine.", "yellow"),
  ],
  "Anakin Skywalker": [
    L("Sand hatred — Anakin overhits the pass.", "disrupt"),
    L("Podracer pace from Anakin.", "wide"),
  ],
  "Mace Windu": [
    L("Purple lightsaber — illegal kit from Mace.", "chaos"),
    L("This party's over — Mace ends the move.", "boost"),
  ],
  "Princess Leia": [
    L("Choke — Leia's metaphorical press.", "disrupt"),
    L("Bun buns header from Leia.", "chance"),
  ],
  "R2-D2": [
    L("Beep boop — R2's nutmeg protocol.", "boost"),
    L("Oil slick — defender slips.", "chaos"),
  ],
  "C-3PO": [
    L("We're doomed! — C-3PO's panic backpass.", "disrupt"),
    L("Protocol panic — offside flag.", "chaos"),
  ],
  "Boba Fett": [
    L("No disintegrations — Boba Fett's controlled foul.", "yellow"),
    L("Jetpack chase from Boba Fett.", "wide"),
  ],
  "Darth Maul": [
    L("Double kick rabona from Darth Maul.", "chance"),
    L("Silent rage sprint from Maul.", "wide"),
  ],
  "General Grievous": [
    L("Cough cough — Grievous's four-arm clearance.", "boost"),
    L("Collection of kits from Grievous.", "chaos"),
  ],
  "Qui-Gon Jinn": [
    L("Living force flow from Qui-Gon.", "boost"),
    L("Phantom menace gamble from Qui-Gon.", "chance"),
  ],
  "Padmé Amidala": [
    L("Diplomatic immunity claim from Padmé.", "chaos"),
    L("Arena battle flashback — Padmé presses.", "boost"),
  ],
  "Lando Calrissian": [
    L("Calrissian shuffle — smooth.", "boost"),
    L("Cloud City betrayal pass?", "chaos"),
  ],
  Rey: [
    L("Nobody — Rey's scavenger grit.", "boost"),
    L("Force download — instant skill from Rey.", "boost"),
  ],
  "Kylo Ren": [
    L("Tantrum — Kylo kicks the touchline equipment.", "chaos"),
    L("Crossguard block from Kylo.", "boost"),
  ],
  "Clone Trooper": [
    L("Roger roger — synchronized press.", "boost"),
    L("Order 66 — switches sides?!", "chaos"),
  ],
  "Jar Jar Binks": [
    L("Mesa cause total chaos!", "chaos"),
    L("Booma ball — random bounce from Jar Jar.", "chaos"),
  ],

  // ── Marvel ──
  "Captain America": [
    L("Avengers assemble! — Cap rallies the team.", "momentum_up"),
    L("Shield ricochet pass from Cap.", "boost"),
  ],
  "Iron Man": [
    L("JARVIS calculated finish from Iron Man.", "chance"),
    L("Suit malfunction — Stark falls from the sky.", "chaos"),
  ],
  Thor: [
    L("Another! — Thor's hammer volley.", "chance"),
    L("God of thunder — storm delay.", "chaos"),
  ],
  Hulk: [
    L("SMASH — Hulk earns a yellow card.", "yellow"),
    L("Hulk's rage clears the entire defense.", "boost"),
  ],
  "Black Widow": [
    L("Widow's bite — leg hook from Natasha.", "yellow"),
    L("Spy seduction misdirection.", "disrupt"),
  ],
  "Spider-Man": [
    L("Thwip — web line cross from Spider-Man.", "wide"),
    L("Great power — great responsibility pass.", "boost"),
  ],
  Wolverine: [
    L("Berserker barrage from Wolverine.", "yellow"),
    L("Adamantium claws — kit violation.", "chaos"),
  ],
  "Doctor Strange": [
    L("14 million outcomes — Strange picks the pass.", "boost"),
    L("Time stone rewind — offside erased?", "chaos"),
  ],
  "Black Panther": [
    L("Wakanda forever! — T'Challa inspires.", "momentum_up"),
    L("Vibranium tackle from Black Panther.", "boost"),
  ],
  "Captain Marvel": [
    L("Photon blast — keeper blinded.", "gk_moment"),
    L("Binary mode — unstoppable from Carol.", "boost"),
  ],
  Hawkeye: [
    L("Trick arrow — absurd curve from Hawkeye.", "chance"),
    L("Ronin blade — dark phase.", "yellow"),
  ],
  "Ant-Man": [
    L("Go subatomic — the ball vanishes.", "chaos"),
    L("Giant-Man clearance from Ant-Man.", "boost"),
  ],
  Deadpool: [
    L("Fourth wall — Deadpool argues with the commentator.", "chaos"),
    L("Maximum effort dive from Deadpool.", "yellow"),
  ],
  Loki: [
    L("Illusion — which Loki has the ball?", "disrupt"),
    L("Glorious purpose flop from Loki.", "yellow"),
  ],
  Thanos: [
    L("Snap — score erased?!", "chaos"),
    L("The Mad Titan bullies through midfield.", "boost"),
  ],
  Vision: [
    L("Vision phases through the press.", "boost"),
    L("Mind stone calculation.", "boost"),
  ],
  Falcon: [
    L("Redwing recon — perfect cross from Falcon.", "wide"),
    L("On your left! — Falcon flies past.", "wide"),
  ],
  "Scarlet Witch": [
    L("Reality warps — goalmouth chaos from Wanda.", "chaos"),
    L("No more mutants — defensive wipe.", "disrupt"),
  ],
  Daredevil: [
    L("Radar sense — blind pass from Daredevil.", "boost"),
    L("Catholic guilt — Daredevil hesitates.", "disrupt"),
  ],
  Punisher: [
    L("Lethal clearance from Punisher.", "yellow"),
    L("Skull vest intimidation.", "disrupt"),
  ],
  Groot: [
    L("I am Groot — tactical.", "boost"),
    L("Branch tangle foul from Groot.", "yellow"),
  ],
  "Rocket Raccoon": [
    L("Ain't no thing like me — Rocket fires.", "boost"),
    L("Explosive miscalculation from Rocket.", "chaos"),
  ],

  // ── DC ──
  Batman: [
    L("I'm Batman — shadow tackle from the Dark Knight.", "boost"),
    L("Prep time — Batman reads everything.", "disrupt"),
  ],
  Superman: [
    L("Heat vision — ref issues a warning.", "chaos"),
    L("Man of Steel header — unstoppable.", "chance"),
  ],
  "Wonder Woman": [
    L("Lasso of truth — opponent confesses the foul.", "yellow"),
    L("Amazonian war cry from Wonder Woman.", "momentum_up"),
  ],
  "The Flash": [
    L("Speed force — offside from own half.", "wide"),
    L("Lightning trail — slippery pitch.", "chaos"),
  ],
  Aquaman: [
    L("Talks to fish — offside trap intel.", "boost"),
    L("Trident poke from Aquaman.", "yellow"),
  ],
  "Green Lantern": [
    L("Construct catapult shot from Green Lantern.", "chance"),
    L("Willpower fail — the ball fades.", "disrupt"),
  ],
  "The Joker": [
    L("Why so serious? — chaos pass from Joker.", "chaos"),
    L("Pencil trick — ball disappears.", "chaos"),
  ],
  "Harley Quinn": [
    L("Baseball bat swing from Harley.", "yellow"),
    L("Mallet clearance from Harley.", "boost"),
  ],
  "Lex Luthor": [
    L("Billionaire buys ref? — Luthor schemes.", "chaos"),
    L("Kryptonite in the ball from Luthor.", "chaos"),
  ],
  Catwoman: [
    L("Purr-fect theft of the ball from Catwoman.", "boost"),
    L("Whip crack foul.", "yellow"),
  ],
  Cyborg: [
    L("Boom tube teleport run from Cyborg.", "wide"),
    L("Mother box analysis.", "boost"),
  ],
  Nightwing: [
    L("Acrobat flair from Nightwing.", "wide"),
    L("Better than Batman — ego pass.", "boost"),
  ],
  Robin: [
    L("Holy statline — sidekick run from Robin.", "wide"),
    L("Batman said no — Robin does it anyway.", "chaos"),
  ],
  Bane: [
    L("Break the back — brutal foul from Bane.", "yellow"),
    L("Venom surge from Bane.", "stamina_opp"),
  ],
  Doomsday: [
    L("Death of football — Doomsday rampages.", "yellow"),
    L("Doomsday cannot be stopped.", "boost"),
  ],
  Darkseid: [
    L("Omega beams — keeper vaporized.", "gk_moment"),
    L("Anti-life equation — team stops trying.", "disrupt"),
  ],
  Shazam: [
    L("SHAZAM! — lightning strike shot.", "chance"),
    L("Kid in adult body — immature dive.", "yellow"),
  ],
  "Green Arrow": [
    L("Trick arrow through the ball.", "chance"),
    L("Justice League snark from Oliver.", "chaos"),
  ],
  "Poison Ivy": [
    L("Pheromone distraction from Ivy.", "disrupt"),
    L("Vine trip foul.", "yellow"),
  ],
  "The Riddler": [
    L("Riddle before the free kick.", "set_piece"),
    L("Green question mark run.", "chaos"),
  ],
  "Two-Face": [
    L("Coin flip — shoot or pass?", "chaos"),
    L("Scarred menace from Two-Face.", "boost"),
  ],
  "Alfred Pennyworth": [
    L("Very good sir — perfect tea stop.", "chaos"),
    L("Butler save — dignified from Alfred.", "gk_moment"),
  ],

  // ── Sony ──
  Kratos: [
    L("BOY! — Kratos war cry charge.", "momentum_up"),
    L("Blades of chaos slash clearance.", "yellow"),
  ],
  Atreus: [
    L("Father watch! — Atreus arrow assist.", "boost"),
    L("L2 + R2 skill move from Atreus.", "boost"),
  ],
  "Nathan Drake": [
    L("It's behind you! — Drake's climbing escape.", "wide"),
    L("Fortune's favor — lucky deflection.", "chaos"),
  ],
  Ellie: [
    L("Look for the light — Ellie's through ball.", "boost"),
    L("Clicker scream — chaos.", "chaos"),
  ],
  Joel: [
    L("Dad mode — Joel's ruthless tackle.", "yellow"),
    L("Brick — Joel throws a brick.", "yellow"),
  ],
  Aloy: [
    L("Focus scan — weakness found by Aloy.", "boost"),
    L("Ropecaster pull from Aloy.", "boost"),
  ],
  "Jin Sakai": [
    L("Ghost stance — wind whispers.", "disrupt"),
    L("Iai strike — instant shot from Jin.", "chance"),
  ],
  Ratchet: [
    L("Wrench throw from Ratchet.", "chaos"),
    L("Raritanium upgrade sprint.", "wide"),
  ],
  Clank: [
    L("Helpack thruster — aerial duel from Clank.", "boost"),
    L("Lombax support calculations.", "boost"),
  ],
  Spyro: [
    L("Flame breath — ref warning for Spyro.", "chaos"),
    L("Charge ram from Spyro.", "yellow"),
  ],
  "Crash Bandicoot": [
    L("Wumpa bounce — spin attack from Crash.", "wide"),
    L("TNT crate mishap.", "chaos"),
  ],
  Sackboy: [
    L("Popit stitched through ball from Sackboy.", "boost"),
    L("Level editor — illegal pitch shape.", "chaos"),
  ],
  "Cole MacGrath": [
    L("Karmic lightning bolt from Cole.", "chance"),
    L("Good or evil — unpredictable foul.", "chaos"),
  ],
  Wander: [
    L("Colossus climb — slow then lethal from Wander.", "boost"),
    L("Horse Agro gallop.", "wide"),
  ],
  "Sir Daniel Fortesque": [
    L("One eye — depth perception fail.", "disrupt"),
    L("Hero of Gallowmere — accidental legend.", "boost"),
  ],
  "Sweet Tooth": [
    L("Ice cream truck rampage.", "wide"),
    L("Flaming head intimidation.", "disrupt"),
  ],
  "Abby Anderson": [
    L("Golf club flashback from Abby.", "yellow"),
    L("Seattle day — relentless press.", "boost"),
  ],
  "Deacon St. John": [
    L("Freaker horde chase onto the pitch.", "chaos"),
    L("Bike jump cross from Deacon.", "wide"),
  ],
  "Astro Bot": [
    L("DualSense haptic nutmeg from Astro.", "boost"),
    L("Sony IP cameo distraction.", "chaos"),
  ],
  "Delsin Rowe": [
    L("Neon smoke trail from Delsin.", "wide"),
    L("Concrete armor — immovable.", "boost"),
  ],
  "Parappa the Rapper": [
    L("Kick punch it's all in the mind!", "boost"),
    L("Rap battle — play stops.", "chaos"),
  ],
  "Sam Bridges": [
    L("BB cries — morale drops.", "disrupt"),
    L("Strand connection — perfect link.", "boost"),
  ],

  // ── Nintendo ──
  Mario: [
    L("Let's-a-go! — Mario's classic jump header.", "chance"),
    L("Wrong castle — Mario offside.", "chaos"),
  ],
  Luigi: [
    L("Luigi time! — nervous brilliance.", "chance"),
    L("Scaredy sprint from Luigi.", "wide"),
  ],
  Link: [
    L("Hyah! — Link's sword foot slide.", "boost"),
    L("Triforce wisdom pass.", "boost"),
  ],
  "Princess Zelda": [
    L("Sheik disguise — surprise pace.", "wide"),
    L("Royal decree — time waste.", "chaos"),
  ],
  "Samus Aran": [
    L("Morph ball — under the defender.", "wide"),
    L("Charge beam — keeper cooked.", "chance"),
  ],
  Kirby: [
    L("Inhale — Kirby steals the move.", "boost"),
    L("Copy ability — random skill.", "chaos"),
  ],
  "Donkey Kong": [
    L("Barrel roll throw from DK.", "chaos"),
    L("Ground pound — seismic foul.", "yellow"),
  ],
  Bowser: [
    L("Shell spin — fire breath from Bowser.", "boost"),
    L("Princess kidnap metaphor hold.", "yellow"),
  ],
  "Princess Peach": [
    L("Float jump — hangs forever.", "chaos"),
    L("Toad rescue — quick counter.", "wide"),
  ],
  Yoshi: [
    L("Flutter jump — eternal hang time.", "wide"),
    L("Egg lay — pitch hazard.", "chaos"),
  ],
  "Fox McCloud": [
    L("Do a barrel roll! — Fox flies.", "wide"),
    L("Falco laser — offside tech.", "chaos"),
  ],
  "Captain Falcon": [
    L("FALCON PUNCH! — shoulder charge.", "yellow"),
    L("Show me your moves! — Falcon dances.", "chaos"),
  ],
  Pikachu: [
    L("Pika pika — quick feet from Pikachu.", "wide"),
    L("Thunderbolt — metal goal frame sparks.", "chaos"),
  ],
  Ness: [
    L("PK Fire — box trap from Ness.", "disrupt"),
    L("SMASH! — overhead clearance.", "boost"),
  ],
  Ganondorf: [
    L("Triforce of power stomp.", "yellow"),
    L("Gerudo king menace.", "momentum_up"),
  ],
  Wario: [
    L("Wa ha ha! — Wario shoulder barge.", "yellow"),
    L("Garlic breath — area denial.", "chaos"),
  ],
  Waluigi: [
    L("Wah! — lanky cheat from Waluigi.", "yellow"),
    L("Tennis racket — wrong sport.", "chaos"),
  ],
  "Diddy Kong": [
    L("Banana peel — slapstick foul.", "chaos"),
    L("Jetpack peanut popgun sprint.", "wide"),
  ],
  "King K. Rool": [
    L("Crown crush from K. Rool.", "yellow"),
    L("Kremling invasion — numbers up.", "momentum_up"),
  ],
  Inkling: [
    L("Splat zone — pitch repainted.", "chaos"),
    L("Squid roll — untaggable.", "wide"),
  ],
  Ridley: [
    L("Space pirate skewer from Ridley.", "yellow"),
    L("Meta Ridley roar.", "disrupt"),
  ],
  "Meta Knight": [
    L("Galaxia dark dash from Meta Knight.", "wide"),
    L("Masked mystery — ref can't ID for card.", "chaos"),
  ],

  // ── Horror Icons ──
  "Freddy Krueger": [
    L("Welcome to your nightmare — sleep tackle from Freddy.", "disrupt"),
    L("One two — Freddy's claw rake.", "yellow"),
  ],
  "Jason Voorhees": [
    L("Machete clearance from Jason.", "yellow"),
    L("Camp Crystal Lake stare — defenders freeze.", "disrupt"),
  ],
  "Michael Myers": [
    L("The Shape stands — terror pause.", "disrupt"),
    L("Michael walks — unstoppable.", "boost"),
  ],
  Leatherface: [
    L("Chainsaw buzz — play halted.", "chaos"),
    L("Family dinner distraction.", "chaos"),
  ],
  Pinhead: [
    L("Pleasure and pain — Pinhead's puzzle trap.", "disrupt"),
    L("Hellraiser box on the pitch.", "chaos"),
  ],
  Chucky: [
    L("Hi I'm Chucky — swear at the ref.", "yellow"),
    L("Good guy doll sprint.", "wide"),
  ],
  Pennywise: [
    L("You'll float too — keeper slips.", "gk_moment"),
    L("Red balloon — offside line.", "chaos"),
  ],
  Ghostface: [
    L("What's your favorite scary movie?", "chaos"),
    L("Phone call — defense unorganized.", "disrupt"),
  ],
  "Count Dracula": [
    L("Hypnotic stare — missed tackle.", "disrupt"),
    L("Bat swarm — lost ball.", "chaos"),
  ],
  "Frankenstein's Monster": [
    L("Fire bad — panics near flares.", "disrupt"),
    L("It's alive! — lumbering goal.", "chance"),
  ],
  "The Mummy": [
    L("Sandstorm — visibility zero.", "chaos"),
    L("Ancient curse — hamstring.", "stamina_self"),
  ],
  "Hannibal Lecter": [
    L("Fava beans — psychological from Lecter.", "disrupt"),
    L("Rude to play while he's hungry.", "chaos"),
  ],
  "Norman Bates": [
    L("Mother says no — own goal scare.", "gk_moment"),
    L("Shower scene scream — chaos.", "chaos"),
  ],
  Jigsaw: [
    L("Live or die — choice pass from Jigsaw.", "chaos"),
    L("Tape recording delay.", "chaos"),
  ],
  Xenomorph: [
    L("Acid blood — destroys the pitch.", "chaos"),
    L("In the walls — ambush.", "disrupt"),
  ],
  Predator: [
    L("Clicking mandibles — hunt mode.", "disrupt"),
    L("Invisible — offside impossible.", "chaos"),
  ],
  Candyman: [
    L("Say his name five times.", "chaos"),
    L("Hook mirror break.", "chaos"),
  ],
  Beetlejuice: [
    L("Daylight come and me wanna score!", "boost"),
    L("Beetlejuice says his name — chaos tripled.", "chaos"),
  ],
  "The Creeper": [
    L("Eats fear — wins the aerial.", "boost"),
    L("Truck horn — pitch invasion.", "chaos"),
  ],
  "Regan MacNeil": [
    L("Exorcist head spin — unsettles.", "disrupt"),
    L("Pea soup projectile.", "yellow"),
  ],
  "The Thing": [
    L("Is that really their teammate?", "chaos"),
    L("Assimilation — steals skill.", "boost"),
  ],
  Annabelle: [
    L("Doll on bench — everyone scared.", "disrupt"),
    L("Static on radio — comms fail.", "chaos"),
  ],

  // ── Disney Animated ──
  "Mickey Mouse": [
    L("Ha-ha! — whistle conduct from Mickey.", "chaos"),
    L("Sorcerer's apprentice — broom flood.", "chaos"),
  ],
  "Donald Duck": [
    L("Incomprehensible rage foul from Donald.", "yellow"),
    L("Sailor suit dive.", "yellow"),
  ],
  Goofy: [
    L("Gawrsh — klutz nutmeg from Goofy.", "boost"),
    L("Goofy holler — accidental brilliance.", "boost"),
  ],
  "Peter Pan": [
    L("Never grow up — flies offside line.", "wide"),
    L("Pixie dust sprint.", "wide"),
  ],
  "Captain Hook": [
    L("Tick tock — croc panic from Hook.", "disrupt"),
    L("Hook hand — handball?", "chaos"),
  ],
  Simba: [
    L("Remember who you are — Simba roars.", "momentum_up"),
    L("Hakuna matata — lazy pass.", "disrupt"),
  ],
  Scar: [
    L("Long live the king — cynical foul.", "yellow"),
    L("Be prepared — offside trap.", "disrupt"),
  ],
  Mulan: [
    L("Man bun disguise — surprise pace.", "wide"),
    L("Honor before kickoff.", "momentum_up"),
  ],
  Ariel: [
    L("Under the sea — slippery surface.", "chaos"),
    L("Part of your world — long ball.", "boost"),
  ],
  Ursula: [
    L("Poor unfortunate souls contract.", "chaos"),
    L("Tentacle grab foul.", "yellow"),
  ],
  Beast: [
    L("Tale as old as time — power header.", "chance"),
    L("Rose petal fall — time running out.", "momentum_up"),
  ],
  Gaston: [
    L("No one fights like Gaston!", "yellow"),
    L("Antler decoration — illegal kit.", "chaos"),
  ],
  Aladdin: [
    L("Magic carpet cross.", "wide"),
    L("Diamond in the rough — lucky bounce.", "chaos"),
  ],
  Jafar: [
    L("Sultan of swing pass from Jafar.", "boost"),
    L("Snake staff hypnosis.", "disrupt"),
  ],
  Genie: [
    L("Phenomenal cosmic power!", "chance"),
    L("Itty bitty living space — cramped dribble.", "boost"),
  ],
  Pinocchio: [
    L("Lie — nose grows offside.", "chaos"),
    L("Wish upon a star shot.", "chance"),
  ],
  Dumbo: [
    L("Baby mine — aerial sob story.", "chaos"),
    L("Feather flight — hang time.", "wide"),
  ],
  Bambi: [
    L("Ice on pond — first time on grass.", "disrupt"),
    L("Mother! — trauma sprint.", "wide"),
  ],
  Cinderella: [
    L("Midnight curfew — rushed shot.", "chance"),
    L("Glass slipper — fragile skill.", "boost"),
  ],
  Maleficent: [
    L("Mistress of evil — thorns on pitch.", "disrupt"),
    L("Dragon form — keeper flees.", "gk_moment"),
  ],
  "Tinker Bell": [
    L("Pixie dust — impossible angle.", "chance"),
    L("Jealous spark foul.", "yellow"),
  ],
  "Robin Hood": [
    L("Steal from rich — give to striker.", "boost"),
    L("Archery — crossbar.", "chance"),
  ],

  // ── Music Legends ──
  "Elvis Presley": [
    L("Thank you very much — Elvis hip swivel.", "chaos"),
    L("Hound dog run — greasy pace.", "wide"),
  ],
  "Freddie Mercury": [
    L("Galileo! — operatic volley.", "chance"),
    L("We will rock you — stomp tempo.", "momentum_up"),
  ],
  "Michael Jackson": [
    L("Moonwalk — defender wrong way.", "wide"),
    L("Smooth criminal lean — no foul.", "chaos"),
  ],
  Prince: [
    L("Purple rain — slippery pitch.", "chaos"),
    L("Guitar solo — play stops.", "chaos"),
  ],
  Madonna: [
    L("Vogue — strike a pose.", "chaos"),
    L("Material girl — time waste.", "chaos"),
  ],
  Beyoncé: [
    L("Single ladies — formation change.", "momentum_up"),
    L("Halo — divine save assist.", "boost"),
  ],
  "David Bowie": [
    L("Ziggy stardust — alien skill.", "boost"),
    L("Ch-ch-changes — tactical switch.", "momentum_up"),
  ],
  "Whitney Houston": [
    L("I will always love— through ball.", "boost"),
    L("Vocal power — glass shatter delay.", "chaos"),
  ],
  "Bob Marley": [
    L("One love — no foul given.", "chaos"),
    L("Jammin' — reggae rhythm possession.", "boost"),
  ],
  "Tupac Shakur": [
    L("West side — hard tackle.", "yellow"),
    L("California love — sunshine cross.", "wide"),
  ],
  "The Notorious B.I.G.": [
    L("It was all a dream — skill move.", "boost"),
    L("Brooklyn hustle from Biggie.", "boost"),
  ],
  Eminem: [
    L("Lose yourself — one moment.", "chance"),
    L("8 Mile — underdog sprint.", "wide"),
  ],
  "Bob Dylan": [
    L("The times they are a-changin' — slow build.", "boost"),
    L("Blowin' in the wind — unpredictable curl.", "chaos"),
  ],
  "Mick Jagger": [
    L("Moves like Jagger — never offside.", "wide"),
    L("Satisfaction — can't get the goal.", "disrupt"),
  ],
  Adele: [
    L("Hello from the other side — long ball.", "boost"),
    L("Rolling in the deep — driven shot.", "chance"),
  ],
  "Bruce Springsteen": [
    L("Born to run — never tires.", "stamina_opp"),
    L("Boss bandanna leadership.", "momentum_up"),
  ],
  "Johnny Cash": [
    L("Man in black — outlaw tackle.", "yellow"),
    L("Folsom prison blues — trapped wide.", "disrupt"),
  ],
  "Kurt Cobain": [
    L("Smells like teen spirit — chaos.", "chaos"),
    L("Grunge shrug — no celebration.", "chaos"),
  ],
  "Jimi Hendrix": [
    L("Purple haze — keeper sees double.", "gk_moment"),
    L("Star-spangled banner — anthem delay.", "chaos"),
  ],
  "Lady Gaga": [
    L("Poker face — unreadable dribble.", "boost"),
    L("Meat dress — kit violation.", "chaos"),
  ],
  Drake: [
    L("Started from the bottom.", "momentum_up"),
    L("Hotline bling — dance celebration too early.", "chaos"),
  ],
  "John Lennon": [
    L("Imagine — no defenders.", "boost"),
    L("Give peace a chance — refuses to foul.", "chaos"),
  ],

  // ── WWE Legends ──
  "Stone Cold Steve Austin": [
    L("Stone Cold Stunner!", "yellow"),
    L("Austin 3:16 — middle finger to the ref.", "yellow"),
  ],
  "The Undertaker": [
    L("GONG — entrance delay.", "chaos"),
    L("Tombstone — pile driver foul.", "yellow"),
  ],
  "Ric Flair": [
    L("Wooo! — Flair chop.", "boost"),
    L("Nature boy strut — time waste.", "chaos"),
  ],
  "Shawn Michaels": [
    L("Sweet Chin Music!", "chance"),
    L("Showstopper — ladder not included.", "chaos"),
  ],
  "Bret Hart": [
    L("Best there is — precision from Hitman.", "boost"),
    L("Sharpshooter — submission hold foul.", "yellow"),
  ],
  "Triple H": [
    L("Pedigree!", "yellow"),
    L("Water spit — mist.", "chaos"),
  ],
  "Mick Foley": [
    L("Hell in a cell — off the ball.", "chaos"),
    L("Three faces — random style.", "chaos"),
  ],
  Edge: [
    L("Spear!", "chance"),
    L("Rated R — sneaky foul.", "yellow"),
  ],
  Goldberg: [
    L("Spear! Jackhammer!", "chance"),
    L("Who's next? — Goldberg targets the keeper.", "gk_moment"),
  ],
  Kane: [
    L("Fire pyro — smoke delay.", "chaos"),
    L("Chokeslam clearance.", "yellow"),
  ],
  "Rey Mysterio": [
    L("619! — rope assist illegal.", "chaos"),
    L("Lucha flip — lands on feet.", "wide"),
  ],
  "Roman Reigns": [
    L("Acknowledge me.", "momentum_up"),
    L("Spear — tribal chief.", "chance"),
  ],
  "André the Giant": [
    L("Can't top rope — still dominates.", "boost"),
    L("André's colossal footprint on the pitch.", "boost"),
  ],
  "Macho Man Randy Savage": [
    L("Ooh yeah! — elbow from the top rope.", "chance"),
    L("Slim jim energy.", "stamina_opp"),
  ],
  "Ultimate Warrior": [
    L("Destrucity sprint.", "wide"),
    L("Face paint intimidation.", "disrupt"),
  ],
  "Jake 'The Snake' Roberts": [
    L("DDT — cobra out.", "yellow"),
    L("Snake in bag — chaos.", "chaos"),
  ],
  Yokozuna: [
    L("Banzai drop — belly flop.", "yellow"),
    L("Salt throw — blind.", "chaos"),
  ],
  "Mr. Perfect": [
    L("Perfectplex — showboat.", "chaos"),
    L("Hair flick — vanity delay.", "chaos"),
  ],
  "Razor Ramon": [
    L("Toothpick flick — disrespect.", "chaos"),
    L("Bad guy charm.", "boost"),
  ],
  "Dusty Rhodes": [
    L("Hard times — elbow.", "boost"),
    L("American dream speech.", "momentum_up"),
  ],
  "Randy Orton": [
    L("RKO out of nowhere!", "chance"),
    L("Punt to head — banned.", "yellow"),
  ],

  // ── TV Legends ──
  "Tony Soprano": [
    L("Bing bing — decisive from Tony.", "boost"),
    L("Therapy panic attack — pause.", "chaos"),
  ],
  "Walter White": [
    L("I am the one who knocks.", "disrupt"),
    L("Heisenberg hat — alter ego.", "momentum_up"),
  ],
  "Jesse Pinkman": [
    L("Yeah science! — chaos touch.", "chaos"),
    L("Bitch! — yellow for language.", "yellow"),
  ],
  "Saul Goodman": [
    L("Better call Saul! — legal delay.", "chaos"),
    L("Slip and fall — simulation.", "yellow"),
  ],
  "Don Draper": [
    L("Carousel pitch — hypnotic pass.", "boost"),
    L("That's what the money's for — walk.", "chaos"),
  ],
  "Dexter Morgan": [
    L("Tonight's the night — clinical.", "boost"),
    L("Dark passenger — cold finish.", "chance"),
  ],
  "Omar Little": [
    L("Omar comin' — whistle walk.", "momentum_up"),
    L("Lean — shotgun metaphor.", "disrupt"),
  ],
  "Stringer Bell": [
    L("Business class — calculated.", "boost"),
    L("Avon would disagree — feud pass.", "chaos"),
  ],
  "Tyrion Lannister": [
    L("I drink and I know things.", "boost"),
    L("Trial by combat request.", "chaos"),
  ],
  "Jack Bauer": [
    L("Dammit! — 24 seconds to score.", "chance"),
    L("Torture intel — where's the ball?", "boost"),
  ],
  "Vic Mackey": [
    L("Strike team press — dirty.", "yellow"),
    L("Corrupt badge — ref bribed?", "chaos"),
  ],
  "Christopher Moltisanti": [
    L("Cleaver film — distracted.", "disrupt"),
    L("Mob wife drama.", "chaos"),
  ],
  "Paulie Walnuts": [
    L("Pine barrens — lost in build-up.", "disrupt"),
    L("No joke — Paulie stares.", "disrupt"),
  ],
  "Jimmy McGill": [
    L("S'all good man! — con.", "chaos"),
    L("Slippin' Jimmy sprint.", "wide"),
  ],
  "Gus Fring": [
    L("Pollos Hermanos — calm menace.", "boost"),
    L("Box cutter — surgical.", "yellow"),
  ],
  "Mike Ehrmantraut": [
    L("No half measures.", "boost"),
    L("Cleaner — body gone, ball kept.", "boost"),
  ],
  "Cersei Lannister": [
    L("Shame walk — psychological.", "disrupt"),
    L("Wildfire — scorched earth.", "chaos"),
  ],
  "Ned Stark": [
    L("Winter is coming — slow build.", "boost"),
    L("Head on pike — morale hit.", "disrupt"),
  ],
  "Jimmy McNulty": [
    L("Fake serial killer — chaos.", "chaos"),
    L("Drunk detective brilliance.", "boost"),
  ],
  "Tommy Shelby": [
    L("By order of the Peaky Blinders.", "disrupt"),
    L("Razor cap — cut.", "yellow"),
  ],
  "Al Swearengen": [
    L("Welcome to Deadwood — profane.", "chaos"),
    L("Hearst monologue delay.", "chaos"),
  ],
  "Walter White Jr.": [
    L("Breakfast! — Walter Jr. falls over.", "disrupt"),
    L("Handicap parking — wrong role.", "chaos"),
  ],

  // ── Dreamworks ──
  Shrek: [
    L("Get off my swamp — tackle.", "yellow"),
    L("Onions have layers — complex pass.", "boost"),
  ],
  Donkey: [
    L("In the mornin' — chatter delay.", "chaos"),
    L("Dragon romance distraction.", "chaos"),
  ],
  "Princess Fiona": [
    L("Ogre roar — surprise.", "boost"),
    L("Martial arts princess.", "boost"),
  ],
  "Puss in Boots": [
    L("Eyes — cute foul immunity.", "chaos"),
    L("Leche — milk break.", "chaos"),
  ],
  Po: [
    L("Skadoosh! — belly bounce.", "chance"),
    L("Noodle vision — hungry.", "disrupt"),
  ],
  Tigress: [
    L("Fury of five — claw.", "yellow"),
    L("Serious focus — no jokes.", "boost"),
  ],
  "Lord Shen": [
    L("Fireworks — pitch lit.", "chaos"),
    L("Peacock vanity.", "chaos"),
  ],
  "Tai Lung": [
    L("Escape rage — unstoppable.", "boost"),
    L("Wuxi finger hold — illegal.", "yellow"),
  ],
  Hiccup: [
    L("Dragon rider aerial.", "wide"),
    L("Toothless! — link-up.", "boost"),
  ],
  Toothless: [
    L("Plasma blast — warm ball.", "chaos"),
    L("Night fury stealth.", "disrupt"),
  ],
  "Alex the Lion": [
    L("King of New York — roar.", "momentum_up"),
    L("Zoo escape pace.", "wide"),
  ],
  "Marty the Zebra": [
    L("Wild streak — stripes blur.", "wide"),
    L("I like to move it.", "wide"),
  ],
  "Gloria the Hippo": [
    L("Hippo ballerina — surprisingly agile.", "boost"),
    L("Water hole — pitch crater.", "chaos"),
  ],
  Skipper: [
    L("Operation — classified pass.", "boost"),
    L("Kowalski analysis paralysis.", "chaos"),
  ],
  Megamind: [
    L("Presentation! — evil plan.", "chaos"),
    L("No fault of mine — blame shift.", "chaos"),
  ],
  "Metro Man": [
    L("Megamind's opposite — perfect hero.", "boost"),
    L("Too much justice — offside.", "chaos"),
  ],
  Spirit: [
    L("Stallion sprint — untamable.", "wide"),
    L("Cavalry charge.", "momentum_up"),
  ],
  Moses: [
    L("Let my people go — parting defense.", "boost"),
    L("Burning bush — delay.", "chaos"),
  ],
  Rumpelstiltskin: [
    L("Deal with the devil — trade foul.", "chaos"),
    L("Name guess — chaos.", "chaos"),
  ],
  Sinbad: [
    L("Legendary voyage cross.", "wide"),
    L("Eris goddess interference.", "chaos"),
  ],
  "B.O.B.": [
    L("Candy corn brain — random touch.", "chaos"),
    L("No gravity — float pass.", "wide"),
  ],
  "King Julian": [
    L("I like to move it — dance foul.", "chaos"),
    L("Throw me — assist.", "boost"),
  ],

  // ── Mythical Creatures ──
  "Great Dragon": [
    L("Fire breath — scorched turf.", "chaos"),
    L("Hoard gold — time waste.", "chaos"),
  ],
  Phoenix: [
    L("Rebirth — second wind.", "stamina_opp"),
    L("Ash trail — blind keeper.", "gk_moment"),
  ],
  Griffin: [
    L("Eagle eye cross.", "wide"),
    L("Lion claws foul.", "yellow"),
  ],
  Centaur: [
    L("Gallop — can you foul the horse part?", "chaos"),
    L("Bow shot from midfield.", "chance"),
  ],
  Minotaur: [
    L("Labyrinth dribble — defender lost.", "boost"),
    L("Bull rush.", "yellow"),
  ],
  Cyclops: [
    L("One-eyed through ball — narrow vision.", "disrupt"),
    L("Odysseus trauma — rage.", "yellow"),
  ],
  Medusa: [
    L("Stone gaze — defenders freeze.", "disrupt"),
    L("Snakes — offside line alive.", "chaos"),
  ],
  Kraken: [
    L("Tentacle grab from goalmouth.", "gk_moment"),
    L("Shipwreck pitch flooding.", "chaos"),
  ],
  Hydra: [
    L("Cut down one — two pressers appear.", "disrupt"),
    L("Regrows stamina.", "stamina_opp"),
  ],
  Pegasus: [
    L("Aerial gallop — offside in the sky.", "wide"),
    L("Divine hoof — crack shot.", "chance"),
  ],
  Unicorn: [
    L("Pure magic — ref favors.", "chaos"),
    L("Horn impale — horror foul.", "yellow"),
  ],
  Werewolf: [
    L("Full moon transformation.", "momentum_up"),
    L("Howl — night game only.", "chaos"),
  ],
  Banshee: [
    L("Scream — ball shatters.", "chaos"),
    L("Wail — keeper covers ears.", "gk_moment"),
  ],
  Sphinx: [
    L("Riddle or forfeit possession.", "chaos"),
    L("Guardian block.", "boost"),
  ],
  Chimera: [
    L("Three-headed attack — triple threat.", "boost"),
    L("Fire goat lion — chaos.", "chaos"),
  ],
  Leviathan: [
    L("Sea swell — pitch underwater.", "chaos"),
    L("Biblical swallow — ball gone.", "chaos"),
  ],
  Wendigo: [
    L("Hunger — never stops running.", "stamina_opp"),
    L("Forest stalk — ambush.", "disrupt"),
  ],
  Golem: [
    L("Clay slow — unstoppable late.", "boost"),
    L("Rabbi control — loses script.", "disrupt"),
  ],
  Titan: [
    L("Olympus throws a mountain.", "chaos"),
    L("Titan stomp — seismic.", "yellow"),
  ],
  Kitsune: [
    L("Fox fire illusion.", "disrupt"),
    L("Nine tails — nine stepovers.", "wide"),
  ],
  Cerberus: [
    L("Three-headed guard dog press.", "disrupt"),
    L("Underworld chain foul.", "yellow"),
  ],
  Basilisk: [
    L("Serpent king — death stare.", "disrupt"),
    L("Mirror trick — own goal scare.", "gk_moment"),
  ],
};

// Collect all squad names
const allNames = [];
for (const u of squads.universes) {
  for (const p of u.players) {
    allNames.push(p.name);
  }
}

// Validate
const missing = [];
const tooFew = [];
for (const name of allNames) {
  if (!players[name]) missing.push(name);
  else if (players[name].length < 2) tooFew.push(name);
}

if (missing.length) {
  console.error("Missing players:", missing);
  process.exit(1);
}
if (tooFew.length) {
  console.error("Too few lines:", tooFew);
  process.exit(1);
}

// Check pool members exist in squads
const nameSet = new Set(allNames);
for (const [poolId, pool] of Object.entries(pools)) {
  for (const m of pool.members) {
    if (!nameSet.has(m)) {
      console.error(`Pool ${poolId}: member "${m}" not in squads.json`);
      process.exit(1);
    }
  }
}

const output = { pools, players };

// Only include players from squads (exact keys)
const orderedPlayers = {};
for (const name of allNames.sort()) {
  orderedPlayers[name] = players[name];
}

const finalOutput = { pools, players: orderedPlayers };

let totalLines = 0;
for (const lines of Object.values(orderedPlayers)) totalLines += lines.length;
for (const pool of Object.values(pools)) totalLines += pool.lines.length;

writeFileSync(
  join(ROOT, "data", "special-events.json"),
  JSON.stringify(finalOutput, null, 2) + "\n",
  "utf8"
);

console.log(JSON.stringify({
  playerCount: allNames.length,
  playersWithLines: Object.keys(orderedPlayers).length,
  totalLines,
  poolCount: Object.keys(pools).length,
  minLines: Math.min(...Object.values(orderedPlayers).map((l) => l.length)),
  maxLines: Math.max(...Object.values(orderedPlayers).map((l) => l.length)),
}, null, 2));
