import React from "react";
import ReactDOM from "react-dom/client";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { registerSW } from "virtual:pwa-register";
import { App } from "./App";
import { StoreProvider } from "./store/store";

if (import.meta.env.PROD) {
  registerSW({ immediate: true });
}

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={clientId ?? ""}>
      <StoreProvider>
        <App />
      </StoreProvider>
    </GoogleOAuthProvider>
  </React.StrictMode>
);
