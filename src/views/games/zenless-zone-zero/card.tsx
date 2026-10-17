import { Grid, TextField, Typography } from "@mui/material";
import { useState } from "react";
import { TAgentStat } from "./type";

export default function Card(props: { data: TAgentStat }) {
  const { data } = props;
  const [monsterDef, setMonsterDef] = useState("");
  const [monsterResist, setMonsterResist] = useState("0");
  const [ingameDmg, setIngameDmg] = useState(data.ingameDmg || "0");

  const dmgCal = data.atk * (data.multiplier / 100) * (1 + data.bonus / 100);
  // *(1 + data.critDmg / 100);

  const levelFactor = 100 + 10 * data.lv;
  const monsterDefMultiplier = calFactor(Number(monsterDef));
  const monsterResistMultiplier = 1 - Number(monsterResist) / 100;

  function calPen(def: number) {
    return Math.max(def * (1 - data.penPercent / 100) - data.penBonus, 0);
  }
  function calFactor(def: number) {
    return levelFactor / (calPen(Number(def)) + levelFactor);
  }

  const defCalRevert =
    (levelFactor /
      ((Number(ingameDmg) || 1) / (dmgCal * monsterResistMultiplier)) -
      levelFactor +
      data.penBonus) /
    (1 - data.penPercent / 100);

  const monsterDefMultiplierFix = calFactor(defCalRevert);

  const finalCal = dmgCal * monsterDefMultiplier * monsterResistMultiplier;

  console.log(finalCal);

  return (
    <Grid
      style={{
        background:
          data.element === "physical"
            ? "lightyellow"
            : data.element === "ice"
            ? "lightblue"
            : data.element === "fire"
            ? "#ffbbbb"
            : "lightpink",
      }}
      className="default-card"
    >
      <Grid container spacing={2}>
        <Grid xs={6} item>
          <Typography>Element: {data.element}</Typography>
          <Typography>Name: {data.name}</Typography>
          <Typography>LV: {data.lv}</Typography>
          {/* <Typography>Lv Factor: {levelFactor}</Typography> */}
          <Typography>Atk: {data.atk}</Typography>
          <Typography>CritDmg: {data.critDmg}</Typography>
          <Typography>PenPercent: {data.penPercent}</Typography>
          <Typography>PenBonus: {data.penBonus}</Typography>
          <Typography>DmgBonus: {data.bonus}</Typography>
          <Typography>
            Multipler: {Math.round(data.multiplier) / 100}
          </Typography>
          <Typography>DmgCal: {dmgCal.toFixed(0)}</Typography>
          <Typography>
            CritDmgCal: {(dmgCal * (1 + data.critDmg / 100)).toFixed(0)}
          </Typography>
        </Grid>
        <Grid xs={6} item>
          <Grid>
            <Typography>Resistance</Typography>
            <TextField
              value={monsterResist || ""}
              InputProps={{
                style: {
                  background: "#eee",
                },
              }}
              onChange={(e) =>
                setMonsterResist(e.target.value.replace(/[^\d.-]/, ""))
              }
            />
            <Typography>Def</Typography>
            <TextField
              value={monsterDef || ""}
              InputProps={{
                style: {
                  background: "#eee",
                },
              }}
              onChange={(e) =>
                setMonsterDef(e.target.value.replace(/[^\d.]/, ""))
              }
            />
          </Grid>
          <Grid>
            <TextField
              InputProps={{
                style: {
                  background: "#eee",
                },
              }}
              value={defCalRevert.toFixed(2) || ""}
              disabled
            />
          </Grid>
          <Typography>
            Mons Def Mul: {calFactor(Number(monsterDef)).toFixed(2)}
          </Typography>
          <Typography>Mons Resist Mul: {monsterResistMultiplier}</Typography>
        </Grid>
        <Grid xs={12} item>
          {/* <Typography>
            DMG = Base DMG × DMG Bonus Multiplier × CRIT Multiplier × DEF
            Multiplier × RES Multiplier × DMG Taken Multiplier × Stunned
            Multiplier
          </Typography> */}
          <Typography color="green">
            diff: {(dmgCal - Number(ingameDmg)).toFixed(2)}
          </Typography>
          <Grid className="flex-between-center">
            <TextField
              value={`${ingameDmg} - ${
                Math.round(Number(ingameDmg) * (1 + data.critDmg / 100) * 100) /
                100
              }`}
              InputProps={{
                style: {
                  background: "#eee",
                },
              }}
              onChange={(e) => {
                setIngameDmg(e.target.value.replace(/[^\d.]/, ""));
              }}
            />
            <Typography color="green">
              Mons Def Mul Fix: {monsterDefMultiplierFix.toFixed(2)}
            </Typography>
          </Grid>
        </Grid>
      </Grid>
    </Grid>
  );
}
