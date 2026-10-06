import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/archivo/wdth.css";
import { colourBlind, setColourBlind } from "./game/palette";

import "./index.css";
import { App } from "./App";
import { initAnalytics } from "./analytics";
import { visit } from "./games/events";
// catch the browser's install offer before anything else can miss it
import "./install";
initAnalytics();
visit();
// apply the saved timing palette before the first paint
setColourBlind(colourBlind());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// installable and playable offline in production builds
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}
