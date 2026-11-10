import { Modularize } from "@lib-core-mfe/module-frontend/client";
import styles from "./App.module.css?inline";
import Root from "./Root";

const styleElement = document.createElement("style");
styleElement.dataset.moduleStyles = "mfe-activity";
styleElement.textContent = styles;
document.head.append(styleElement);

export default Modularize("activity", Root, { appName: "mfe-activity" });
