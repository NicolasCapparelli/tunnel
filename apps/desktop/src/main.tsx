import React from "react";
import { createRoot } from "react-dom/client";
import { AuroraProvider } from "@aurora/react";
import {
  contract,
  themes,
  themeSelection,
  restoreTheme,
} from "@tunnel/shared/theme";
import App from "./App";
import "./style.css";
let saved: unknown;
try {
  saved = JSON.parse(localStorage.getItem("tunnel-theme") ?? "null");
} catch {
  saved = null;
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuroraProvider
      contract={contract}
      themes={themes}
      initialSelection={themeSelection(restoreTheme(saved))}
      fallback="preferred"
      cssVariables="root"
    >
      <App />
    </AuroraProvider>
  </React.StrictMode>,
);
