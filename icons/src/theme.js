export function loadTheme(){
  try { return localStorage.getItem("ui_theme_v2") || "dark"; } catch(_) { return "dark"; }
}

export function saveTheme(val){
  try { localStorage.setItem("ui_theme_v2", val); } catch(_){}
  applyTheme();
}

export function applyTheme(){
  const t = loadTheme();
  document.documentElement.setAttribute("data-theme", t === "light" ? "light" : "dark");
}
