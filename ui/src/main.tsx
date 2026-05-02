import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { PrivyProvider } from "@privy-io/react-auth";
import App from "./App";
import "./styles/globals.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <PrivyProvider
      appId={import.meta.env.VITE_PRIVY_APP_ID}
      config={{
        appearance: {
          theme: "dark",
          accentColor: "#FF3300",
        },
        embeddedWallets: {
          createOnLogin: "users-without-wallets",
        },
      }}
    >
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </PrivyProvider>
  </React.StrictMode>
);
