import Home from "../views/home";
import ZenlessZoneZero from "../views/games/zenless-zone-zero";

export const routeList = [
  {
    name: "home",
    path: "/",
    component: <Home />,
  },
  {
    name: "Zenless Zone Zero",
    path: "/game/zenless-zone-zero",
    component: <ZenlessZoneZero />,
  },
];
