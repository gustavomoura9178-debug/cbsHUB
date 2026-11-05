import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { StudioProvider } from "./studio/StudioProvider";

const rootElement = document.getElementById("root");

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <StudioProvider>
        <App />
      </StudioProvider>
    </React.StrictMode>,
  );
}
