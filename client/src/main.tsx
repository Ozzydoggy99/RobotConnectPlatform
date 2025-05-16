import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import App from "./App";
import "./index.css";

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
  try {
    const rootElement = document.getElementById("root");
    if (!rootElement) {
      console.error("Root element not found");
      return;
    }
    
    createRoot(rootElement).render(
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    );
    
    console.log("App successfully mounted");
  } catch (error) {
    console.error("Error mounting the application:", error);
  }
});
