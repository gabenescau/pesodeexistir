import { Link } from "react-router-dom";
import { ArrowLeft, Mail, WhatsappLogo, ShieldCheck, ArrowRight } from "@/lib/icons";

export function SupportPage() {
  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl flex-1 space-y-6">

      {/* Voltar */}
      <Link
        to="/app/inicio"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
      >
        <ArrowLeft className="size-4" /> Voltar para o Início
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-[var(--text-primary)] sm:text-2xl">
          Suporte OPE Club
        </h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Precisa de ajuda com sua assinatura, resgate de produtos ou dúvidas gerais? Fale diretamente com nossa equipe.
        </p>
      </div>

      {/* Grid de Canais de Suporte */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">

        {/* Suporte WhatsApp Gabe */}
        <a
          href="https://wa.me/5571999636112"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex flex-col justify-between rounded-[14px] border border-[var(--border)] bg-[var(--bg-card)] p-5 hover:border-[var(--text-primary)] transition-all duration-200"
        >
          <div className="space-y-3">
            <div className="flex size-10 items-center justify-center rounded-[10px] border border-[var(--border)] bg-[var(--bg-canvas)] text-[var(--text-primary)]">
              <WhatsappLogo className="size-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Atendimento WhatsApp</p>
              <h3 className="mt-0.5 text-base font-bold text-[var(--text-primary)]">Gabe</h3>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">(71) 99963-6112</p>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-[var(--border)] flex items-center justify-between text-xs font-semibold text-[var(--text-primary)] group-hover:underline">
            <span>Iniciar conversa</span>
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </div>
        </a>

        {/* Suporte WhatsApp Bruna */}
        <a
          href="https://wa.me/5511952946599"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex flex-col justify-between rounded-[14px] border border-[var(--border)] bg-[var(--bg-card)] p-5 hover:border-[var(--text-primary)] transition-all duration-200"
        >
          <div className="space-y-3">
            <div className="flex size-10 items-center justify-center rounded-[10px] border border-[var(--border)] bg-[var(--bg-canvas)] text-[var(--text-primary)]">
              <WhatsappLogo className="size-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Atendimento WhatsApp</p>
              <h3 className="mt-0.5 text-base font-bold text-[var(--text-primary)]">Bruna</h3>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">(11) 95294-6599</p>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-[var(--border)] flex items-center justify-between text-xs font-semibold text-[var(--text-primary)] group-hover:underline">
            <span>Iniciar conversa</span>
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </div>
        </a>

        {/* E-mail de Suporte */}
        <a
          href="mailto:gabenescau@gmail.com"
          className="group flex flex-col justify-between rounded-[14px] border border-[var(--border)] bg-[var(--bg-card)] p-5 sm:col-span-2 hover:border-[var(--text-primary)] transition-all duration-200"
        >
          <div className="flex items-start gap-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] border border-[var(--border)] bg-[var(--bg-canvas)] text-[var(--text-primary)]">
              <Mail className="size-5" />
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">E-mail Oficial de Atendimento</p>
              <h3 className="text-base font-bold text-[var(--text-primary)]">gabenescau@gmail.com</h3>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                Envie suas dúvidas, solicitações ou comprovantes. Respondemos com prioridade.
              </p>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-[var(--border)] flex items-center justify-between text-xs font-semibold text-[var(--text-primary)] group-hover:underline">
            <span>Enviar e-mail</span>
            <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </div>
        </a>

      </div>

      {/* Footer informativo */}
      <div className="rounded-[12px] border border-[var(--border)] bg-[var(--bg-card)] p-4 flex items-center gap-3 text-xs text-[var(--text-muted)]">
        <ShieldCheck className="size-4 shrink-0 text-[var(--text-primary)]" />
        <span>Atendimento oficial OPE Club — Segunda a Sexta, das 09h às 18h.</span>
      </div>

    </div>
  );
}

