import { Link } from "react-router-dom";
import { useData } from "../data/DataContext";
import { resolverMencao, tokenizarMencoes } from "@/lib/mentions";

// Renderiza texto de usuario com @mencao e #tag viraram link. Cada pedaco e
// inserido como texto React (nunca dangerouslySetInnerHTML), entao nao ha como
// um post injetar markup na pagina de quem le.
export function RichText({ text, className, onTagClick }) {
  const { profiles, authors } = useData();
  const partes = tokenizarMencoes(text);

  return (
    <p className={className}>
      {partes.map((parte, index) => {
        if (parte.tipo === "mencao") {
          const alvo = resolverMencao(parte.valor, { profiles, authors });
          if (!alvo) {
            return <span key={index}>{parte.texto}</span>;
          }
          return (
            <Link
              key={index}
              to={alvo.href}
              className="font-medium text-[var(--accent-mint,#c78359)] hover:underline"
            >
              @{alvo.rotulo}
            </Link>
          );
        }

        if (parte.tipo === "tag") {
          return (
            <button
              key={index}
              type="button"
              onClick={() => onTagClick?.(parte.valor)}
              className="font-medium text-[var(--accent-mint,#c78359)] hover:underline"
            >
              {parte.texto}
            </button>
          );
        }

        return <span key={index}>{parte.texto}</span>;
      })}
    </p>
  );
}
