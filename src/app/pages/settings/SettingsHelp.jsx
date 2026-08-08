import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronDown, ChevronUp, HelpCircleIcon, Info, Mail, MessageCircle, Shield } from "@/lib/icons";
import { SettingsLayout, SettingsRow, SettingsSection } from "../../components/SettingsLayout";

const FAQ = [
  {
    q: "Como assino o OPE Club?",
    a: "Acesse Configuracoes > Assinatura e escolha o plano mensal ou anual. O pagamento e processado pela AbacatePay.",
  },
  {
    q: "Posso ler offline?",
    a: "A leitura do PDF e feita pelo navegador. Para ler offline, abra o livro enquanto estiver conectado.",
  },
  {
    q: "Como cancelo minha assinatura?",
    a: "Em Configuracoes > Assinatura, clique em Cancelar assinatura. O cancelamento na AbacatePay e imediato.",
  },
  {
    q: "Como crio uma colecao?",
    a: "Em Configuracoes > Minhas colecoes, clique em Criar colecao. Depois, abra a colecao para adicionar livros ou autores.",
  },
  {
    q: "Como troco minha foto de perfil?",
    a: "Em Configuracoes > Editar perfil, passe o mouse sobre a foto atual e escolha uma nova imagem (JPG/PNG/WebP ate 2 MB).",
  },
  {
    q: "O que e a nota media dos livros?",
    a: "E a media de todas as avaliacoes de 1 a 5 estrelas deixadas pelos leitores. Voce tambem pode avaliar ao abrir a pagina de um livro.",
  },
];

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="px-4 sm:px-5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 py-3 text-left"
        aria-expanded={open}
      >
        <span className="text-sm font-medium text-[var(--text-primary)]">{q}</span>
        {open ? <ChevronUp className="size-4 shrink-0 text-[var(--text-muted)]" /> : <ChevronDown className="size-4 shrink-0 text-[var(--text-muted)]" />}
      </button>
      {open ? <p className="pb-3 pr-6 text-[13px] leading-relaxed text-[var(--text-secondary)]">{a}</p> : null}
    </div>
  );
}

export function SettingsHelp() {
  const [, setSearchParams] = useSearchParams();

  return (
    <SettingsLayout
      title="Ajuda"
      subtitle="FAQ, contato e sobre o app"
      onBack={() => setSearchParams({})}
    >
      <SettingsSection icon={HelpCircleIcon} label="Perguntas frequentes">
        <div className="divide-y divide-[var(--border)]">
          {FAQ.map((item) => <FaqItem key={item.q} {...item} />)}
        </div>
      </SettingsSection>

      <SettingsSection icon={MessageCircle} label="Contato">
        <SettingsRow
          icon={Mail}
          title="Email"
          description="Resposta em ate 2 dias uteis"
          right={<a href="mailto:suporte@pesodeexistir.online" className="text-xs font-medium text-[var(--accent-mint)] hover:underline">suporte@pesodeexistir.online</a>}
        />
        <SettingsRow
          icon={Shield}
          title="Termos de uso"
          description="Regras e responsabilidades"
          right={<a href="/termos" target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]">Abrir</a>}
        />
        <SettingsRow
          icon={Info}
          title="Politica de privacidade"
          description="Como tratamos seus dados"
          right={<a href="/privacidade" target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]">Abrir</a>}
        />
      </SettingsSection>

      <SettingsSection icon={Info} label="Sobre">
        <SettingsRow title="Aplicativo" description="OPE Club" />
        <SettingsRow title="Versao" description="0.1.0" />
        <SettingsRow title="Desenvolvedor" description="Gabe Nescau" />
      </SettingsSection>
    </SettingsLayout>
  );
}
