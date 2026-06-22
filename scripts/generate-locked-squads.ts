import { readFileSync, writeFileSync } from "fs";
import { calculateOvr } from "../lib/stats";
import type { PlayerStats } from "../lib/types";

type Profile = "gk" | "star" | "pace" | "power" | "pass" | "def" | "meme" | "chaos";

function stats(profile: Profile, tweak: Partial<PlayerStats> = {}): PlayerStats {
  const base: Record<Profile, PlayerStats> = {
    gk: { pace: 42, power: 58, stamina: 78, tackling: 52, passing: 62, gk: 88 },
    star: { pace: 76, power: 78, stamina: 84, tackling: 72, passing: 82, gk: 38 },
    pace: { pace: 90, power: 68, stamina: 80, tackling: 58, passing: 74, gk: 22 },
    power: { pace: 68, power: 92, stamina: 82, tackling: 78, passing: 62, gk: 28 },
    pass: { pace: 72, power: 62, stamina: 86, tackling: 70, passing: 92, gk: 32 },
    def: { pace: 64, power: 76, stamina: 84, tackling: 86, passing: 68, gk: 30 },
    meme: { pace: 55, power: 58, stamina: 62, tackling: 48, passing: 52, gk: 45 },
    chaos: { pace: 82, power: 70, stamina: 72, tackling: 52, passing: 66, gk: 24 },
  };
  return { ...base[profile], ...tweak };
}

function player(name: string, profile: Profile, tweak?: Partial<PlayerStats>) {
  const s = stats(profile, tweak);
  return { name, stats: s, ovr: calculateOvr(s) };
}

const universes = [
  {
    id: "nba-legends",
    name: "NBA Legends",
    accentColor: "#f97316",
    tagline: "Run the floor. Posterise the keeper.",
    players: [
      player("Michael Jordan", "star", { pace: 88, power: 90, passing: 84 }),
      player("LeBron James", "star", { power: 92, passing: 86, stamina: 90 }),
      player("Kobe Bryant", "pace", { power: 84, passing: 78 }),
      player("Magic Johnson", "pass", { pace: 78, power: 76 }),
      player("Stephen Curry", "pass", { pace: 82, power: 70, passing: 94 }),
      player("Giannis Antetokounmpo", "power", { pace: 86 }),
      player("Shaquille O'Neal", "power", { pace: 62, power: 98, gk: 42 }),
      player("Wilt Chamberlain", "power", { pace: 80, power: 96 }),
      player("Bill Russell", "def", { tackling: 88, gk: 55 }),
      player("Kareem Abdul-Jabbar", "star", { power: 88, gk: 48 }),
      player("Hakeem Olajuwon", "gk", { gk: 90, tackling: 74 }),
      player("Tim Duncan", "def", { power: 82, tackling: 84 }),
      player("Kevin Durant", "star", { pace: 80, passing: 84 }),
      player("Larry Bird", "pass", { power: 78, passing: 90 }),
      player("Dwyane Wade", "pace", { power: 80 }),
      player("Dirk Nowitzki", "pass", { power: 82, passing: 86 }),
      player("Karl Malone", "power", { stamina: 88 }),
      player("Isiah Thomas", "pass", { pace: 76 }),
      player("John Stockton", "pass", { pace: 70, passing: 94 }),
      player("Scottie Pippen", "def", { pace: 82, tackling: 82 }),
      player("Dennis Rodman", "def", { tackling: 80, pace: 74 }),
      player("Allen Iverson", "pace", { power: 72, passing: 76 }),
    ],
  },
  {
    id: "cricket-legends",
    name: "Cricket Legends",
    accentColor: "#16a34a",
    tagline: "Test-match patience. T20 chaos in the 90th.",
    players: [
      player("Don Bradman", "star", { power: 88, passing: 86 }),
      player("Sachin Tendulkar", "star", { pace: 78, power: 84, passing: 88 }),
      player("Virat Kohli", "pace", { power: 82, passing: 80 }),
      player("Viv Richards", "power", { pace: 86, power: 90 }),
      player("Brian Lara", "pass", { pace: 80, passing: 90 }),
      player("Ricky Ponting", "star", { power: 84, tackling: 74 }),
      player("Shane Warne", "chaos", { passing: 92 }),
      player("Muttiah Muralitharan", "pass", { passing: 90, tackling: 72 }),
      player("Glenn McGrath", "def", { passing: 82, tackling: 78 }),
      player("Wasim Akram", "pace", { passing: 86 }),
      player("Ian Botham", "power", { stamina: 86 }),
      player("Ben Stokes", "star", { power: 86, stamina: 88 }),
      player("MS Dhoni", "gk", { gk: 86, passing: 80 }),
      player("Imran Khan", "star", { power: 82, passing: 78 }),
      player("Richard Hadlee", "def", { tackling: 80 }),
      player("Garfield Sobers", "star", { pace: 80, power: 88, passing: 84 }),
      player("Chris Gayle", "power", { pace: 76, power: 94 }),
      player("AB de Villiers", "pace", { power: 80, passing: 82 }),
      player("James Anderson", "def", { stamina: 90, tackling: 76 }),
      player("Joe Root", "pass", { passing: 88 }),
      player("Jasprit Bumrah", "pace", { power: 78, passing: 80 }),
      player("Kapil Dev", "star", { stamina: 88, power: 80 }),
    ],
  },
  {
    id: "rugby-legends",
    name: "Rugby Legends",
    accentColor: "#1d4ed8",
    tagline: "Gain line. Ruck. Repeat.",
    players: [
      player("Jonah Lomu", "pace", { power: 94, pace: 92 }),
      player("Dan Carter", "pass", { passing: 92, power: 76 }),
      player("Jonny Wilkinson", "pass", { power: 78, passing: 90 }),
      player("Richie McCaw", "def", { tackling: 94, stamina: 92 }),
      player("Brian O'Driscoll", "star", { pace: 82, passing: 84 }),
      player("Owen Farrell", "power", { tackling: 82 }),
      player("Martin Johnson", "power", { tackling: 90 }),
      player("Elliot Daly", "pace", { power: 76 }),
      player("Bryan Habana", "pace", { pace: 90 }),
      player("Joe Rokocoko", "pace", { power: 80 }),
      player("Johnny Sexton", "pass", { passing: 88 }),
      player("Beauden Barrett", "pace", { passing: 86 }),
      player("Kieran Read", "def", { stamina: 90, tackling: 86 }),
      player("David Pocock", "def", { tackling: 92 }),
      player("Maro Itoje", "def", { power: 84, tackling: 88 }),
      player("David Campese", "pace", { passing: 78 }),
      player("Gareth Edwards", "pass", { pace: 84, passing: 90 }),
      player("Ma'a Nonu", "power", { pace: 78 }),
      player("Ben Foden", "pace", { stamina: 82 }),
      player("Serge Blanco", "pace", { passing: 80 }),
      player("Siya Kolisi", "star", { tackling: 84, stamina: 88 }),
      player("Alun Wyn Jones", "def", { tackling: 90, stamina: 92 }),
    ],
  },
  {
    id: "nfl-legends",
    name: "NFL Legends",
    accentColor: "#7c2d12",
    tagline: "Four downs to goal. No subs left.",
    players: [
      player("Tom Brady", "pass", { passing: 96, stamina: 90 }),
      player("Joe Montana", "pass", { passing: 94, power: 72 }),
      player("Jerry Rice", "star", { pace: 86, passing: 88 }),
      player("Barry Sanders", "pace", { pace: 94, power: 78 }),
      player("Lawrence Taylor", "def", { tackling: 96, power: 88 }),
      player("Ray Lewis", "def", { tackling: 94, power: 86 }),
      player("Deion Sanders", "pace", { pace: 96, tackling: 80 }),
      player("Calvin Johnson", "power", { pace: 84, power: 92 }),
      player("Patrick Mahomes", "chaos", { passing: 94, power: 80 }),
      player("Peyton Manning", "pass", { passing: 95 }),
      player("Brian Urlacher", "def", { tackling: 90 }),
      player("Troy Polamalu", "def", { pace: 82, tackling: 88 }),
      player("Travis Kelce", "star", { power: 82, passing: 84 }),
      player("Rob Gronkowski", "power", { power: 90 }),
      player("Walter Payton", "star", { power: 86, stamina: 88 }),
      player("Ed Reed", "def", { tackling: 88, pace: 80 }),
      player("Aaron Donald", "def", { power: 92, tackling: 94 }),
      player("Randy Moss", "pace", { power: 84 }),
      player("Emmitt Smith", "power", { stamina: 90 }),
      player("Reggie White", "power", { tackling: 86 }),
      player("Vince Lombardi", "pass", { passing: 82, tackling: 70 }),
      player("Adam Vinatieri", "gk", { gk: 84, passing: 70 }),
    ],
  },
  {
    id: "dinosaurs",
    name: "Dinosaurs",
    accentColor: "#78350f",
    tagline: "Extinction is only for the scoreboard.",
    players: [
      player("T-Rex", "power", { power: 98, pace: 68 }),
      player("Velociraptor", "pace", { power: 78, tackling: 72 }),
      player("Triceratops", "def", { power: 90, tackling: 92 }),
      player("Spinosaurus", "star", { power: 94, pace: 74 }),
      player("Brachiosaurus", "power", { power: 92, pace: 42, stamina: 88 }),
      player("Pterodactyl", "pace", { pace: 92, power: 70 }),
      player("Stegosaurus", "def", { tackling: 86, power: 82 }),
      player("Ankylosaurus", "def", { tackling: 94, power: 88 }),
      player("Allosaurus", "power", { pace: 76, power: 90 }),
      player("Carnotaurus", "pace", { power: 86 }),
      player("Dilophosaurus", "chaos", { pace: 80 }),
      player("Parasaurolophus", "pass", { stamina: 86 }),
      player("Diplodocus", "def", { stamina: 90, power: 80 }),
      player("Compsognathus", "pace", { pace: 88, power: 52 }),
      player("Utahraptor", "pace", { power: 82, tackling: 74 }),
      player("Giganotosaurus", "power", { power: 96 }),
      player("Iguanodon", "pass", { passing: 74 }),
      player("Pachycephalosaurus", "power", { power: 84, tackling: 76 }),
      player("Archaeopteryx", "pace", { pace: 86, passing: 68 }),
      player("Mosasaurus", "gk", { gk: 90, power: 88 }),
      player("Therizinosaurus", "power", { tackling: 80, power: 86 }),
      player("Deinonychus", "pace", { power: 76, tackling: 70 }),
    ],
  },
  {
    id: "mammals",
    name: "Mammals",
    accentColor: "#92400e",
    tagline: "Kingdom's finest. Cheetah on the wing.",
    players: [
      player("Cheetah", "pace", { pace: 98, power: 72 }),
      player("Lion", "star", { power: 88, tackling: 78 }),
      player("Elephant", "power", { power: 96, pace: 38, tackling: 82 }),
      player("Gorilla", "power", { power: 92, tackling: 80 }),
      player("Grey Wolf", "def", { tackling: 84, stamina: 86 }),
      player("Grizzly Bear", "power", { power: 90, tackling: 76 }),
      player("Kangaroo", "pace", { power: 80, stamina: 84 }),
      player("Dolphin", "pass", { passing: 90, pace: 78 }),
      player("Peregrine Falcon", "pace", { pace: 94, power: 68 }),
      player("Horse", "pace", { stamina: 90, power: 74 }),
      player("Rhino", "power", { power: 94, tackling: 78 }),
      player("Hippo", "power", { power: 90, pace: 48 }),
      player("Tiger", "star", { pace: 84, power: 86 }),
      player("Leopard", "pace", { power: 78 }),
      player("Moose", "power", { tackling: 74 }),
      player("Bison", "def", { power: 86, stamina: 88 }),
      player("Fox", "pace", { passing: 76 }),
      player("Badger", "def", { tackling: 82, power: 72 }),
      player("Otter", "pass", { pace: 74, passing: 78 }),
      player("Bat", "chaos", { pace: 82 }),
      player("Gazelle", "pace", { pace: 92 }),
      player("Walrus", "gk", { gk: 82, power: 84 }),
    ],
  },
  {
    id: "reptiles-legends",
    name: "Reptiles",
    accentColor: "#4d7c0f",
    tagline: "Cold blood. Hot tackles.",
    players: [
      player("Saltwater Crocodile", "power", { power: 94, tackling: 88 }),
      player("Komodo Dragon", "def", { power: 86, tackling: 84 }),
      player("King Cobra", "pace", { pace: 86, power: 72 }),
      player("Python", "def", { tackling: 90, power: 78 }),
      player("American Alligator", "power", { tackling: 86 }),
      player("Marine Iguana", "def", { stamina: 82 }),
      player("Gecko", "pace", { pace: 84, tackling: 58 }),
      player("Chameleon", "pass", { passing: 76, pace: 62 }),
      player("Galápagos Tortoise", "gk", { gk: 80, stamina: 94 }),
      player("Leatherback Turtle", "def", { stamina: 90, tackling: 76 }),
      player("Monitor Lizard", "star", { pace: 74, power: 80 }),
      player("Anaconda", "def", { tackling: 88, power: 82 }),
      player("Rattlesnake", "pace", { power: 70 }),
      player("Gila Monster", "def", { tackling: 74 }),
      player("Frilled Lizard", "chaos", { pace: 76 }),
      player("Basilisk", "pace", { pace: 88 }),
      player("Tegu", "star", { power: 76, passing: 72 }),
      player("Skink", "pace", { pace: 80 }),
      player("Black Mamba", "pace", { pace: 92, power: 74 }),
      player("Horned Lizard", "def", { tackling: 72 }),
      player("Caiman", "def", { power: 82, tackling: 84 }),
      player("Tuatara", "pass", { stamina: 88, passing: 74 }),
    ],
  },
];

const squadsPath = new URL("../data/squads.json", import.meta.url);
const squads = JSON.parse(readFileSync(squadsPath, "utf8")) as {
  version: number;
  overallFormula: string;
  universes: unknown[];
};

const existingIds = new Set((squads.universes as { id: string }[]).map((u) => u.id));
for (const u of universes) {
  if (existingIds.has(u.id)) {
    console.log("skip existing", u.id);
    continue;
  }
  squads.universes.push(u);
  console.log("added", u.id, u.players.length, "players");
}

writeFileSync(squadsPath, JSON.stringify(squads, null, 2) + "\n");
console.log("total universes:", squads.universes.length);
