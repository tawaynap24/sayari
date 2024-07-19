export type TEchoSet = "molten-rift";

export type TStatus =
  | "attack-percent"
  | "attack-flat"
  | "hp-percent"
  | "hp-flat"
  | "defense-percent"
  | "defense-flat"
  | "critical-rate"
  | "critical-dmg"
  | "energy-regen"
  | "bonus-basic-attack"
  | "bonus-heavy-attack"
  | "bonus-resonance-skill"
  | "bonus-resonance-liberation"
  | "bonus-fusion-element"
  | "bonus-havoc-element"
  | "bonus-glacio-element"
  | "bonus-physical-element"
  | "bonus-aero-element"
  | "bonus-electro-element"
  | "bonus-spectro-element"
  | "bonus-healing";

export type TCharacter = {
  name: string;
  image: string;
  rank: number;
  lv: number;
  hp: number;
  atk: number;
  def: number;
  criticalRate: number;
  criticalDmg: number;
  passive: {
    passiveType: TStatus;
    passiveValue: number;
  }[];
};

export type TWeapon = {
  rank: number;
  lv: number;
  atk: number;
  subType: TStatus;
  subStat: number;
};

export type TEcho = {
  set: TEchoSet;
  cost: number;
  mainType: TStatus;
  mainStat: number;
  subType: TStatus;
  subStat: number;
  subValue: {
    type: TStatus;
    value: number;
  }[];
};
