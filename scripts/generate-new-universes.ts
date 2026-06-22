import { writeFileSync, readFileSync } from "fs";
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
    id: "religious-figures",
    name: "Religious Figures",
    accentColor: "#eab308",
    tagline: "Faith, miracles, and questionable handballs.",
    players: [
      player("Moses", "pass", { tackling: 80 }),
      player("Buddha", "pass", { tackling: 88, pace: 62 }),
      player("Jesus", "star", { passing: 94, gk: 55 }),
      player("Muhammad", "power", { pace: 78, passing: 80 }),
      player("Krishna", "pace", { passing: 88 }),
      player("Thor", "power"),
      player("Zeus", "star", { power: 86, passing: 84 }),
      player("Anubis", "gk"),
      player("Noah", "def", { stamina: 92 }),
      player("David", "pace", { power: 80 }),
      player("Mary", "def", { pace: 70, passing: 76 }),
      player("Satan", "power", { pace: 74, tackling: 62 }),
      player("Joan of Arc", "pace", { stamina: 94, tackling: 72 }),
      player("Solomon", "pass", { tackling: 78 }),
      player("St Peter", "gk", { gk: 82 }),
      player("Ganesh", "pass", { power: 72 }),
      player("Vishnu", "pass", { stamina: 90, tackling: 76 }),
      player("Job", "def", { stamina: 96, tackling: 80 }),
      player("Judas", "pass", { tackling: 58 }),
      player("Cain", "power", { tackling: 70 }),
      player("Abraham", "power", { passing: 74 }),
      player("Gabriel", "pace", { passing: 80 }),
    ],
  },
  {
    id: "shakespeare",
    name: "Shakespeare",
    accentColor: "#b91c1c",
    tagline: "All the world's a pitch.",
    players: [
      player("Hamlet", "pass", { pace: 58 }),
      player("Macbeth", "power"),
      player("Lady Macbeth", "power", { pace: 72 }),
      player("Iago", "def", { passing: 82, tackling: 74 }),
      player("Othello", "def", { power: 84 }),
      player("Romeo", "pace", { passing: 78 }),
      player("Juliet", "pace", { passing: 76 }),
      player("Falstaff", "power", { pace: 48, stamina: 70 }),
      player("Richard III", "def", { tackling: 82 }),
      player("King Lear", "def", { passing: 70 }),
      player("Puck", "chaos"),
      player("Bottom", "meme", { power: 70 }),
      player("Prospero", "star", { passing: 90 }),
      player("Shylock", "def", { tackling: 80 }),
      player("Mercutio", "pace", { passing: 80 }),
      player("Tybalt", "pace", { tackling: 76, power: 74 }),
      player("Portia", "pass"),
      player("Brutus", "def", { power: 78 }),
      player("Cleopatra", "pass", { pace: 68 }),
      player("Viola", "pace", { passing: 84 }),
      player("Beatrice", "def", { passing: 80 }),
      player("Benedick", "def", { pace: 74 }),
    ],
  },
  {
    id: "philosophers",
    name: "Philosophers",
    accentColor: "#475569",
    tagline: "They possess the ball. They dispute the scoreline.",
    players: [
      player("Socrates", "pass", { tackling: 68 }),
      player("Plato", "pass", { pace: 66 }),
      player("Aristotle", "def", { passing: 86 }),
      player("Nietzsche", "power", { pace: 76 }),
      player("Kant", "def", { pace: 58, tackling: 88 }),
      player("Descartes", "gk", { passing: 78 }),
      player("Marx", "power", { passing: 80 }),
      player("Machiavelli", "def", { passing: 84, tackling: 78 }),
      player("Diogenes", "meme", { gk: 72, tackling: 62 }),
      player("Confucius", "def", { passing: 88 }),
      player("Sun Tzu", "pass", { tackling: 82 }),
      player("Epicurus", "meme", { power: 64, passing: 74 }),
      player("Seneca", "def", { stamina: 90 }),
      player("Hobbes", "def", { power: 82 }),
      player("Locke", "def", { passing: 80 }),
      player("Rousseau", "pace", { passing: 76 }),
      player("Voltaire", "pace", { passing: 86 }),
      player("Schopenhauer", "def", { pace: 54, passing: 78 }),
      player("Kierkegaard", "pass", { pace: 64 }),
      player("Foucault", "def", { tackling: 74 }),
      player("Simone de Beauvoir", "pass", { pace: 72 }),
      player("Wittgenstein", "meme", { passing: 90, power: 52 }),
    ],
  },
  {
    id: "reality-tv",
    name: "Reality TV",
    accentColor: "#ec4899",
    tagline: "GTL: Gym, Tackle, Limelight.",
    players: [
      player("The Situation", "pace", { power: 74 }),
      player("Snooki", "chaos", { power: 62 }),
      player("Pauly D", "pace", { passing: 72 }),
      player("JWoww", "def", { power: 80 }),
      player("Vinny", "def", { pace: 68 }),
      player("Ronnie", "power", { tackling: 70 }),
      player("Sammi", "pass", { pace: 70 }),
      player("Kim Kardashian", "star", { pace: 68, power: 62 }),
      player("Kourtney Kardashian", "pass", { pace: 66 }),
      player("Khloé Kardashian", "def", { power: 78 }),
      player("Paris Hilton", "pace", { passing: 68 }),
      player("Simon Cowell", "pass", { tackling: 64 }),
      player("Gordon Ramsay", "power", { pace: 62, passing: 70 }),
      player("RuPaul", "star", { pace: 74, passing: 84 }),
      player("Jeff Probst", "pass", { tackling: 72 }),
      player("Guy Fieri", "pace", { power: 76 }),
      player("Dr. Phil", "def", { passing: 78 }),
      player("Omarosa", "chaos", { passing: 74 }),
      player("Honey Boo Boo", "meme", { pace: 78 }),
      player("Flavor Flav", "gk", { gk: 70, pace: 55 }),
      player("Teresa Giudice", "power", { pace: 66 }),
      player("Bethenny Frankel", "pass", { pace: 72 }),
    ],
  },
  {
    id: "80s-action-heroes",
    name: "80s Action Heroes",
    accentColor: "#ea580c",
    tagline: "No passing. Only explosions.",
    players: [
      player("Schwarzenegger", "power", { pace: 72 }),
      player("Stallone", "power", { stamina: 88 }),
      player("Van Damme", "pace", { power: 84 }),
      player("Chuck Norris", "def", { power: 90, pace: 70 }),
      player("Bruce Willis", "star", { power: 82, tackling: 74 }),
      player("Steven Seagal", "def", { power: 80, pace: 58 }),
      player("Dolph Lundgren", "power", { pace: 68 }),
      player("Mel Gibson", "pace", { power: 78 }),
      player("Harrison Ford", "star", { pace: 74, passing: 78 }),
      player("Wesley Snipes", "pace", { power: 76 }),
      player("Jet Li", "pace", { power: 82, passing: 70 }),
      player("Jackie Chan", "pace", { tackling: 80, gk: 45 }),
      player("Rambo", "power", { pace: 70, passing: 48 }),
      player("Terminator", "gk", { gk: 92, pace: 65, power: 88 }),
      player("Predator", "power", { pace: 76, passing: 50 }),
      player("RoboCop", "def", { power: 86, tackling: 88 }),
      player("MacGyver", "pass", { tackling: 72 }),
      player("He-Man", "power", { pace: 80, stamina: 90 }),
      player("Commando", "power", { pace: 74 }),
      player("Dutch", "def", { power: 84, tackling: 82 }),
      player("John McClane", "star", { pace: 72, power: 78 }),
      player("Cobra", "power", { pace: 68, passing: 52 }),
    ],
  },
  {
    id: "tech-billionaires",
    name: "Tech Billionaires",
    accentColor: "#0ea5e9",
    tagline: "Move fast and break the offside trap.",
    players: [
      player("Elon Musk", "chaos", { passing: 78, power: 74 }),
      player("Jeff Bezos", "power", { pace: 62, passing: 76 }),
      player("Mark Zuckerberg", "pass", { pace: 68 }),
      player("Bill Gates", "pass", { tackling: 76 }),
      player("Steve Jobs", "star", { passing: 88, power: 72 }),
      player("Larry Page", "pass", { pace: 64 }),
      player("Sergey Brin", "pace", { passing: 80 }),
      player("Larry Ellison", "def", { power: 78, passing: 74 }),
      player("Jensen Huang", "pace", { power: 76 }),
      player("Tim Cook", "def", { passing: 82, pace: 66 }),
      player("Peter Thiel", "def", { tackling: 74, passing: 80 }),
      player("Elizabeth Holmes", "meme", { gk: 35, passing: 70 }),
      player("Adam Neumann", "meme", { power: 68, pace: 72 }),
      player("Travis Kalanick", "pace", { tackling: 62 }),
      player("Sam Bankman-Fried", "chaos", { passing: 64 }),
      player("Jack Dorsey", "pass", { pace: 60 }),
      player("Mark Cuban", "star", { power: 74, passing: 76 }),
      player("Oprah", "star", { passing: 86, pace: 70 }),
      player("MrBeast", "pace", { power: 70, passing: 72 }),
      player("The VC", "def", { passing: 78, pace: 58 }),
      player("The Intern", "meme", { pace: 82, stamina: 88 }),
      player("Erlich Bachman", "chaos", { passing: 68 }),
    ],
  },
];

const squadsPath = new URL("../data/squads.json", import.meta.url);
const squads = JSON.parse(readFileSync(squadsPath, "utf8")) as {
  version: number;
  overallFormula: string;
  universes: unknown[];
};

const existingIds = new Set(
  (squads.universes as { id: string }[]).map((u) => u.id)
);
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
