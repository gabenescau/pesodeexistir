export const Logo = (props) => (
  <svg
    fill="currentColor"
    viewBox="0 0 60 24"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <text
      x="0"
      y="19"
      fontSize="20"
      fontWeight="800"
      fontFamily="system-ui, sans-serif"
      letterSpacing="1"
    >
      OPE
    </text>
  </svg>
);

export const LogoIcon = (props) => (
  <svg
    fill="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2.5" fill="none" />
    <circle cx="12" cy="12" r="3" fill="currentColor" />
  </svg>
);
