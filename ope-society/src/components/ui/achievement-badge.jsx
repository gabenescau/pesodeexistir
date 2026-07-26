import { useRef, useState } from "react";
import * as Icons from "lucide-react";

// Badge de conquista com o efeito holografico do award-badge do Product Hunt,
// adaptado para JSX e parametrizado por variante (cor + icone). Mesmo brilho
// que reage ao mouse, mas cada conquista tem sua paleta — "varios estilos,
// mesmo padrao". Em telas sem mouse (celular) o brilho fica na animacao suave.

const identityMatrix = "1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1";
const maxRotate = 0.25;
const minRotate = -0.25;
const maxScale = 1;
const minScale = 0.97;

// Cada variante: [corBase, corBorda, corTexto]. Fecha o conjunto de estilos.
export const VARIANTS = {
  bronze: ["#f1cfa6", "#d9a066", "#7a4a1e"],
  amber: ["#f6e0a8", "#e0b64a", "#7a5a12"],
  gold: ["#f3e3ac", "#cbb25a", "#6f5c14"],
  violet: ["#e6dcfb", "#a988e8", "#4b2f8a"],
  fuchsia: ["#f7d7ef", "#dd7fc4", "#7c2f68"],
  rose: ["#f8d6dc", "#e089a0", "#8a2f45"],
  sky: ["#d4ecfb", "#78bce8", "#1f4f7a"],
  teal: ["#cdeee7", "#5cc0ac", "#155e52"],
  emerald: ["#d1eddb", "#5cc07f", "#155e34"],
  indigo: ["#dcdefb", "#8890e8", "#2f388a"],
  orange: ["#f9dcc4", "#e8965c", "#7a3f14"],
  slate: ["#e2e5ea", "#98a2b3", "#37404f"],
};

function getDimensions(el) {
  const r = el?.getBoundingClientRect();
  return { left: r?.left || 0, right: r?.right || 0, top: r?.top || 0, bottom: r?.bottom || 0 };
}

function getMatrix(el, clientX, clientY) {
  const { left, right, top, bottom } = getDimensions(el);
  const xc = (left + right) / 2;
  const yc = (top + bottom) / 2;
  const scale = [
    maxScale - ((maxScale - minScale) * Math.abs(xc - clientX)) / (xc - left || 1),
    maxScale - ((maxScale - minScale) * Math.abs(yc - clientY)) / (yc - top || 1),
    maxScale - ((maxScale - minScale) * (Math.abs(xc - clientX) + Math.abs(yc - clientY))) / (xc - left + yc - top || 1),
  ];
  const rot = {
    x1: 0.25 * ((yc - clientY) / (yc || 1) - (xc - clientX) / (xc || 1)),
    x2: maxRotate - ((maxRotate - minRotate) * Math.abs(right - clientX)) / (right - left || 1),
    y2: maxRotate - ((maxRotate - minRotate) * (top - clientY)) / (top - bottom || 1),
    z0: -(maxRotate - ((maxRotate - minRotate) * Math.abs(right - clientX)) / (right - left || 1)),
    z1: 0.2 - ((0.2 + 0.6) * (top - clientY)) / (top - bottom || 1),
  };
  return (
    `${scale[0]}, 0, ${rot.z0}, 0, ` +
    `${rot.x1}, ${scale[1]}, ${rot.z1}, 0, ` +
    `${rot.x2}, ${rot.y2}, ${scale[2]}, 0, ` +
    `0, 0, 0, 1`
  );
}

export function AchievementBadge({ title, subtitle, icon = "Sparkles", variant = "gold", locked = false }) {
  const ref = useRef(null);
  const [matrix, setMatrix] = useState(identityMatrix);
  const [glow, setGlow] = useState(0);
  const [base, border, text] = VARIANTS[variant] || VARIANTS.gold;
  const Icon = Icons[icon] || Icons.Sparkles;

  function onMove(e) {
    if (locked) return;
    setMatrix(getMatrix(ref.current, e.clientX, e.clientY));
    const { left, right, top, bottom } = getDimensions(ref.current);
    const xc = (left + right) / 2;
    const yc = (top + bottom) / 2;
    setGlow((Math.abs(xc - e.clientX) + Math.abs(yc - e.clientY)) / 1.5);
  }

  function onLeave() {
    setMatrix(identityMatrix);
    setGlow(0);
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className="relative w-full select-none"
      style={{ opacity: locked ? 0.45 : 1, filter: locked ? "grayscale(0.85)" : "none" }}
      title={locked ? "Conquista bloqueada" : title}
    >
      <div
        style={{
          transform: `perspective(700px) matrix3d(${matrix})`,
          transformOrigin: "center center",
          transition: "transform 200ms ease-out",
        }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 54" className="h-auto w-full">
          <defs>
            <filter id={`blur-${variant}`}>
              <feGaussianBlur in="SourceGraphic" stdDeviation="3" />
            </filter>
            <mask id={`mask-${variant}`}>
              <rect width="260" height="54" fill="white" rx="10" />
            </mask>
          </defs>
          <rect width="260" height="54" rx="10" fill={base} />
          <rect x="4" y="4" width="252" height="46" rx="8" fill="transparent" stroke={border} strokeWidth="1" />

          <g transform="translate(14, 15)">
            <rect width="24" height="24" rx="6" fill={text} opacity="0.12" />
          </g>
          <text fontFamily="Helvetica-Bold, Helvetica" fontSize="9" fontWeight="bold" fill={text} opacity="0.75" x="50" y="21">
            {(subtitle || "CONQUISTA").toUpperCase()}
          </text>
          <text fontFamily="Helvetica-Bold, Helvetica" fontSize="14" fontWeight="bold" fill={text} x="49" y="39">
            {title.length > 24 ? `${title.slice(0, 23)}…` : title}
          </text>

          {/* Brilho holografico estatico; so reage ao passar o mouse por cima
              (glow). Sem animacao em loop — o badge nao fica "abrindo e
              fechando" sozinho na tela. */}
          {!locked && (
            <g style={{ mixBlendMode: "overlay" }} mask={`url(#mask-${variant})`}>
              {[
                "hsl(358,100%,62%)", "hsl(30,100%,50%)", "hsl(60,100%,50%)",
                "hsl(150,100%,45%)", "hsl(210,100%,55%)", "hsl(271,85%,55%)",
              ].map((color, i) => (
                <g
                  key={color}
                  style={{
                    transform: `rotate(${glow + i * 12}deg)`,
                    transformOrigin: "center center",
                    transition: "transform 220ms ease-out",
                    willChange: "transform",
                  }}
                >
                  <polygon points="0,0 260,54 260,0 0,54" fill={color} filter={`url(#blur-${variant})`} opacity="0.4" />
                </g>
              ))}
            </g>
          )}
        </svg>
      </div>

      {/* Icone real por cima do quadrado guia do SVG. Absoluto e em % para
          acompanhar a escala do badge (a largura e w-full, entao a altura
          varia com o container). */}
      <div className="pointer-events-none absolute inset-0 flex items-center" style={{ paddingLeft: "6.2%" }}>
        <span className="flex h-full items-center justify-center" style={{ color: text, width: "8%" }}>
          <Icon className="h-[46%] w-auto" strokeWidth={2.2} />
        </span>
      </div>
    </div>
  );
}
