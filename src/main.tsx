import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initTheme } from "./lib/nouri-theme";

initTheme();

createRoot(document.getElementById("root")!).render(<App />);
