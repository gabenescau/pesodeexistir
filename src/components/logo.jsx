export const Logo = ({ className = "", ...props }) => (
  <span
    className={`inline-block shrink-0 whitespace-normal font-serif font-[400] leading-[.78] tracking-[-0.02em] ${className}`}
    {...props}
  >
    <span className="block">OPE</span>
    <span className="block">CLUB</span>
  </span>
);

export const LogoIcon = Logo;
