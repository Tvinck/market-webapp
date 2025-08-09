function escapeHTML(text) {
  return String(text || '').replace(/[&<>"']/g, function (c) {
    return ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[c];
  });
}

export { escapeHTML };

if (typeof module !== 'undefined') {
  module.exports = { escapeHTML };
}
