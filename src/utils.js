export function escapeHTML(text) {
  return (text || "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[c]);
}

// CommonJS compatibility for server-side usage
if (typeof module !== 'undefined') {
  module.exports = { escapeHTML };
}
