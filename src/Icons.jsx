const I = ({ d, sz = 16 }) => (
  <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

export const PlusIcon  = () => <I d="M12 5v14M5 12h14" />;
export const TrashIcon = () => <I d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />;
export const FileIcon  = () => <I d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8" />;
export const EyeIcon   = () => <I d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />;
export const BldgIcon  = () => <I d="M3 21h18M5 21V5a2 2 0 012-2h10a2 2 0 012 2v16M9 9h1M9 13h1M14 9h1M14 13h1" />;
export const SaveIcon  = () => <I d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2zM17 21v-8H7v8M7 3v5h8" />;
export const DownIcon  = () => <I d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />;
export const ListIcon  = () => <I d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />;
export const BackIcon  = () => <I d="M19 12H5M12 19l-7-7 7-7" />;
export const CopyIcon  = () => <I d="M20 9h-9a2 2 0 00-2 2v9a2 2 0 002 2h9a2 2 0 002-2v-9zM5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />;

export const LogoIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="var(--bg)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 21h18M5 21V7l8-4v18M13 21V3l6 4v14" />
    <path d="M9 9h1M9 13h1" />
  </svg>
);
