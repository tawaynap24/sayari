export interface TAgentStat {
  name: string;
  element: "physical" | "ice" | "ligntning" | "fire" | "ether";
  lv: number;
  atk: number;
  critRate: number;
  critDmg: number;
  penPercent: number;
  penBonus: number;
  bonus: number;
  multiplier: number;
  ingameDmg?: number;
}
