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
import { ChevronLeftIcon, AtSignIcon, LockIcon, UserIcon } from "lucide-react";
import { useAuth } from "@/app/data/AuthContext";
import { supabase, isSupabaseReady } from "@/app/data/supabase";

export function AuthPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email.trim()) return;
    setLoading(true);

    try {
      if (mode === "login") {
        if (password) {
          if (isSupabaseReady()) {
            const { error: signInError } = await supabase.auth.signInWithPassword({
              email: email.trim(),
              password,
            });
            if (signInError) throw signInError;
          }
        } else {
          await login(email.trim());
        }
        navigate("/app/inicio");
      } else {
        if (!password || password.length < 6) {
          throw new Error("A senha deve ter no mínimo 6 caracteres");
        }
        if (!name.trim()) {
          throw new Error("Digite seu nome");
        }
        if (isSupabaseReady()) {
          const { error: signUpError } = await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: { data: { name: name.trim() } },
          });
          if (signUpError) throw signUpError;
        }
        setMode("login");
        setPassword("");
        setError("Conta criada! Faça login com sua senha.");
      }
    } catch (err) {
      setError(err.message || "Erro ao autenticar");
    } finally {
      setLoading(false);
    }
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
          className="absolute top-7 left-5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[50px] text-sm text-muted-foreground hover:text-foreground transition-colors"
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
              {mode === "login" ? "Entrar" : "Criar conta"}
            </h1>
            <p className="text-base text-muted-foreground">
              {mode === "login"
                ? "Acesse sua biblioteca e comunidade."
                : "Crie sua conta no OPE Club."}
            </p>
          </div>

          <form className="space-y-3" onSubmit={handleSubmit}>
            <p className="text-start text-muted-foreground text-xs">
              {mode === "login"
                ? "Digite seu email e senha para entrar"
                : "Preencha os dados para criar sua conta"}
            </p>

            {mode === "signup" && (
              <InputGroup>
                <InputGroupInput
                  placeholder="Seu nome"
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
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
                onChange={e => setEmail(e.target.value)}
              />
              <InputGroupAddon align="inline-start">
                <AtSignIcon />
              </InputGroupAddon>
            </InputGroup>

            <InputGroup>
              <InputGroupInput
                placeholder="Sua senha"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
              <InputGroupAddon align="inline-start">
                <LockIcon />
              </InputGroupAddon>
            </InputGroup>

            {error && (
              <p className={`text-xs ${error.includes("criada") ? "text-green-500" : "text-red-500"}`}>
                {error}
              </p>
            )}

            <Button className="w-full" type="submit" disabled={loading}>
              {loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}
            </Button>
          </form>

          <div className="text-center">
            <button
              onClick={() => {
                setMode(mode === "login" ? "signup" : "login");
                setError("");
              }}
              className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4 transition-colors"
            >
              {mode === "login"
                ? "Não tem conta? Criar conta"
                : "Já tem conta? Fazer login"}
            </button>
          </div>

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
