import { useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { FloatingPaths } from "@/components/floating-paths";
import { AtSignIcon, ChevronLeftIcon, Eye, EyeSlash, GiftIcon, LockIcon, UserIcon } from "@/lib/icons";
import { useAuth } from "@/app/data/AuthContext";
import { supabase, isSupabaseReady } from "@/app/data/supabase";
import { getSupabaseErrorMessage } from "@/lib/supabase-error";
import { toast } from "@/lib/toast";
import {
  normalizeEmail,
  PASSWORD_MIN_LENGTH,
  sanitizeSingleLine,
  validateStrongPassword,
} from "@/lib/sanitize";

const MAX_AUTH_ATTEMPTS = 5;
const AUTH_LOCKOUT_MS = 60 * 1000;

export function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const mode = location.pathname === "/cadastro" ? "signup" : "login";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [referralCode, setReferralCode] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Trava local após tentativas seguidas. Isto é conveniência/anti-acidente:
    // um atacante chama a API do Supabase direto e nem passa por aqui. A defesa
    // real é o rate limit do lado do servidor (painel do Supabase → Auth →
    // Rate Limits) e o CAPTCHA — veja o comentário no fim deste arquivo.
    if (Date.now() < lockedUntil) {
      const seconds = Math.ceil((lockedUntil - Date.now()) / 1000);
      setError(`Muitas tentativas seguidas. Aguarde ${seconds}s e tente de novo.`);
      return;
    }

    const cleanEmail = normalizeEmail(email);
    const cleanName = sanitizeSingleLine(name, 80);
    if (!cleanEmail) return;
    if (!isSupabaseReady()) {
      if (import.meta.env.PROD) {
        setError("O servico de autenticacao esta temporariamente indisponivel. Tente novamente em instantes.");
        return;
      }
      toast.success("Modo de desenvolvimento local ativado.");
      navigate(location.state?.from?.pathname || "/app/inicio", { replace: true });
      return;
    }
    setLoading(true);

    try {
      if (mode === "login") {
        if (!password) {
          throw new Error("Digite sua senha.");
        }
        await login(cleanEmail, password);
        toast.success("Login realizado. Bem-vindo de volta.");
        navigate(location.state?.from?.pathname || "/app/inicio", { replace: true });
      } else {
        validateStrongPassword(password);
        if (!cleanName) {
          throw new Error("Digite seu nome");
        }
        if (!termsAccepted) {
          throw new Error("Para criar a conta voce precisa aceitar os Termos de Servico e a Politica de Privacidade (LGPD).");
        }
        const refParam = sanitizeSingleLine(
          referralCode.trim() || new URLSearchParams(location.search).get("ref") || "",
          40
        );
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              name: cleanName,
              lgpd_consent: true,
              lgpd_consent_at: new Date().toISOString(),
              marketing_opt_in: marketingOptIn,
              ...(refParam ? { referral_code: refParam } : {}),
            },
          },
        });
        if (signUpError) throw signUpError;

        // O perfil ja e criado pelo trigger handle_new_user, que le o nome de
        // raw_user_meta_data. Escrever em profiles aqui so funciona se o signUp
        // ja tiver devolvido sessao (confirmacao de email desligada): sem
        // sessao, auth.uid() e NULL e o RLS recusa o insert.
        if (data.session && data.user) {
          const { error: profileError } = await supabase
            .from("profiles")
            .update({
              name: cleanName,
              avatar: cleanName.charAt(0).toUpperCase(),
            })
            .eq("id", data.user.id);

          if (profileError) {
            console.warn("Perfil nao foi atualizado:", profileError.message);
          }

          // Se veio da URL /assinar?ref=CODIGO, registra quem indicou.
          if (refParam) {
            await supabase.rpc("register_referral", { p_referrer_code: refParam }).catch(() => {});
          }

          navigate(location.state?.from?.pathname || "/app/inicio", { replace: true });
          return;
        }

        navigate(`/entrar${location.search}`, { replace: true });
        setPassword("");
        setError("Conta criada! Confirme seu email pela mensagem enviada pelo Supabase e depois faça login com sua senha.");
      }
      setFailedAttempts(0);
    } catch (err) {
      const attempts = failedAttempts + 1;

      if (attempts >= MAX_AUTH_ATTEMPTS) {
        setFailedAttempts(0);
        setLockedUntil(Date.now() + AUTH_LOCKOUT_MS);
        setError("Muitas tentativas seguidas. Aguarde 1 minuto antes de tentar de novo.");
      } else {
        setFailedAttempts(attempts);
        setError(getSupabaseErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page relative min-h-screen overflow-hidden bg-[var(--bg-canvas)] text-[var(--text-primary)] lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)]">
      <div className="auth-visual-panel relative hidden min-h-screen flex-col border-r border-[var(--border)] bg-[var(--bg-surface)] p-10 lg:flex xl:p-14">
        <div className="absolute inset-0 bg-linear-to-br from-[var(--accent-mint)]/8 via-transparent to-[var(--bg-canvas)]" />
        <div className="relative mr-auto flex items-center gap-2">
          <Logo className="text-[26px] text-[var(--text-primary)]" />
        </div>

        <div className="relative z-10 mt-auto max-w-xl pb-8">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-mint)]">Biblioteca + comunidade</p>
          <h2 className="max-w-lg text-4xl font-semibold leading-[1.05] text-[var(--text-primary)] xl:text-5xl">Ideias melhores começam com uma boa leitura.</h2>
          <p className="mt-5 max-w-md text-base leading-7 text-[var(--text-secondary)]">Entre para ler, conversar e acompanhar uma comunidade que pensa junto.</p>
        </div>
        <div className="auth-paths pointer-events-none absolute inset-0 opacity-70">
          <FloatingPaths position={1} />
          <FloatingPaths position={-1} />
        </div>
      </div>

      <div className="auth-form-panel relative flex min-h-screen flex-col justify-center bg-[var(--bg-canvas)] px-4 py-10 sm:px-8 lg:px-12">
        <div
          aria-hidden
          className="absolute inset-0 isolate -z-10 opacity-60 contain-strict"
        >
          <div className="absolute top-0 right-0 h-320 w-140 -translate-y-87.5 rounded-full bg-[radial-gradient(68.54%_68.72%_at_55.02%_31.46%,--theme(--color-foreground/.06)_0,hsla(0,0%,55%,.02)_50%,--theme(--color-foreground/.01)_80%)]" />
          <div className="absolute top-0 right-0 h-320 w-60 rounded-full bg-[radial-gradient(50%_50%_at_50%_50%,--theme(--color-foreground/.04)_0,--theme(--color-foreground/.01)_80%,transparent_100%)] [translate:5%_-50%]" />
          <div className="absolute top-0 right-0 h-320 w-60 -translate-y-87.5 rounded-full bg-[radial-gradient(50%_50%_at_50%_50%,--theme(--color-foreground/.04)_0,--theme(--color-foreground/.01)_80%,transparent_100%)]" />
        </div>

        <Link
          to="/"
          className="absolute top-6 left-4 inline-flex min-h-10 items-center gap-1.5 rounded-full border border-[var(--border)] px-3 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--accent-mint)] sm:left-8"
        >
          <ChevronLeftIcon className="size-4" />Início
        </Link>

        <div className="auth-form-card mx-auto w-full max-w-md space-y-5">
          <div className="flex items-center gap-2 lg:hidden">
            <Logo className="text-[26px] text-[var(--text-primary)]" />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--accent-mint)]">OPE Club</p>
            <h1 className="text-3xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-4xl">
              {mode === "login" ? "Entrar" : "Criar conta"}
            </h1>
            <p className="max-w-sm text-sm leading-6 text-[var(--text-secondary)]">
              {mode === "login"
                ? "Acesse sua biblioteca e comunidade."
                : "Crie sua conta no OPE Club."}
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>

            {mode === "signup" && (
              <InputGroup>
                <InputGroupInput
                  placeholder="Seu nome"
                  type="text"
                  value={name}
                  maxLength={80}
                  autoComplete="name"
                  onChange={e => setName(e.target.value)}
                  required
                />
                <InputGroupAddon align="inline-start">
                  <UserIcon />
                </InputGroupAddon>
              </InputGroup>
            )}

            <InputGroup>
              <InputGroupInput
                placeholder="seu@email.com"
                type="email"
                value={email}
                maxLength={254}
                autoComplete="email"
                onChange={e => setEmail(e.target.value)}
                required
              />
              <InputGroupAddon align="inline-start">
                <AtSignIcon />
              </InputGroupAddon>
            </InputGroup>

            <InputGroup>
              <InputGroupInput
                placeholder="Sua senha"
                type={showPassword ? "text" : "password"}
                value={password}
                minLength={mode === "signup" ? PASSWORD_MIN_LENGTH : 1}
                maxLength={128}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                onChange={e => setPassword(e.target.value)}
                required
              />
              <InputGroupAddon align="inline-start">
                <LockIcon />
              </InputGroupAddon>
              <InputGroupAddon align="inline-end">
                <button
                  type="button"
                  className="rounded-md p-1.5 text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-mint)]"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? <EyeSlash /> : <Eye />}
                </button>
              </InputGroupAddon>
            </InputGroup>

            {mode === "signup" && (
              <InputGroup>
                <InputGroupInput
                  placeholder="Código de indicação (opcional)"
                  type="text"
                  value={referralCode}
                  maxLength={40}
                  autoComplete="off"
                  onChange={e => setReferralCode(e.target.value)}
                />
                <InputGroupAddon align="inline-start">
                  <GiftIcon />
                </InputGroupAddon>
              </InputGroup>
            )}

            {error && (
              <p className={`text-xs ${error.includes("criada") ? "text-[var(--accent-mint)]" : "text-red-500"}`}>
                {error}
              </p>
            )}

            <Button className="min-h-12 w-full rounded-[10px] bg-[var(--text-primary)] text-[var(--bg-canvas)] hover:bg-[var(--text-primary)]/90" type="submit" disabled={loading}>
              {loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}
            </Button>
          </form>

          <div className="border-t border-[var(--border)] pt-5 text-center">
            <button
              type="button"
              onClick={() => {
                navigate(`${mode === "login" ? "/cadastro" : "/entrar"}${location.search}`);
                setError("");
                setTermsAccepted(false);
                setMarketingOptIn(false);
              }}
              className="text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--accent-mint)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-mint)]"
            >
              {mode === "login"
                ? "Não tem conta? Assinar agora"
                : "Já tem conta? Acessar conta"}
            </button>
          </div>

          {mode === "signup" && (
            <div className="space-y-3 pt-2">
              <label className="flex items-start gap-3 text-left text-xs text-[var(--text-muted)]">
                <Checkbox
                  checked={termsAccepted}
                  onCheckedChange={(value) => setTermsAccepted(value === true)}
                  className="mt-0.5"
                  required
                />
                <span>
                  Li e aceito os{" "}
                  <TermsDialog
                    trigger={
                      <span className="cursor-pointer underline underline-offset-4 hover:text-[var(--accent-mint)]">
                        Termos de Servico
                      </span>
                    }
                  />
                  {" "}e a{" "}
                  <PrivacyDialog
                    trigger={
                      <span className="cursor-pointer underline underline-offset-4 hover:text-[var(--accent-mint)]">
                        Politica de Privacidade
                      </span>
                    }
                  />
                  {" "}do OPE Club, em conformidade com a Lei Geral de Protecao de Dados (LGPD - Lei 13.709/2018).
                </span>
              </label>
              <label className="flex items-start gap-3 text-left text-xs text-[var(--text-muted)]">
                <Checkbox
                  checked={marketingOptIn}
                  onCheckedChange={(value) => setMarketingOptIn(value === true)}
                  className="mt-0.5"
                />
                <span>
                  Quero receber novidades, lancamentos e recomendacoes por email. (Opcional - posso cancelar a qualquer momento.)
                </span>
              </label>
            </div>
          )}

          <p className="mt-6 text-center text-[11px] leading-relaxed text-[var(--text-muted)]">
            OPE Club respeita sua privacidade. Os dados coletados (nome, email, atividades de leitura)
            sao usados para operacao do clube, personalizacao de conteudo e cumprimento de obrigacoes legais.
            Voce pode exercer os direitos previstos no art. 18 da LGPD (confirmacao, acesso, correcao,
            anonimizacao, portabilidade e eliminacao) pelo email{" "}
            <a className="underline underline-offset-4 hover:text-[var(--accent-mint)]" href="mailto:privacidade@pesodeexistir.online">
              privacidade@pesodeexistir.online
            </a>.
          </p>
        </div>
      </div>
    </main>
  );
}

function TermsDialog({ trigger }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<button type="button" className="inline" />}>
        {trigger}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Termos de Servico</AlertDialogTitle>
          <AlertDialogDescription>
            Estes termos regem o uso da plataforma OPE Club. Ao criar uma conta voce declara estar de acordo.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1 text-xs leading-relaxed text-[var(--text-secondary)]">
          <p><strong>1. Aceitacao.</strong> O uso do OPE Club implica concordancia com estes Termos e com a Politica de Privacidade. Se voce nao concordar, nao crie conta.</p>
          <p><strong>2. Cadastro.</strong> Voce deve fornecer informacoes verdadeiras e manter sua senha em sigilo. E de sua responsabilidade toda atividade feita na sua conta.</p>
          <p><strong>3. Pagamento.</strong> Os planos sao concedidos pela plataforma. Cancelamentos podem ser feitos a qualquer momento e o acesso permanece ate o fim do ciclo vigente.</p>
          <p><strong>4. Conteudo.</strong> O acervo de livros e o conteudo da comunidade sao para uso pessoal. E proibido redistribuir, reproduzir ou explorar comercialmente sem autorizacao.</p>
          <p><strong>5. Conduta.</strong> Publique apenas conteudo que voce tenha direito de compartilhar. Discurso de odio, spam e assedio nao sao tolerados e podem resultar em banimento.</p>
          <p><strong>6. Suspensao.</strong> Podemos suspender contas que violem estes termos ou apresentem atividade suspeita.</p>
          <p><strong>7. Alteracoes.</strong> Estes termos podem ser atualizados. Avisaremos sobre mudancas relevantes por email ou aviso no app.</p>
          <p><strong>8. Foro.</strong> Estes Termos sao regidos pela legislacao brasileira, em especial pela LGPD e pelo Codigo de Defesa do Consumidor.</p>
        </div>
        <AlertDialogFooter>
          <AlertDialogClose>Entendi</AlertDialogClose>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function PrivacyDialog({ trigger }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<button type="button" className="inline" />}>
        {trigger}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Politica de Privacidade (LGPD)</AlertDialogTitle>
          <AlertDialogDescription>
            Como coletamos, usamos e protegemos seus dados pessoais - Lei 13.709/2018.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1 text-xs leading-relaxed text-[var(--text-secondary)]">
          <p><strong>Controlador.</strong> OPE Club (pesodeexistir.online), contato: privacidade@pesodeexistir.online.</p>
          <p><strong>Dados coletados.</strong> Nome, email, foto de perfil, atividades de leitura, publicacoes na comunidade e preferencias de notificacao.</p>
          <p><strong>Finalidades.</strong> Operacao da conta, personalizacao de conteudo, envio de lancamentos e novidades (somente se autorizado), suporte ao usuario, cumprimento de obrigacoes legais e prevencao a fraudes.</p>
          <p><strong>Base legal.</strong> Executamos o tratamento com base no seu consentimento (art. 7o, I) e na execucao de contrato (art. 7o, V) para operacao do servico.</p>
          <p><strong>Compartilhamento.</strong> Nao vendemos seus dados. Compartilhamos apenas com prestadores essenciais (Supabase para banco) sob contratos de confidencialidade.</p>
          <p><strong>Cookies.</strong> Usamos cookies essenciais para autenticacao e preferencias. Cookies de marketing sao opcionais.</p>
          <p><strong>Retencao.</strong> Mantemos seus dados enquanto a conta estiver ativa. Apos o cancelamento, dados pessoais sao anonimizados em ate 90 dias, salvo obrigacao legal de retencao.</p>
          <p><strong>Seus direitos (art. 18 LGPD).</strong> Confirmacao, acesso, correcao, anonimizacao, portabilidade, eliminacao, revogacao do consentimento e revisao de decisoes automatizadas. Solicite pelo email acima.</p>
          <p><strong>Seguranca.</strong> Aplicamos criptografia em transito (HTTPS), controle de acesso por funcao (RLS no Supabase) e monitoramento contra acessos nao autorizados.</p>
          <p><strong>Encarregado (DPO).</strong> privacidade@pesodeexistir.online.</p>
        </div>
        <AlertDialogFooter>
          <AlertDialogClose>Entendi</AlertDialogClose>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
