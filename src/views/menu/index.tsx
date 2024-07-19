import { Grid, Typography } from "@mui/material";
// import { useNavigate } from "react-router-dom";

export default function Menu() {
//   const navigate = useNavigate();

  return (
    <Grid container spacing={2}>
      <Grid xs={12} item>
        <Typography
          onClick={() => {
            // navigate("/")
            window.location.assign("/game/wutthering-wave");
          }}
        >
          Home
        </Typography>
      </Grid>
    </Grid>
  );
}
