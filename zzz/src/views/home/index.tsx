import { Grid, Typography } from "@mui/material";
import { routeList } from "../../routes/routeList";
import { useNavigate } from "react-router-dom";

export default function Home() {
  const navigate = useNavigate();
  return (
    <Grid width="100%" minHeight="100vh" className="flex-center-center">
      <Grid className="default-card">
        <Grid container spacing={2}>
          {routeList
            .filter((r) => r.name !== "home")
            .map((item, index) => {
              return (
                <Grid key={index} xs={12} item>
                  <Grid
                    style={{
                      cursor: "pointer",
                    }}
                    onClick={() => {
                      navigate(item.path);
                    }}
                  >
                    <Typography fontSize="40px" fontWeight={700}>
                      {item.name}
                    </Typography>
                  </Grid>
                </Grid>
              );
            })}
        </Grid>
      </Grid>
    </Grid>
  );
}
