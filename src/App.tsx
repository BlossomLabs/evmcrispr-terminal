import React from "react";

import { version } from "@1hive/evmcrispr/package.json";

import { Main } from "./components";

function App() {
  return (
    <div className="App" style={{ maxWidth: 1200, margin: "auto" }}>
      <h1>evm-crispr terminal v{version}</h1>
      <Main />
    </div>
  );
}

export default App;
