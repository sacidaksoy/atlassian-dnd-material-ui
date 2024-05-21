import { Box } from "@mui/material";
import { GridItem } from "./components/grid-item";
import { Uploader } from "./components/image-upload";
import ListExample from "./components/item-list";

export default function App() {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "16px",
      }}
    >
      <GridItem />
      <Uploader />
      <ListExample />
    </Box>
  );
}
