import { cn } from "@/lib/utils";

function BookIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5A2.5 2.5 0 0 1 4 19.5Z" />
      <path d="M8 7h6" />
      <path d="M8 11h8" />
      <path d="M8 15h5" />
    </svg>
  );
}

function MessageIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function CompassIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="m16.24 7.76-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12Z" />
    </svg>
  );
}

function WifiOffIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="2" x2="22" y1="2" y2="22" />
      <path d="M8.5 16.5a5 5 0 0 1 7 0" />
      <path d="M2 8.82a15 15 0 0 1 4.17-2.65" />
      <path d="M10.66 5c4.01-.36 8.14.56 11.34 3.03" />
      <path d="M16.85 11.25a10 10 0 0 1 2.22 1.68" />
      <path d="M5 13a10 10 0 0 1 5.24-2.76" />
    </svg>
  );
}

const items = [
  { icon: BookIcon, title: "Biblioteca", desc: "Leia grandes obras de filosofia, literatura e psicologia diretamente no aplicativo." },
  { icon: MessageIcon, title: "Comunidade integrada", desc: "Publique reflexões, participe de discussões, comente publicações e interaja com outros leitores sem sair do aplicativo." },
  { icon: CompassIcon, title: "Descobertas", desc: "Encontre novos autores, livros e recomendações feitas pela própria comunidade." },
  { icon: WifiOffIcon, title: "Leitura Offline", desc: "Baixe suas obras favoritas e leia onde quiser." },
];

export function InsideOpeClub() {
  return (
    <section className="py-24 md:py-32 border-t border-border">
      <div className="px-4 md:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest mb-4 block">
              Dentro do aplicativo
            </span>
            <h2 className="text-3xl md:text-5xl font-normal tracking-tight text-foreground">
              O que você encontra<br />dentro do aplicativo
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {items.map((item) => (
              <div
                key={item.title}
                className="group p-6 rounded-2xl border border-border bg-card hover:border-primary/20 hover:shadow-sm hover:shadow-primary/5 transition-all duration-300"
              >
                <div className="size-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <item.icon className="size-5 text-primary" />
                </div>
                <h3 className="text-base font-medium mb-2 text-foreground">
                  {item.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
