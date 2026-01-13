export const PointIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="3" fill="currentColor" />
  </svg>
);

export const LineStringIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <circle cx="4" cy="20" r="2" />
    <circle cx="20" cy="4" r="2" />
    <circle cx="12" cy="12" r="2" />
    <path d="M4 20 L12 12 L20 4" />
  </svg>
);

export const PolygonIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M12 2L2 9L6 21H18L22 9L12 2Z" />
    <circle cx="12" cy="2" r="2" fill="currentColor" stroke="none" />
    <circle cx="2" cy="9" r="2" fill="currentColor" stroke="none" />
    <circle cx="6" cy="21" r="2" fill="currentColor" stroke="none" />
    <circle cx="18" cy="21" r="2" fill="currentColor" stroke="none" />
    <circle cx="22" cy="9" r="2" fill="currentColor" stroke="none" />
  </svg>
);

export const RectangleIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <circle cx="3" cy="3" r="2" fill="currentColor" stroke="none" />
    <circle cx="21" cy="3" r="2" fill="currentColor" stroke="none" />
    <circle cx="21" cy="21" r="2" fill="currentColor" stroke="none" />
    <circle cx="3" cy="21" r="2" fill="currentColor" stroke="none" />
  </svg>
);

export const CompassIcon = ({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={style}
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M12 2L14.5 9H9.5L12 2Z" fill="currentColor" stroke="none" />
    <path
      d="M12 22L9.5 15H14.5L12 22Z"
      fill="currentColor"
      fillOpacity="0.3"
      stroke="none"
    />
  </svg>
);

export const MeasureAreaIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2z" />
    <path d="M3 11h18" strokeOpacity="0.5" />
    <path d="M9 21V3" strokeOpacity="0.5" />
  </svg>
);
