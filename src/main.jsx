import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import { AppCompositor } from "./compositor/AppCompositor.jsx";
import { ActionProvider } from "./components/ui.jsx";
import "./index.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AppCompositor>
        <ActionProvider>
          <App />
        </ActionProvider>
      </AppCompositor>
    </BrowserRouter>
  </StrictMode>,
);
