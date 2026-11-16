import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/archivo/wdth.css";
import { colourBlind, setColourBlind } from "./game/palette";
import { applyVegas, vegasOn } from "./game/vegasNight";
import { applyPlayerColour } from "./community";

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
// Las Vegas Grand Prix week: the neon night look (index.html already set it for the first paint)
applyVegas(vegasOn());
// the player colour a friend invite unlocked, over the page's own
applyPlayerColour();
// ?3d=1 turns the unreleased 3D lap on for this device; read here, before the app tidies the address (Play reads it)
try {
  if (new URLSearchParams(location.search).get("3d") === "1") localStorage.setItem("lapdle.3d", "1");
} catch {
  // private mode: no 3D preview
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// installable and playable offline in production builds
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => {}));
}
