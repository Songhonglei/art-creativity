// 在样式加载前恢复主题，避免刷新时闪回深色；偏好与游戏存档独立保存。
window.Theme = (function () {
  const KEY = "niuma_theme";
  const options = Object.freeze([
    { id: "dark", name: "深色", icon: "☾", note: "深夜办公室", color: "#101116" },
    { id: "light", name: "浅色", icon: "☀", note: "清爽办公桌", color: "#f2f4f7" },
    { id: "eye", name: "护眼", icon: "❧", note: "柔和暖绿", color: "#e4eadc" },
    { id: "fantasy", name: "魔幻", icon: "✧", note: "暗紫符文金", color: "#171324" }
  ].map(Object.freeze));

  function apply(id, persist = true) {
    const theme = options.find(option => option.id === id);
    if (!theme) return false;
    document.documentElement.dataset.theme = theme.id;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme.color;
    if (persist) {
      try { localStorage.setItem(KEY, theme.id); } catch (e) { /* 禁用存储时仍可切换本次页面 */ }
    }
    return true;
  }

  let saved = "dark";
  try { saved = localStorage.getItem(KEY) || "dark"; } catch (e) { /* 使用默认主题 */ }
  if (!apply(saved, false)) apply("dark", false);

  return Object.freeze({ options, apply, current: () => document.documentElement.dataset.theme });
})();
