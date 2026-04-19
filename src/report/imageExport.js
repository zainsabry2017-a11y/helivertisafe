/**
 * PNG export + print helpers for Results UI (html2canvas + WebGL snapshots).
 */
import html2canvas from "html2canvas";

export function downloadDataUrl(dataUrl, filename) {
  if (!dataUrl || typeof dataUrl !== "string") return;
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename.replace(/[^\w.-]+/g, "_");
  a.click();
}

/**
 * Rasterize a DOM node (SVG, div, map container) to PNG data URL.
 */
export async function captureElementAsPng(el, options = {}) {
  if (!el) return null;
  try {
    const canvas = await html2canvas(el, {
      scale: options.scale ?? 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: options.backgroundColor ?? null,
      windowWidth: el.scrollWidth,
      windowHeight: el.scrollHeight,
    });
    return canvas.toDataURL("image/png");
  } catch (e) {
    console.warn("captureElementAsPng:", e);
    return null;
  }
}

/**
 * Print report block as image (avoids broken print when CSS is not in the new window).
 */
export async function printElementAsImage(el) {
  if (!el) return;
  try {
    const canvas = await html2canvas(el, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: "#ffffff",
      windowWidth: el.scrollWidth,
      windowHeight: el.scrollHeight,
    });
    const dataUrl = canvas.toDataURL("image/png");
    const w = window.open("");
    if (!w) {
      alert("Please allow pop-ups to print the report.");
      return;
    }
    const title = document.title || "Report";
    w.document.open();
    w.document.write(
      "<!DOCTYPE html><html><head><meta charset='utf-8'><title>" +
        title +
        "</title><style>@page{size:A4;margin:10mm}body{margin:0;background:#fff;display:flex;justify-content:center;-webkit-print-color-adjust:exact;print-color-adjust:exact}img{max-width:100%;height:auto}</style></head><body><img alt='Report' src='" +
        dataUrl +
        "' /></body></html>"
    );
    w.document.close();
    const img = w.document.querySelector("img");
    const runPrint = () => {
      setTimeout(() => {
        w.focus();
        w.print();
      }, 250);
    };
    if (img && !img.complete) img.onload = runPrint;
    else runPrint();
  } catch (e) {
    console.error("printElementAsImage:", e);
    alert("Print failed: " + (e.message || String(e)));
  }
}
