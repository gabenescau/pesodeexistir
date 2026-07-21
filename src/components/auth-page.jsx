import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { FloatingPaths } from "@/components/floating-paths";
import { ChevronLeftIcon, AtSignIcon } from "lucide-react";
import { useAuth } from "@/app/data/AuthContext";

export function AuthPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const handleEmailSignIn = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    await login(email.trim());
    setSent(true);
    setTimeout(() => navigate("/app/inicio"), 1500);
  };

  return (
    <main className="relative md:h-screen md:overflow-hidden lg:grid lg:grid-cols-2">
      <div className="relative hidden h-full flex-col border-r bg-secondary p-10 lg:flex dark:bg-secondary/20">
        <div className="absolute inset-0 bg-linear-to-b from-transparent via-transparent to-background" />
        <div className="flex items-center gap-2 mr-auto">
          <Logo className="h-4.5 w-auto" />
          <span className="font-bold text-sm tracking-tight text-foreground">OPE Club</span>
        </div>

        <div className="z-10 mt-auto">
          <blockquote className="space-y-2">
            <p className="text-xl">
              &ldquo;A leitura não acaba quando você fecha o livro.
              Ela continua nas conversas.&rdquo;
            </p>
            <footer className="font-mono font-semibold text-sm">
              ~ OPE Club
            </footer>
          </blockquote>
        </div>
        <div className="absolute inset-0">
          <FloatingPaths position={1} />
          <FloatingPaths position={-1} />
        </div>
      </div>

      <div className="relative flex min-h-screen flex-col justify-center px-6 sm:px-8">
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
          className="absolute top-7 left-5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[50px] text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        >
          <ChevronLeftIcon className="size-4" />Início
        </Link>

        <div className="mx-auto w-full max-w-sm space-y-4">
          <div className="flex items-center gap-2 lg:hidden">
            <Logo className="h-4.5 w-auto" />
            <span className="font-bold text-sm tracking-tight text-foreground">OPE Club</span>
          </div>
          <div className="flex flex-col space-y-1">
            <h1 className="font-bold text-2xl tracking-wide">
              {sent ? "Email enviado!" : "Entrar ou criar conta"}
            </h1>
            <p className="text-base text-muted-foreground">
              {sent ? "Verifique sua caixa de entrada para o link mágico." : "Acesse sua biblioteca e comunidade."}
            </p>
          </div>

          <form className="space-y-2" onSubmit={handleEmailSignIn}>
            <p className="text-start text-muted-foreground text-xs">
              Digite seu email para entrar ou criar uma conta
            </p>
            <InputGroup>
              <InputGroupInput placeholder="seu@email.com" type="email" value={email} onChange={e => setEmail(e.target.value)} />
              <InputGroupAddon align="inline-start">
                <AtSignIcon />
              </InputGroupAddon>
            </InputGroup>
            <Button className="w-full" type="submit" disabled={sent}>
              {sent ? "Email enviado!" : "Continuar com Email"}
            </Button>
          </form>

          <p className="mt-8 text-muted-foreground text-sm text-center">
            Ao continuar, você concorda com nossos{" "}
            <a className="underline underline-offset-4 hover:text-primary" href="#">
              Termos de Serviço
            </a>{" "}
            e{" "}
            <a className="underline underline-offset-4 hover:text-primary" href="#">
              Política de Privacidade
            </a>.
          </p>
        </div>
      </div>
    </main>
  );
}
