// ─── Design tokens ──────────────────────────────────────────────────
// Theme-independent tokens (type, radius, shadow shape, spring curves)
// are plain exports. Color is theme-dependent — use useTheme() to read
// the resolved palette for the active theme rather than importing a
// static color object.

export const font = {
  ui:      "'Inter', system-ui, sans-serif",
  display: "'Newsreader', Georgia, serif",
  mono:    "'JetBrains Mono', ui-monospace, monospace",
}

export const radius = {
  chipSm: 4, chip: 6, controlXs: 8, controlSm: 9, control: 10, card: 16, glass: 24, pill: 999,
}

// hex → rgba string at a given alpha, so translucent washes stay tied to the
// active theme's brand colors instead of being hand-copied as literals
export function alpha(hex, a) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${a})`
}

// framer-motion spring presets. Critically damped (bounce 0): overshoot only
// makes sense on something the user threw, not on a menu that just appeared.
// `duration` here is the spring's response, not a fixed length.
export const spring = {
  tap:   { type: 'spring', bounce: 0, duration: 0.3 },
  drop:  { type: 'spring', bounce: 0, duration: 0.4 },
  theme: { type: 'spring', stiffness: 160, damping: 22 }, // theme switch — the one exception to "single moment per screen"
}

// ── Dark — "moonlight over fog" (default) ──────────────────────────
const dark = {
  blue200: '#D3DEE7', blue300: '#A9C0D2', blue400: '#6B93B5', blue500: '#5D85A8', blue600: '#4E7291', blue800: '#33516A',
  lavender300: '#C4C0D1', lavender500: '#9893A8', lavender600: '#7D7890', lavender800: '#4F4B5C',
  sage300: '#B8D9BF', sage500: '#7FB38A', sage600: '#649470', sage900: '#2E4A35',
  terracotta300: '#E0B3AA', terracotta500: '#C97B6E', terracotta700: '#8C4F45',

  bgBase: '#0E1114', bgSurface: '#141920', bgElevated: '#1B232B', bgBorder: '#26323C',
  textPrimary: '#ECEEF0', textSecondary: '#949CA6', textTertiary: '#8A929C',
  onPrimary: '#0E1114',

  shadowSm: '0 2px 8px -2px rgba(14,17,20,0.4)',
  shadowMd: '0 8px 24px -6px rgba(14,17,20,0.5)',
  shadowGlassBlue:     '0 16px 48px -12px rgba(93,133,168,0.3)',
  shadowGlassLavender: '0 20px 56px -14px rgba(152,147,168,0.3)',
  shadowGlowSage:      '0 0 32px rgba(127,179,138,0.4)',

  glassBg:         'rgba(27,35,43,0.65)',
  glassHighlight:  'rgba(255,255,255,0.32)',
  glassBorder:     'rgba(255,255,255,0.06)',
  scrimBg:         'rgba(5,7,9,0.6)',
  hoverOverlay:    'rgba(255,255,255,0.05)',
}

// ── Light — "museum by day": paper, not inverted carbon ─────────────
const light = {
  // ink variants: same role, deepened for AA contrast on a light canvas
  blue200: '#EAF0F5', blue300: '#3D6B88', blue400: '#4A7FA0', blue500: '#3D6B88', blue600: '#2F5570', blue800: '#1F3A4B',
  lavender300: '#5F5A74', lavender500: '#5F5A74', lavender600: '#4A4660', lavender800: '#332F45',
  sage300: '#357048', sage500: '#357048', sage600: '#285838', sage900: '#1C3F28',
  terracotta300: '#9A4A3C', terracotta500: '#9A4A3C', terracotta700: '#6E2F26',

  bgBase: '#F2EFE8', bgSurface: '#F8F5EF', bgElevated: '#FFFFFF', bgBorder: '#DEDAD0',
  textPrimary: '#1C1B18', textSecondary: '#6B675E', textTertiary: '#6E695E',
  onPrimary: '#FFFFFF',

  shadowSm: '0 2px 8px -2px rgba(28,27,24,0.08)',
  shadowMd: '0 8px 24px -6px rgba(28,27,24,0.1)',
  shadowGlassBlue:     '0 10px 32px -10px rgba(61,107,136,0.18)',
  shadowGlassLavender: '0 12px 36px -10px rgba(95,90,116,0.16)',
  shadowGlowSage:      '0 0 28px rgba(53,112,72,0.22)',

  glassBg:         'rgba(255,255,255,0.55)',
  glassHighlight:  'rgba(255,255,255,0.75)',
  glassBorder:     'rgba(28,27,24,0.07)',
  scrimBg:         'rgba(100,95,85,0.25)',
  hoverOverlay:    'rgba(28,27,24,0.05)',
}

export const palettes = { dark, light }

// status → semantic color key (resolve via palette[status + 'XXX'] at call site)
export const statusColorKey = {
  active:   'sage500',
  archived: 'lavender500',
  revived:  'blue500',
}
