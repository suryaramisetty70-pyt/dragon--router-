/**
 * Dragon Router logo SVG — premium stylized dragon silhouette.
 */
type DragonRouterLogoProps = {
  size?: number;
  className?: string;
};

export default function DragonRouterLogo({ size = 20, className = "" }: DragonRouterLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Dragon Wing/Flame (Left) */}
      <path
        d="M6 18C4 13 8 7 13 5C10 9 10 14 13 18C15 15 16 11 15 8C19 11 20 16 17 21C16 23 13 25 9 24C7 23 5.5 21 6 18Z"
        fill="url(#dragon-grad-1)"
      />
      {/* Dragon Head (Right/Center) */}
      <path
        d="M26 12C28 10 26 6 21 8C19 9 17 9 15 10C13 11 11 13 12 16C12.5 17.5 14 18 16 17.5C14.5 19 13.5 21 14 23C15 26 19 28 23 26C25 25 26 23 25 20C24 17 22 15 24 14C25.5 13 25.5 12.5 26 12Z"
        fill="url(#dragon-grad-2)"
      />
      {/* Eye */}
      <circle cx="21" cy="12" r="1" fill="#ffffff" />
      {/* Dynamic Swirl / Tail */}
      <path
        d="M10 23C12 26 15 28 18 28C13 29 9 27 7 24C6.5 23 6 21 6.5 19.5C7 21.5 8.5 22.5 10 23Z"
        fill="url(#dragon-grad-1)"
      />
      <defs>
        <linearGradient
          id="dragon-grad-1"
          x1="5"
          y1="5"
          x2="18"
          y2="25"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#38bdf8" /> {/* Pastel Sky Blue */}
          <stop offset="100%" stopColor="#f472b6" /> {/* Pastel Pink */}
        </linearGradient>
        <linearGradient
          id="dragon-grad-2"
          x1="12"
          y1="8"
          x2="26"
          y2="26"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#0ea5e9" /> {/* Sky Blue */}
          <stop offset="100%" stopColor="#ec4899" /> {/* Pink */}
        </linearGradient>
      </defs>
    </svg>
  );
}
