import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";

import "../excalidraw-app/sentry";

import ExcalidrawApp from "./App";
import { initTauri } from "./tauri-custom";
import { SettingsPage } from "./tauri-custom/settings-page";

// Initialize Tauri if running in desktop mode
initTauri();

window.__EXCALIDRAW_SHA__ = import.meta.env.VITE_APP_GIT_SHA;
const rootElement = document.getElementById("root")!;
const root = createRoot(rootElement);
registerSW();

// 检查是否是设置页面路由
const isSettingsPage = window.location.hash === "#/settings";

if (isSettingsPage) {
  // 为设置页面添加特殊的 body class
  document.body.classList.add("settings-page");
  root.render(
    <StrictMode>
      <SettingsPage />
    </StrictMode>,
  );
} else {
  root.render(
    <StrictMode>
      <ExcalidrawApp />
    </StrictMode>,
  );
}
