import { Button, Grid, MenuItem, TextField, Typography } from "@mui/material";
import React, { useEffect, useState } from "react";
import {
  bonusSelectList,
  echoList,
  mainEchoStat1,
  mainEchoStat3,
  mainEchoStat4,
  subSelectList,
} from "./data";
import { TStatus } from "./type";
// import { Wutthering } from "../../../api/global/api";

export default function WuttheringWave() {
  const [stats, setStats] = useState({
    character: {
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
    weapon: {
      rank: 5,
      lv: 80,
      atk: 516,
      subType: "critical-rate",
      subStat: 22.1,
    },
    echo: echoList,
  });
  const [skillPercent, setSkillPercent] = useState(48.46);
  const [ratio, setRatio] = useState(0.46);
  const [finalDmgIngame, setFinalDmgIngame] = useState(734);
  // const [character, setCharacter] = useState({
  //   name: "chixia",
  //   logo: "",
  // });
  const baseAtk = stats.character.atk + stats.weapon.atk;
  const finalAtk =
    baseAtk * (1 + getStatus("attack-percent") / 100) +
    getStatus("attack-flat");
  // const [logHistory, setLogHistory] = useState({
  //   time: "",
  //   content: "",
  // });

  const dmg = (finalAtk * skillPercent) / 100;
  const dmgBonus =
    dmg *
    (1 +
      (getStatus("bonus-basic-attack") + getStatus("bonus-fusion-element")) /
        100);
  // const finalBasic = 85;

  // const fullHeavy = (finalAtk * skillData.fullHeavy) / 100;
  // const fullHeavyBonus =
  //   fullHeavy *
  //   (1 +
  //     (getStatus("bonus-heavy-attack") + getStatus("bonus-fusion-element")) /
  //       100);
  // const finalFullHeavy = 104;
  // const finalFullHeavy = 916;
  // const ratioHeavy = finalFullHeavy / fullHeavyBonus;

  // const dmgCrit = (dmg * getStatus("critical-dmg")) / 100;
  // const finalBasicCrit = 128;
  // const finalBasicCrit = 1559;

  // const fullHeavyCrit = (dmg * getStatus("critical-dmg")) / 100;
  // const finalFullHeavyCrit = 155;
  // const finalFullHeavyCrit = 1945;

  function getStatus(type: TStatus) {
    const initialStat =
      type === "critical-rate"
        ? stats.character.criticalRate
        : type === "critical-dmg"
        ? stats.character.criticalDmg
        : type === "bonus-fusion-element"
        ? 10
        : 0;
    const weapon = getWeaponSubStat(type);
    const echoList = stats.echo.map((echo) => {
      const main = echo.mainType === type ? echo.mainStat : 0;
      const subStat = echo.subType === type ? echo.subStat : 0;
      const subValue = echo.subValue
        .map((s) => (s.type === type ? s.value || 0 : 0))
        .reduce((p, c) => p + c);
      return main + subStat + subValue;
    });
    const echo = echoList.length ? echoList.reduce((p, c) => p + c) : 0;
    const skillList = stats.character.passive.map((p) => {
      return p.passiveType === type ? p.passiveValue || 0 : 0;
    });
    const skill = skillList.length ? skillList.reduce((p, c) => p + c) : 0;

    return initialStat + weapon + echo + skill;
  }

  function getWeaponSubStat(type: TStatus) {
    const weapon = stats.weapon.subType === type ? stats.weapon.subStat : 0;
    return weapon;
  }

  useEffect(() => {
    getAPI();
  }, []);

  const getAPI = async () => {
    try {
      // const resName = await Wutthering.getResonatorName();
      // const resData = await Wutthering.getResonatorData("chixia");
      // const resLogo = await Wutthering.getResonatorLogo("chixia");
      // console.log(resLogo);
      // setCharacter((prev) => ({ ...prev, logo: resLogo }));
    } catch (err) {
      /* empty */
    }
  };
  return (
    <Grid container spacing={2}>
      <Grid xs={12} item>
        <Typography>Character</Typography>
      </Grid>
      <Grid xs={12} item>
        <Grid container spacing={2}>
          <Grid xs={4} item className="flex-start-center" gap={1}>
            <Typography style={{ minWidth: "50px" }}>Atk :</Typography>
            <TextField
              size="small"
              style={{ background: "white" }}
              type="number"
              value={stats.character.atk}
              fullWidth
              onChange={(e) => {
                setStats((prev) => ({
                  ...prev,
                  character: {
                    ...prev.character,
                    atk: Number(Number(e.target.value).toFixed(2)),
                  },
                }));
              }}
            />
          </Grid>
          <Grid xs={4} item className="flex-start-center" gap={1}>
            <Typography>Critical Rate :</Typography>
            <Typography>{stats.character.criticalRate}</Typography>
          </Grid>
          <Grid xs={4} item className="flex-start-center" gap={1}>
            <Typography>Critical Dmg :</Typography>
            <Typography>{stats.character.criticalDmg}</Typography>
          </Grid>
          {stats.character.passive.map((item, index) => {
            return (
              <Grid key={index} xs={3} item>
                <TextField
                  style={{ background: "white" }}
                  select
                  value={item.passiveType}
                  fullWidth
                  onChange={(e) => {
                    setStats((prev) => {
                      const newPassive = [...prev.character.passive];
                      newPassive[index].passiveType = e.target.value;
                      return {
                        ...prev,
                        character: {
                          ...prev.character,
                          passive: [...newPassive],
                        },
                      };
                    });
                  }}
                >
                  {bonusSelectList.map((item, index) => (
                    <MenuItem key={index} value={item.id}>
                      {item.label}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  style={{ background: "white" }}
                  value={item.passiveValue}
                  select
                  fullWidth
                  onChange={(e) => {
                    setStats((prev) => {
                      const newPassive = [...prev.character.passive];
                      newPassive[index].passiveValue = Number(e.target.value);
                      return {
                        ...prev,
                        character: {
                          ...prev.character,
                          passive: [...newPassive],
                        },
                      };
                    });
                  }}
                >
                  <MenuItem value={0}>เลือกโบนัส</MenuItem>
                  <MenuItem value={1.8}>{1.8}</MenuItem>
                  <MenuItem value={4.2}>{4.2}</MenuItem>
                </TextField>
              </Grid>
            );
          })}
        </Grid>
      </Grid>
      <Grid xs={12} item>
        <Typography>Weapon</Typography>
      </Grid>
      <Grid xs={12} item>
        <Grid container spacing={2}>
          <Grid xs={4} item className="flex-start-center" gap={1}>
            <Typography>Atk :</Typography>
            <TextField
              size="small"
              style={{ background: "white" }}
              type="number"
              value={stats.weapon.atk}
              onChange={(e) => {
                setStats((prev) => ({
                  ...prev,
                  weapon: {
                    ...prev.weapon,
                    atk: Number(Number(e.target.value).toFixed(2)),
                  },
                }));
              }}
            />
          </Grid>
          <Grid xs={4} item>
            <TextField
              style={{ background: "white" }}
              select
              value={stats.weapon.subType}
              fullWidth
              onChange={(e) => {
                setStats((prev) => {
                  return {
                    ...prev,
                    weapon: {
                      ...prev.weapon,
                      subType: e.target.value,
                    },
                  };
                });
              }}
            >
              <MenuItem value={"other"}>เลือกโบนัส</MenuItem>
              <MenuItem value={"attack-percent"}>Attack (%)</MenuItem>
              <MenuItem value={"critical-rate"}>Critical Rate</MenuItem>
              <MenuItem value={"critical-dmg"}>Critical Dmg</MenuItem>
            </TextField>
            <TextField
              style={{ background: "white" }}
              value={stats.weapon.subStat}
              fullWidth
              onChange={(e) => {
                setStats((prev) => {
                  return {
                    ...prev,
                    weapon: {
                      ...prev.weapon,
                      subStat: Number(e.target.value),
                    },
                  };
                });
              }}
            />
          </Grid>
        </Grid>
      </Grid>
      <Grid xs={12} item>
        <Typography>Echo</Typography>
      </Grid>
      <Grid xs={12} item>
        <Grid container spacing={2}>
          {stats.echo.map((item, index) => {
            return (
              <Grid key={index} xs={4} item>
                <Grid container spacing={1}>
                  <Grid xs={12} item className="flex-start-center" gap={1}>
                    <Typography style={{ minWidth: "50px" }}>Cost :</Typography>
                    <TextField
                      style={{ background: "white" }}
                      type="number"
                      value={item.cost}
                      fullWidth
                      onChange={(e) => {
                        setStats((prev) => {
                          const newEcho = [...prev.echo];
                          newEcho[index].cost = Number(e.target.value);
                          newEcho[index].mainStat = 0;
                          newEcho[index].subStat = 0;
                          return {
                            ...prev,
                            echo: [...newEcho],
                          };
                        });
                      }}
                    />
                  </Grid>
                  <Grid xs={12} item>
                    <TextField
                      style={{ background: "white" }}
                      select
                      value={item.mainType}
                      fullWidth
                      onChange={(e) => {
                        const findStat = (
                          item.cost === 4
                            ? mainEchoStat4
                            : item.cost === 3
                            ? mainEchoStat3
                            : mainEchoStat1
                        ).find((m) => m.id === e.target.value);
                        setStats((prev) => {
                          const newEcho = [...prev.echo];
                          newEcho[index].mainType =
                            findStat?.id as "attack-percent";
                          newEcho[index].mainStat = findStat?.value || 0;
                          newEcho[index].subStat =
                            item.cost === 4 ? 150 : item.cost === 3 ? 100 : 0;
                          return {
                            ...prev,
                            echo: [...newEcho],
                          };
                        });
                      }}
                    >
                      {(item.cost === 4
                        ? mainEchoStat4
                        : item.cost === 3
                        ? mainEchoStat3
                        : mainEchoStat1
                      ).map((item, index) => {
                        return (
                          <MenuItem key={index} value={item.id}>
                            {item.label} ({item.value})
                          </MenuItem>
                        );
                      })}
                    </TextField>
                  </Grid>
                  {item.subValue.map((subItem, subIndex) => {
                    return (
                      <React.Fragment key={subIndex}>
                        <Grid xs={6} item>
                          <TextField
                            style={{ background: "white" }}
                            select
                            value={subItem.type}
                            fullWidth
                            onChange={(e) => {
                              setStats((prev) => {
                                const newEcho = [...prev.echo];
                                newEcho[index].subValue[subIndex].type = e
                                  .target.value as "attack-percent";
                                return {
                                  ...prev,
                                  echo: [...newEcho],
                                };
                              });
                            }}
                          >
                            {subSelectList.map((item, index) => {
                              return (
                                <MenuItem key={index} value={item.id}>
                                  {item.label}
                                </MenuItem>
                              );
                            })}
                          </TextField>
                        </Grid>
                        <Grid xs={6} item>
                          <TextField
                            style={{ background: "white" }}
                            type="number"
                            value={subItem.value}
                            fullWidth
                            onChange={(e) => {
                              setStats((prev) => {
                                const newEcho = [...prev.echo];
                                newEcho[index].subValue[subIndex].value =
                                  Number(e.target.value);
                                return {
                                  ...prev,
                                  echo: [...newEcho],
                                };
                              });
                            }}
                          />
                        </Grid>
                      </React.Fragment>
                    );
                  })}
                </Grid>
              </Grid>
            );
          })}
        </Grid>
      </Grid>
      <Grid xs={6} item>
        <Grid container spacing={2}>
          <Grid xs={12} item>
            <Typography>base-atk: {baseAtk}</Typography>
          </Grid>
          <Grid xs={12} item>
            <Typography>atk-percent: {getStatus("attack-percent")}</Typography>
          </Grid>
          <Grid xs={12} item>
            <Typography>atk-flat: {getStatus("attack-flat")}</Typography>
          </Grid>
          <Grid xs={12} item>
            <Typography>ATK: {finalAtk.toFixed(2)}</Typography>
          </Grid>
          <Grid xs={12} item>
            <Typography>
              Critical-Rate: {getStatus("critical-rate")}%
            </Typography>
          </Grid>
          <Grid xs={12} item>
            <Typography>
              Critical-Dmg: {getStatus("critical-dmg").toFixed(2)}%
            </Typography>
          </Grid>
          <Grid xs={12} item>
            <Typography>
              Bonus-Resonance-Skill:{" "}
              {getStatus("bonus-resonance-skill").toFixed(2)}%
            </Typography>
          </Grid>
          <Grid xs={12} item>
            <Typography>
              Bonus-Basic-Attack: {getStatus("bonus-basic-attack").toFixed(2)}%
            </Typography>
          </Grid>
          <Grid xs={12} item>
            <Typography>
              Bonus-Heavy-Attack: {getStatus("bonus-heavy-attack").toFixed(2)}%
            </Typography>
          </Grid>
          <Grid xs={12} item>
            <Typography>
              Bonus-Resonance-Liberation:{" "}
              {getStatus("bonus-resonance-liberation").toFixed(2)}%
            </Typography>
          </Grid>
          <Grid xs={12} item>
            <Typography>
              Bonus-Fusion: {getStatus("bonus-fusion-element").toFixed(2)}%
            </Typography>
          </Grid>
        </Grid>
      </Grid>
      <Grid xs={6} item>
        <Grid container spacing={2}>
          <Grid xs={12} item className="flex-start-center" gap={1}>
            <Typography>BasicSkillData</Typography>
            <TextField
              style={{ background: "white" }}
              type="number"
              value={skillPercent}
              onChange={(e) => {
                setSkillPercent(Number(e.target.value));
              }}
            />
          </Grid>
          <Grid xs={12} item className="flex-start-center" gap={1}>
            <Typography>DPS {dmg.toFixed(2)}</Typography>
          </Grid>
          <Grid xs={12} item className="flex-start-center" gap={1}>
            <Typography>
              Bonus{" "}
              {(
                getStatus("bonus-basic-attack") +
                getStatus("bonus-fusion-element")
              ).toFixed(2)}
              %
            </Typography>
          </Grid>
          <Grid xs={12} item className="flex-start-center" gap={1}>
            <Typography>DPS with Bonus {dmgBonus.toFixed(2)}</Typography>
          </Grid>
          <Grid xs={12} item className="flex-start-center" gap={1}>
            <Typography>
              ratio {finalDmgIngame / dmgBonus}
              {/* resistance {((dmg / finalBasic - 1) * 100).toFixed(2)} */}
            </Typography>
          </Grid>
          <Grid xs={12} item className="flex-start-center" gap={1}>
            <Typography style={{ background: "green" }}>
              Final Cal: {(dmgBonus * ratio).toFixed(2)} ({ratio.toFixed(2)})
            </Typography>
          </Grid>
          <Grid xs={12} item className="flex-start-center" gap={1}>
            <Typography style={{ background: "blue" }}>
              Final In-game:
            </Typography>
            <TextField
              style={{ background: "white" }}
              type="number"
              value={finalDmgIngame}
              onChange={(e) => {
                setFinalDmgIngame(Number(e.target.value));
              }}
            />
          </Grid>
          <Grid xs={12} item>
            <Button
              variant="contained"
              onClick={() => {
                setRatio(finalDmgIngame / dmgBonus);
              }}
            >
              <Typography>Complie Ratio</Typography>
            </Button>
          </Grid>
        </Grid>
      </Grid>
    </Grid>
  );
}
