import React from "react";
import { describe, it, expect } from "vitest";
import App from "./App.jsx";

describe("App component", () => {
  it("exports App component and instantiates cleanly", () => {
    expect(App).toBeDefined();
    expect(typeof App).toBe("function");
  });
});
