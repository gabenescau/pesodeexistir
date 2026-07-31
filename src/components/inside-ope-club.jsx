import { BookOpen, Compass, MessageSquare, WifiOff } from "@/lib/icons";

const items = [
  { icon: BookOpen, title: "Biblioteca", desc: "Leia grandes obras de filosofia, literatura e psicologia diretamente no aplicativo." },
  { icon: MessageSquare, title: "Comunidade integrada", desc: "Publique reflexões, participe de discussões, comente publicações e interaja com outros leitores sem sair do aplicativo." },
  { icon: Compass, title: "Descobertas", desc: "Encontre novos autores, livros e recomendações feitas pela própria comunidade." },
  { icon: WifiOff, title: "Leitura Offline", desc: "Baixe suas obras favoritas e leia onde quiser." },
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
