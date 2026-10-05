// Geometric, rounded, consistent line icons (Guide p.14): 24px grid, 1.75 stroke, round caps/joins.
const s = (body) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;

export const icons = {
  'arrow-right': s('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  'arrow-up-right': s('<path d="M7 17L17 7M9 7h8v8"/>'),
  check: s('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  'check-circle': s('<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.8 2.7L16 9.5"/>'),
  minus: s('<path d="M7 12h10"/>'),
  'chevron-down': s('<path d="M6 9l6 6 6-6"/>'),
  menu: s('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  close: s('<path d="M6 6l12 12M18 6L6 18"/>'),
  layers: s('<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5"/>'),
  key: s('<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M14 9l2 2"/>'),
  users: s('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0113 0"/><path d="M16 4.6a3.5 3.5 0 010 6.8M18 14a6.5 6.5 0 013.5 6"/>'),
  user: s('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/>'),
  history: s('<path d="M3 12a9 9 0 103-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>'),
  invoice: s('<path d="M6 3h9l4 4v14l-2.5-1.5L14 21l-2.5-1.5L9 21l-2.5-1.5L4 21V5a2 2 0 012-2z"/><path d="M8 9h6M8 13h8M8 17h4"/>'),
  shield: s('<path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6l8-3z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>'),
  multisig: s('<rect x="3" y="10" width="18" height="11" rx="3"/><path d="M7 10V7a5 5 0 0110 0v3"/><circle cx="8" cy="15.5" r="1"/><circle cx="12" cy="15.5" r="1"/><circle cx="16" cy="15.5" r="1"/>'),
  convert: s('<path d="M4 8h13l-3-3M20 16H7l3 3"/>'),
  connect: s('<circle cx="5" cy="12" r="2.5"/><circle cx="19" cy="5" r="2.5"/><circle cx="19" cy="19" r="2.5"/><path d="M7.3 11l9.4-4.8M7.3 13l9.4 4.8"/>'),
  bank: s('<path d="M3 9l9-5 9 5M5 9v9M9.5 9v9M14.5 9v9M19 9v9M3 21h18"/>'),
  card: s('<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18M7 15h4"/>'),
  exchange: s('<path d="M4 17l5-5 4 4 7-8"/><path d="M15 8h5v5"/>'),
  wallet: s('<path d="M4 7a2 2 0 012-2h11v4"/><rect x="4" y="7" width="16" height="13" rx="2.5"/><path d="M16 13.5h2"/>'),
  vault: s('<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="12" cy="12" r="4"/><path d="M12 8v1.5M12 14.5V16M8 12h1.5M14.5 12H16M6 20v1.5M18 20v1.5"/>'),
  lock: s('<rect x="4.5" y="10" width="15" height="11" rx="3"/><path d="M8 10V7a4 4 0 018 0v3M12 14.5v2.5"/>'),
  eye: s('<path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7S2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>'),
  list: s('<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/>'),
  sliders: s('<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>'),
  building: s('<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h2M14 7h2M8 11h2M14 11h2M8 15h2M14 15h2M10 21v-3h4v3"/>'),
  globe: s('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18"/>'),
  mail: s('<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M4 7l8 6 8-6"/>'),
  login: s('<path d="M10 4H6a2 2 0 00-2 2v12a2 2 0 002 2h4"/><path d="M14 8l4 4-4 4M18 12H9"/>'),
  coins: s('<ellipse cx="9" cy="7" rx="6" ry="3"/><path d="M3 7v5c0 1.7 2.7 3 6 3s6-1.3 6-3V7"/><path d="M9 15v2c0 1.7 2.7 3 6 3s6-1.3 6-3v-5c0-1.7-2.7-3-6-3"/>'),
  clock: s('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  send: s('<path d="M21 3L10 14M21 3l-7 18-4-7-7-4 18-7z"/>'),
  filter: s('<path d="M4 5h16l-6 7.5V19l-4 2v-8.5L4 5z"/>'),
  ban: s('<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>'),
  enso: s('<path d="M17.5 15.5A7.5 7.5 0 1119.5 11"/>'),
};

export function icon(name) {
  const svg = icons[name];
  if (!svg) throw new Error(`Unknown icon: ${name}`);
  return svg;
}
