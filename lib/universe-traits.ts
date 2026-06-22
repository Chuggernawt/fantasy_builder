export interface UniverseTrait {
  id: string;
  label: string;
  description: string;
  /** Extra foul/yellow pressure when this team defends. */
  foulBias?: number;
  /** Bonus xG on set pieces for this team. */
  setPieceXg?: number;
  /** Extra turnover chance when this team presses. */
  pressBonus?: number;
  /** Flat xG bump on shots for this team. */
  shotXg?: number;
  /** Momentum swings are slightly larger. */
  momentumAmp?: number;
  /** Special event weight multiplier for cast from this team. */
  specialWeight?: number;
}

const DEFAULT_TRAIT: UniverseTrait = {
  id: "balanced",
  label: "Balanced",
  description: "No passive match modifier.",
};

const TRAITS: Record<string, UniverseTrait> = {
  lotr: {
    id: "fellowship",
    label: "Fellowship",
    description: "Build-up phases are more reliable; momentum swings are steadier.",
    pressBonus: -0.02,
    momentumAmp: 0.85,
  },
  "harry-potter": {
    id: "magic",
    label: "Magic",
    description: "More special moments and set-piece danger.",
    setPieceXg: 0.04,
    specialWeight: 1.15,
  },
  simpsons: {
    id: "chaos",
    label: "Chaos",
    description: "Unpredictable phases — more turnovers both ways.",
    pressBonus: 0.04,
    momentumAmp: 1.2,
  },
  futurama: {
    id: "gadgets",
    label: "Gadgets",
    description: "Direct play and long balls hit harder.",
    shotXg: 0.02,
  },
  "family-guy": {
    id: "cutaway",
    label: "Cutaway",
    description: "Random momentum spikes.",
    momentumAmp: 1.25,
  },
  "famous-retards": {
    id: "wildcard",
    label: "Wildcard",
    description: "Low xG chances sometimes become big moments.",
    shotXg: 0.03,
    specialWeight: 1.1,
  },
  "world-leaders": {
    id: "discipline",
    label: "Discipline",
    description: "Fewer fouls committed; sit-deep when defending.",
    foulBias: -0.03,
  },
  "fighting-legends": {
    id: "warriors",
    label: "Warriors",
    description: "Duels and physical play favour this side.",
    pressBonus: 0.03,
    foulBias: 0.02,
  },
  "star-wars": {
    id: "force",
    label: "The Force",
    description: "Set pieces and through-ball chances improve.",
    setPieceXg: 0.05,
    shotXg: 0.015,
  },
  marvel: {
    id: "superpower",
    label: "Superpower",
    description: "Shot power and special headlines spike.",
    shotXg: 0.025,
    specialWeight: 1.2,
  },
  dc: {
    id: "justice",
    label: "Justice",
    description: "Strong when ahead on momentum; clinical finishing.",
    shotXg: 0.02,
    momentumAmp: 1.1,
  },
  sony: {
    id: "blockbuster",
    label: "Blockbuster",
    description: "Big chances appear more often under pressure.",
    pressBonus: 0.02,
    shotXg: 0.015,
  },
  nintendo: {
    id: "powerup",
    label: "Power-Up",
    description: "Fresh subs and captain calls hit harder (stamina phases).",
    specialWeight: 1.05,
  },
  "horror-icons": {
    id: "dread",
    label: "Dread",
    description: "Defenders rattle opponents — more fouls and cards.",
    foulBias: 0.05,
    pressBonus: 0.02,
  },
  "disney-animated": {
    id: "fairytale",
    label: "Fairytale",
    description: "Comeback momentum when trailing.",
    momentumAmp: 1.15,
  },
  "music-legends": {
    id: "rhythm",
    label: "Rhythm",
    description: "Possession build-up and passing phases flow better.",
    pressBonus: -0.015,
  },
  "wwe-legends": {
    id: "showmanship",
    label: "Showmanship",
    description: "Cards, fouls, and momentum swings — crowd loves it.",
    foulBias: 0.06,
    momentumAmp: 1.3,
    specialWeight: 1.15,
  },
  "tv-legends": {
    id: "drama",
    label: "Drama",
    description: "Late phases and special events tilt the narrative.",
    specialWeight: 1.2,
    shotXg: 0.01,
  },
  dreamworks: {
    id: "banter",
    label: "Banter",
    description: "Wide play and crosses create more chaos.",
    setPieceXg: 0.02,
    pressBonus: 0.015,
  },
  "mythical-creatures": {
    id: "mythic",
    label: "Mythic",
    description: "Ancient power — set pieces and headers threaten.",
    setPieceXg: 0.035,
    shotXg: 0.02,
  },
  "religious-figures": {
    id: "divine",
    label: "Divine Intervention",
    description: "Set pieces and late momentum when trailing.",
    setPieceXg: 0.03,
    momentumAmp: 1.12,
    specialWeight: 1.1,
  },
  shakespeare: {
    id: "tragedy",
    label: "Tragedy or Farce",
    description: "Wild momentum swings — drama in every phase.",
    momentumAmp: 1.22,
    specialWeight: 1.15,
  },
  philosophers: {
    id: "dialectic",
    label: "Dialectic",
    description: "Patient build-up; fewer rash challenges.",
    pressBonus: -0.025,
    foulBias: -0.02,
  },
  "reality-tv": {
    id: "confessional",
    label: "Confessional",
    description: "Cards, fouls, and chaotic momentum.",
    foulBias: 0.05,
    momentumAmp: 1.28,
    specialWeight: 1.12,
  },
  "80s-action-heroes": {
    id: "oneliner",
    label: "One-Liner",
    description: "Shot power and direct play — passing optional.",
    shotXg: 0.035,
    pressBonus: 0.02,
  },
  "tech-billionaires": {
    id: "disruption",
    label: "Disruption",
    description: "Press-heavy chaos and opportunistic chances.",
    pressBonus: 0.035,
    shotXg: 0.015,
    momentumAmp: 1.1,
  },
  "nba-legends": {
    id: "highlight-reel",
    label: "Highlight Reel",
    description: "Athletic finishes and transition chances.",
    shotXg: 0.03,
    pressBonus: 0.02,
    momentumAmp: 1.08,
  },
  "cricket-legends": {
    id: "test-patience",
    label: "Test Patience",
    description: "Patient build-up; set-piece specialists.",
    setPieceXg: 0.03,
    pressBonus: -0.02,
  },
  "rugby-legends": {
    id: "gain-line",
    label: "Gain Line",
    description: "Physical duels and relentless pressing.",
    pressBonus: 0.03,
    foulBias: 0.02,
    shotXg: 0.015,
  },
  "nfl-legends": {
    id: "game-script",
    label: "Game Script",
    description: "Structured plays and explosive set pieces.",
    setPieceXg: 0.025,
    shotXg: 0.02,
  },
  dinosaurs: {
    id: "prehistoric",
    label: "Prehistoric Power",
    description: "Raw shot power and intimidating defending.",
    shotXg: 0.04,
    foulBias: 0.03,
  },
  mammals: {
    id: "pack-hunt",
    label: "Pack Hunt",
    description: "High press and pace on the break.",
    pressBonus: 0.035,
    shotXg: 0.015,
  },
  "reptiles-legends": {
    id: "cold-blood",
    label: "Cold Blood",
    description: "Patient defending; lethal counter chances.",
    pressBonus: -0.025,
    shotXg: 0.025,
    momentumAmp: 0.95,
  },
};

export function getUniverseTrait(universeId: string): UniverseTrait {
  return TRAITS[universeId] ?? DEFAULT_TRAIT;
}
