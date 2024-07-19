import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
// import Home from "../views/home";
import WuttheringWave from "../views/games/wutthering-wave";
import { Grid } from "@mui/material";

export default function MainRouter() {
  return (
    <>
      <Grid style={{ maxWidth:"1440px", minHeight: "100vh" }} p={4}>
        <Router>
          <Routes>
            <Route path="/" element={<WuttheringWave />} />
          </Routes>
        </Router>
      </Grid>
    </>
  );
}
