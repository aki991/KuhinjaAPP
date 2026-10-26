import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";
import "./elevation.css";
import "./kitchen-fullscreen.css";
import "./opening.css";
import "./kitchen-actions.css";
import "./layout-drag.css";
import "./wood-theme.css";
import "./elevation-detail.css";
import "./appearance.css";
import { registerSW } from "virtual:pwa-register";
registerSW({
  onOfflineReady() {
    window.dispatchEvent(new Event("offline-ready"));
  },
});
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
