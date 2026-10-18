import Home from '../views/home';
import ZenlessZoneZero from '../views/games/zenless-zone-zero';
import DatabaseRoute from '../views/games/zenless-zone-zero/database/route';

export const routeList = [
  { name: 'home', path: '/', component: <Home /> },
  { name: 'Zenless Zone Zero', path: '/game/zenless-zone-zero', component: <ZenlessZoneZero /> },
  { name: 'ฐานข้อมูล Zenless Zone Zero', path: '/game/zenless-zone-zero/database', component: <DatabaseRoute /> },
];
