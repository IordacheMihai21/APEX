import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/archivo/wdth.css";
import { colourBlind, setColourBlind } from "./game/palette";

import "./index.css";
import { App } from "./App";
// apply the saved timing palette before the first paint
setColourBlind(colourBlind());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
