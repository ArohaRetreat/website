// Browser colour preference is independent of the farm’s IST atmosphere.
export function installBrowserBranding() {
  const scheme = matchMedia('(prefers-color-scheme: dark)');
  const update = () => {
    const icon = document.querySelector('link[data-brand-favicon]');
    if (icon) icon.href = `/assets/brand/favicon-${scheme.matches ? 'dark' : 'light'}.svg`;
    document.querySelectorAll('meta[name="theme-color"]').forEach(meta=>meta.content='#163e2d');
  };
  update();
  // The classic bootstrap precedes the icon link in the HTML head.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', update, {once:true});
  scheme.addEventListener('change', update);
}
