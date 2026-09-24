export type Bird = {
  id: "pigeon" | "seagull" | "mourning-dove";
  name: string;
  /** Typical average cruising speed (not top speed). */
  kmh: number;
  /** Top-down silhouette, head pointing north so marker rotation == bearing. */
  svg: string;
};

const svg = (body: string) =>
  `<svg viewBox="0 0 48 48" width="40" height="40" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;

export const BIRDS: Bird[] = [
  {
    id: "pigeon",
    name: "Pigeon",
    kmh: 72, // ~45 mph; rock pigeons cruise at 40–50 mph
    svg: svg(`
      <g stroke="#1e293b" stroke-width="0.8" stroke-linejoin="round">
        <path fill="#94a3b8" d="M22 19 C15 14 7 15 3 21 C7 25 15 25 22 26 Z"/>
        <path fill="#94a3b8" d="M26 19 C33 14 41 15 45 21 C41 25 33 25 26 26 Z"/>
        <path fill="#475569" d="M3 21 C4 23 6 24 8 24.5 L9 20 C6 20 4 20.5 3 21 Z M45 21 C44 23 42 24 40 24.5 L39 20 C42 20 44 20.5 45 21 Z"/>
        <path fill="#94a3b8" d="M20 31 L16.5 41 Q24 44.5 31.5 41 L28 31 Z"/>
        <path fill="#334155" d="M16.8 40 Q24 43.5 31.2 40 L31.5 41 Q24 44.5 16.5 41 Z"/>
        <ellipse fill="#a8b3c3" cx="24" cy="24" rx="5.5" ry="10"/>
        <ellipse fill="#5b8a72" cx="24" cy="15.5" rx="4" ry="3"/>
        <circle fill="#64748b" cx="24" cy="11.5" r="3.4"/>
      </g>
      <path fill="#f59e0b" d="M23.2 8.4 L24 6.4 L24.8 8.4 Z"/>`),
  },
  {
    id: "seagull",
    name: "Seagull",
    kmh: 35, // ~22 mph; herring gulls average 20–25 mph
    svg: svg(`
      <g stroke="#1e293b" stroke-width="0.8" stroke-linejoin="round">
        <path fill="#cbd5e1" d="M22 20 C17 16 9 17 1 23 L3 25 C10 22 16 23 22 25.5 Z"/>
        <path fill="#cbd5e1" d="M26 20 C31 16 39 17 47 23 L45 25 C38 22 32 23 26 25.5 Z"/>
        <path fill="#0f172a" d="M1 23 L3 25 C4.5 24.3 6 23.7 7.5 23.2 L6.5 20 C4.5 20.8 2.7 21.8 1 23 Z M47 23 L45 25 C43.5 24.3 42 23.7 40.5 23.2 L41.5 20 C43.5 20.8 45.3 21.8 47 23 Z"/>
        <path fill="#f8fafc" d="M20.5 32 L20 39 L28 39 L27.5 32 Z"/>
        <ellipse fill="#f8fafc" cx="24" cy="24" rx="4.5" ry="11"/>
        <circle fill="#f8fafc" cx="24" cy="11.5" r="3.2"/>
      </g>
      <path fill="#facc15" stroke="#1e293b" stroke-width="0.5" d="M23 8.8 L24 5.2 L25 8.8 Z"/>`),
  },
  {
    id: "mourning-dove",
    name: "Mourning Dove",
    kmh: 56, // ~35 mph; mourning doves cruise at 30–40 mph
    svg: svg(`
      <g stroke="#1e293b" stroke-width="0.8" stroke-linejoin="round">
        <path fill="#c8a47e" d="M22.5 19 C16 16 8 19 2 27 C10 25.5 17 25 22.5 25.5 Z"/>
        <path fill="#c8a47e" d="M25.5 19 C32 16 40 19 46 27 C38 25.5 31 25 25.5 25.5 Z"/>
        <path fill="#f8fafc" d="M21.5 30 L24 46.5 L26.5 30 Z"/>
        <path fill="#a0785a" d="M22.3 30 L24 44 L25.7 30 Z"/>
        <ellipse fill="#d6b894" cx="24" cy="24" rx="4" ry="9"/>
        <circle fill="#c8a47e" cx="24" cy="13.5" r="2.8"/>
      </g>
      <g fill="#1e293b">
        <circle cx="15" cy="21.5" r="0.9"/><circle cx="18" cy="22.8" r="0.9"/>
        <circle cx="33" cy="21.5" r="0.9"/><circle cx="30" cy="22.8" r="0.9"/>
      </g>
      <path fill="#334155" d="M23.4 11 L24 9.2 L24.6 11 Z"/>`),
  },
];
