import { TCharacter, TEcho, TWeapon } from "./type";

export const characterList: TCharacter[] = [
  {
    name: "Chixia",
    image: "",
    rank: 5,
    lv: 80,
    hp: 7990,
    atk: 267,
    def: 838,
    criticalRate: 5,
    criticalDmg: 150,
    passive: [
      {
        passiveType: "attack-percent",
        passiveValue: 1.8,
      },
      {
        passiveType: "attack-percent",
        passiveValue: 4.2,
      },
      {
        passiveType: "attack-percent",
        passiveValue: 1.8,
      },
      {
        passiveType: "attack-percent",
        passiveValue: 4.2,
      },
      {
        passiveType: "bonus-fusion-element",
        passiveValue: 1.8,
      },
      {
        passiveType: "bonus-fusion-element",
        passiveValue: 4.2,
      },
      {
        passiveType: "bonus-fusion-element",
        passiveValue: 1.8,
      },
      {
        passiveType: "bonus-fusion-element",
        passiveValue: 4.2,
      },
    ],
  },
];

export const weaponList: TWeapon[] = [
  {
    rank: 5,
    lv: 80,
    atk: 516,
    subType: "critical-rate",
    subStat: 22.1,
  },
  {
    rank: 1,
    lv: 1,
    atk: 20,
    subType: "attack-percent",
    subStat: 6.5,
  },
];

export const echoList: TEcho[] = [
  {
    set: "molten-rift",
    cost: 4,
    mainType: "critical-rate",
    mainStat: 22,
    subType: "attack-flat",
    subStat: 150,
    subValue: [
      {
        type: "bonus-resonance-liberation",
        value: 9.4,
      },
      {
        type: "hp-percent",
        value: 9.4,
      },
      {
        type: "bonus-basic-attack",
        value: 10.9,
      },
      {
        type: "attack-percent",
        value: 8.6,
      },
      {
        type: "energy-regen",
        value: 9.2,
      },
    ],
  },
  {
    set: "molten-rift",
    cost: 3,
    mainType: "bonus-fusion-element",
    mainStat: 30,
    subType: "attack-flat",
    subStat: 100,
    subValue: [
      {
        type: "bonus-resonance-liberation",
        value: 9.4,
      },
      {
        type: "bonus-resonance-skill",
        value: 8.6,
      },
      {
        type: "critical-dmg",
        value: 12.6,
      },
      {
        type: "hp-percent",
        value: 7.9,
      },
      {
        type: "attack-flat",
        value: 40,
      },
    ],
  },
  {
    set: "molten-rift",
    cost: 3,
    mainType: "bonus-fusion-element",
    mainStat: 30,
    subType: "attack-flat",
    subStat: 100,
    subValue: [
      {
        type: "bonus-resonance-liberation",
        value: 10.1,
      },
      {
        type: "critical-dmg",
        value: 12.6,
      },
      {
        type: "bonus-resonance-skill",
        value: 10.1,
      },
      {
        type: "bonus-heavy-attack",
        value: 7.9,
      },
      {
        type: "defense-flat",
        value: 60,
      },
    ],
  },
  {
    set: "molten-rift",
    cost: 1,
    mainType: "attack-percent",
    mainStat: 18,
    subType: "hp-flat",
    subStat: 2280,
    subValue: [
      {
        type: "bonus-resonance-skill",
        value: 9.4,
      },
      {
        type: "energy-regen",
        value: 8.4,
      },
      {
        type: "bonus-resonance-liberation",
        value: 9.4,
      },
      {
        type: "attack-percent",
        value: 11.6,
      },
      {
        type: "critical-dmg",
        value: 17.4,
      },
    ],
  },
  {
    set: "molten-rift",
    cost: 1,
    mainType: "attack-percent",
    mainStat: 18,
    subType: "hp-flat",
    subStat: 2280,
    subValue: [
      {
        type: "critical-dmg",
        value: 19.8,
      },
      {
        type: "critical-rate",
        value: 8.1,
      },
      {
        type: "defense-percent",
        value: 10,
      },
      {
        type: "bonus-resonance-liberation",
        value: 7.9,
      },
      {
        type: "bonus-heavy-attack",
        value: 7.9,
      },
    ],
  },
];

export const bonusSelectList = [
  {
    id: "default-select",
    label: "เลือกโบนัส",
  },
  {
    id: "attack-percent",
    label: "Attack(%)",
  },
  {
    id: "bonus-fusion-element",
    label: "Fusion",
  },
  {
    id: "bonus-havoc-element",
    label: "Havoc",
  },
  {
    id: "bonus-glacio-element",
    label: "Glacio",
  },
  {
    id: "bonus-aero-element",
    label: "Aero",
  },
  {
    id: "bonus-spectro-element",
    label: "Spectro",
  },
  {
    id: "bonus-electro-element",
    label: "Electro",
  },
  {
    id: "bonus-physical-element",
    label: "Physical",
  },
];

export const mainEchoStat4 = [
  {
    id: "default-select",
    label: "เลือก status หลัก",
    value: 0,
  },
  {
    id: "attack-percent",
    label: "Attack(%)",
    value: 33,
  },
  {
    id: "critical-rate",
    label: "Critical Rate",
    value: 22,
  },
  {
    id: "critical-dmg",
    label: "Critical Dmg",
    value: 44,
  },
];

export const mainEchoStat3 = [
  {
    id: "default-select",
    label: "เลือก status หลัก",
    value: 0,
  },
  {
    id: "attack-percent",
    label: "Attack(%)",
    value: 33,
  },
  {
    id: "bonus-fusion-element",
    label: "Fusion",
    value: 30,
  },
  {
    id: "bonus-havoc-element",
    label: "Havoc",
    value: 30,
  },
  {
    id: "bonus-glacio-element",
    label: "Glacio",
    value: 30,
  },
  {
    id: "bonus-aero-element",
    label: "Aero",
    value: 30,
  },
  {
    id: "bonus-spectro-element",
    label: "Spectro",
    value: 30,
  },
  {
    id: "bonus-electro-element",
    label: "Electro",
    value: 30,
  },
  {
    id: "bonus-physical-element",
    label: "Physical",
    value: 30,
  },
];

export const mainEchoStat1 = [
  {
    id: "attack-percent",
    label: "Attack(%)",
    value: 18,
  },
];

export const subSelectList = [
  {
    id: "default-select",
    label: "เลือกโบนัส",
  },
  {
    id: "attack-percent",
    label: "Attack(%)",
  },
  {
    id: "attack-flat",
    label: "Attack(flat)",
  },
  {
    id: "critical-rate",
    label: "Critical Rate",
  },
  {
    id: "critical-dmg",
    label: "Critical Dmg",
  },
  {
    id: "energy-regen",
    label: "Energy Regen",
  },
  {
    id: "bonus-basic-attack",
    label: "Bonus Basic Attack",
  },
  {
    id: "bonus-heavy-attack",
    label: "Bonus Heavy Attack",
  },
  {
    id: "bonus-resonance-skill",
    label: "Bonus Resonance Skill",
  },
  {
    id: "bonus-resonance-liberation",
    label: "Bonus Resonance Liberation",
  },
  {
    id: "hp-percent",
    label: "HP(%)",
  },
  {
    id: "hp-flat",
    label: "HP(flat)",
  },
  {
    id: "defense-percent",
    label: "Def(%)",
  },
  {
    id: "defense-flat",
    label: "Def(flat)",
  },
];
