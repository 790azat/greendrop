// Lightweight line icon set (24×24, stroke = currentColor), drawn in one consistent style.
import { CSSProperties } from 'react';

const P: Record<string, string> = {
  home: 'M3 10.5 12 3l9 7.5M5 9v11h5v-6h4v6h5V9',
  plus: 'M12 5v14M5 12h14',
  list: 'M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21c1.5-4 4.5-6 8-6s6.5 2 8 6',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM2 21c1.2-3.5 3.8-5.5 7-5.5s5.8 2 7 5.5M16 3.5a4 4 0 0 1 0 7.5M18 15.5c2 .7 3.3 2.6 4 5.5',
  wallet: 'M3 7a2 2 0 0 1 2-2h13v4M3 7v11a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2ZM16 14.5h.01',
  repeat: 'M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3',
  calendar: 'M4 6h16v15H4zM4 10h16M8 3v4M16 3v4',
  camera: 'M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1ZM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
  pin: 'M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21ZM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2',
  zap: 'M13 2 4 14h7l-1 8 9-12h-7l1-8Z',
  card: 'M3 6h18v12H3zM3 10h18M7 15h3',
  cash: 'M2 7h20v10H2zM12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM6 10v4M18 10v4',
  transfer: 'M4 8h14l-3-3M20 16H6l3 3',
  bell: 'M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9ZM10 20a2 2 0 0 0 4 0',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z',
  gift: 'M3 9h18v4H3zM5 13v8h14v-8M12 9v12M12 9S10.5 4 8 4a2.5 2.5 0 0 0 0 5h4ZM12 9s1.5-5 4-5a2.5 2.5 0 0 1 0 5h-4Z',
  help: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM9.5 9.2a2.6 2.6 0 0 1 5 .8c0 1.8-2.5 2.2-2.5 4M12 17h.01',
  logout: 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10',
  phone: 'M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2Z',
  route: 'M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM6 15V9a3 3 0 0 1 3-3h7M18 9v6a3 3 0 0 1-3 3H8',
  chevron: 'M9 6l6 6-6 6',
  back: 'M15 6l-6 6 6 6',
  down: 'M6 9l6 6 6-6',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  recycle: 'M7 19H4.5a1.5 1.5 0 0 1-1.3-2.3L6 12M9.5 5.5 11 3a1.5 1.5 0 0 1 2.6 0L16 7M17 19h2.5a1.5 1.5 0 0 0 1.3-2.3L18.5 13M6 12l-3-.5M6 12l1.5-2.7M16 7l.6-3M16 7l-3 .3M17 19l-2.5-2M17 19l-2.5 2M7 19h7.5',
  sofa: 'M5 11V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3M3 13a2 2 0 0 1 4 0v2h10v-2a2 2 0 0 1 4 0v5H3v-5ZM5 18v2M19 18v2',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  x: 'M6 6l12 12M18 6 6 18',
  message: 'M4 5h16v11H8l-4 4V5Z',
  tag: 'M3 12V4h8l10 10-8 8L3 12ZM7.5 8.5h.01',
  star: 'm12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3Z',
  download: 'M12 3v12M7 10l5 5 5-5M4 20h16',
  inbox: 'M22 12h-6l-2 3h-4l-2-3H2M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6l3.5-7Z',
  truck: 'M3 6h11v10H3zM14 9h4l3 3v4h-7M7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM17 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z',
  map: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2ZM9 4v14M15 6v14',
  leaf: 'M5 19c0-8 5-14 15-15-1 10-7 15-15 15ZM5 19l8-8',
  bag: 'M6 8h12l1 13H5L6 8ZM9 8V6a3 3 0 0 1 6 0v2',
  door: 'M5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17M3 21h18M15 12h.01',
  shield: 'M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3ZM9 12l2 2 4-4',
  play: 'M7 4v16l13-8L7 4Z',
  pause: 'M8 5v14M16 5v14',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v6M12 7.5h.01',
  share: 'M12 3v13M7 8l5-5 5 5M5 13v7h14v-7',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3ZM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z',
  key: 'M14.5 9.5a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM13 13l8 8M17 17l2-2M19 19l1.5-1.5',
  sms: 'M4 5h16v11H8l-4 4V5ZM8 10h.01M12 10h.01M16 10h.01',
};

export type IconName = keyof typeof P;

export function I({ n, size = 20, stroke = 2, style, className }: { n: IconName | string; size?: number; stroke?: number; style?: CSSProperties; className?: string }) {
  const d = P[n] || P.info;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flex: 'none', ...style }}
      className={className}
    >
      <path d={d} />
    </svg>
  );
}

/** Icon in a soft rounded square — the main visual anchor for list rows and sections */
export function IconBox({ n, tone = 'green', size = 40 }: { n: IconName | string; tone?: 'green' | 'gray' | 'amber' | 'blue' | 'red' | 'solid'; size?: number }) {
  return (
    <span className={`ibox ${tone}`} style={{ width: size, height: size }}>
      <I n={n} size={Math.round(size * 0.5)} />
    </span>
  );
}

export const SERVICE_ICON: Record<string, IconName> = { trash: 'trash', recycle: 'recycle', bulky: 'sofa' };
export const PAY_ICON: Record<string, IconName> = { wallet: 'wallet', online: 'card', cash: 'cash', card: 'transfer' };
