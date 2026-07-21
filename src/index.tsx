import React from "react";
import { createRoot } from "react-dom/client";
import "./style/partial/normalize.scss";
import "./util/i18n";
import App from "./component/App";

window.onerror = null;

const container = document.getElementById("app");
if (container) {
    createRoot(container).render(<App />);
}
