import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import UpdaterWindow from "./components/UpdaterWindow";
import "./index.css";
import { ProfileProvider } from "./profiles/ProfileProvider";
import { StudioProvider } from "./studio/StudioProvider";

const rootElement = document.getElementById("root");
const isUpdaterWindow =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("window") === "updater";

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    isUpdaterWindow ? (
      <React.StrictMode>
        <UpdaterWindow />
      </React.StrictMode>
    ) : (
      <React.StrictMode>
        <StudioProvider>
          <ProfileProvider>
            <App />
          </ProfileProvider>
        </StudioProvider>
      </React.StrictMode>
    ),
  );
}
