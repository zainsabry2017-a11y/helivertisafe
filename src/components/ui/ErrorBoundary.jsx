import React, { Component } from "react";

export class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error("ErrorBoundary:", error, info); }
  render() {
    if (this.state.error) {
      return React.createElement("div", { style: { padding: 16, background: "#0b1120", borderRadius: 8, border: "1px solid #ef444440", margin: 8 } },
        React.createElement("div", { style: { color: "#ef4444", fontSize: 12, fontWeight: 700, marginBottom: 4 } }, "⚠ " + (this.props.label || "Section") + " Error"),
        React.createElement("div", { style: { color: "#8896ab", fontSize: 10, marginBottom: 8 } }, this.state.error.message),
        React.createElement("button", { onClick: () => this.setState({ error: null }), style: { padding: "4px 12px", borderRadius: 4, fontSize: 10, background: "#1a2d4a", color: "#e1e7ef", border: "1px solid #2a3a52", cursor: "pointer" } }, "Retry")
      );
    }
    return this.props.children;
  }
}