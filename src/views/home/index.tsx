import { Grid, Typography } from "@mui/material";
// import { useNavigate } from "react-router-dom";

export default function Home() {
  // const navigate = useNavigate();
  return (
    <Grid container spacing={2}>
      <Grid xs={12} item>
        <Typography
          onClick={() => {
            // navigate("/menu");
            window.location.assign("/game/wutthering-wave");
          }}
        >
          Menu
        </Typography>
      </Grid>
    </Grid>
  );
}
