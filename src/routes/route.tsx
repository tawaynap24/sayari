import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
import { Grid } from "@mui/material";
import { routeList } from "./routeList";

export default function MainRouter() {
  return (
    <>
      <Grid style={{ minHeight: "100vh" }} p={4}>
        <Router>
          <Routes>
            {routeList.map((item, index) => {
              return (
                <Route key={index} path={item.path} element={item.component} />
              );
            })}
          </Routes>
        </Router>
      </Grid>
    </>
  );
}
