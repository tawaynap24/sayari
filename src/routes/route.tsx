import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
import Home from "../views/home";
import Menu from "../views/menu";
import WuttheringWave from "../views/games/wutthering-wave";
import { Grid } from "@mui/material";

export default function MainRouter() {
  return (
    <>
      <Grid style={{ maxWidth:"1440px", minHeight: "100vh" }} p={4}>
        <Router>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/menu" element={<Menu />} />
            <Route path="/game/wutthering-wave" element={<WuttheringWave />} />
          </Routes>
        </Router>
      </Grid>
    </>
  );
}
