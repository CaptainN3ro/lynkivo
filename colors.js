/**
 * Generate a full color palette from a single hex accent color.
 * Works for both dark and light themes.
 */

function hexToHsl(hex) {
  let r = parseInt(hex.slice(1, 3), 16) / 255;
  let g = parseInt(hex.slice(3, 5), 16) / 255;
  let b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) { h = s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return '#' + [f(0), f(8), f(4)].map(x => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
}

export function generatePalette(accentHex, theme = 'dark') {
  let [h, s, l] = hexToHsl(accentHex);

  // Clamp saturation for readability
  s = Math.max(50, Math.min(s, 90));

  const isDark = theme === 'dark';

  // Accent variants
  const accent      = hslToHex(h, s, isDark ? 65 : 45);
  const accentDim   = hslToHex(h, Math.max(s - 10, 40), isDark ? 45 : 35);
  const accentGlow  = hslToHex(h, s, isDark ? 78 : 55);
  const accentText  = isDark ? hslToHex(h, 15, 8) : '#ffffff';

  // Complementary / secondary (shifted ~150deg)
  const h2 = (h + 150) % 360;
  const accent2 = hslToHex(h2, Math.max(s - 10, 50), isDark ? 68 : 48);

  // Danger (always reddish)
  const danger = hslToHex(0, 75, isDark ? 62 : 48);

  // Warning
  const warning = hslToHex(38, 90, isDark ? 62 : 48);

  // Neutral palette derived from accent hue (slightly tinted)
  const ns = Math.min(s * 0.12, 12); // low saturation for neutrals

  const bg       = isDark ? hslToHex(h, ns, 5)  : hslToHex(h, ns * 0.5, 97);
  const surface  = isDark ? hslToHex(h, ns, 8)  : hslToHex(h, ns * 0.5, 100);
  const surface2 = isDark ? hslToHex(h, ns, 11) : hslToHex(h, ns * 0.3, 94);
  const border   = isDark ? hslToHex(h, ns, 16) : hslToHex(h, ns * 0.3, 85);
  const text      = isDark ? hslToHex(h, 8, 92)  : hslToHex(h, 8, 10);
  const muted     = isDark ? hslToHex(h, 6, 48)  : hslToHex(h, 6, 52);

  // Glow for radial background
  const glowColor  = hslToHex(h, s, isDark ? 18 : 82);
  const glowColor2 = hslToHex(h2, Math.max(s - 20, 30), isDark ? 14 : 88);

  return {
    accent, accentDim, accentGlow, accentText, accent2,
    danger, warning,
    bg, surface, surface2, border, text, muted,
    glowColor, glowColor2,
    accentHex,
    theme,
  };
}

export function paletteToCSS(p) {
  return `
    --accent:        ${p.accent};
    --accent-dim:    ${p.accentDim};
    --accent-glow:   ${p.accentGlow};
    --accent-text:   ${p.accentText};
    --accent2:       ${p.accent2};
    --danger:        ${p.danger};
    --warning:       ${p.warning};
    --bg:            ${p.bg};
    --surface:       ${p.surface};
    --surface2:      ${p.surface2};
    --border:        ${p.border};
    --text:          ${p.text};
    --muted:         ${p.muted};
    --glow:          ${p.glowColor};
    --glow2:         ${p.glowColor2};
  `.trim();
}