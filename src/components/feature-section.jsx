import { cn } from "@/lib/utils";
import {
  IconBooks,
  IconMessages,
  IconCompass,
  IconWifiOff,
} from "@tabler/icons-react";

const features = [
  {
    title: "Biblioteca",
    description:
      "Leia grandes obras de filosofia, literatura e psicologia diretamente no aplicativo.",
    icon: <IconBooks />,
  },
  {
    title: "Comunidade integrada",
    description:
      "Publique reflexões, participe de discussões, comente publicações e interaja com outros leitores sem sair do aplicativo.",
    icon: <IconMessages />,
  },
  {
    title: "Descobertas",
    description:
      "Encontre novos autores, livros e recomendações feitas pela própria comunidade.",
    icon: <IconCompass />,
  },
  {
    title: "Leitura Offline",
    description:
      "Baixe suas obras favoritas e leia onde quiser.",
    icon: <IconWifiOff />,
  },
];

export function FeatureSection() {
  return (
    <section id="recursos" className="py-24 md:py-32 border-t border-border">
      <div className="px-4 md:px-8 mb-16">
        <div className="max-w-6xl mx-auto text-center">
          <span className="font-mono text-[12px] font-[400] text-muted-foreground uppercase tracking-[0.6px] mb-4 block">
            Dentro do aplicativo
          </span>
          <h2 className="text-[32px] md:text-[32px] font-[600] leading-[40px] tracking-[-1.28px] text-foreground">
            O que você encontra
            <br />
            dentro do aplicativo
          </h2>
        </div>
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((feature, index) => (
            <Feature key={feature.title} {...feature} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}

function Feature({ title, description, icon, index }) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-[8px] border border-border bg-card p-6 relative group/feature",
        "hover:border-primary/30 transition-all duration-200",
        "shadow-[0px_1px_1px_#00000005,0px_2px_2px_#0000000a]",
        "before:absolute before:inset-0 before:rounded-[8px] before:shadow-[inset_0_0_0_1px_#ffffff08] before:pointer-events-none"
      )}
    >
      <div className="opacity-0 group-hover/feature:opacity-100 transition duration-200 absolute inset-0 h-full w-full bg-gradient-to-t from-primary/[0.04] dark:from-primary/[0.06] to-transparent pointer-events-none rounded-[8px]" />
      <div className="mb-4 relative z-10 text-muted-foreground [&_svg]:size-6">
        {icon}
      </div>
      <div className="text-[20px] font-[600] leading-[28px] tracking-[-0.6px] mb-2 relative z-10">
        <span className="text-foreground">
          {title}
        </span>
      </div>
      <p className="text-[16px] font-[400] leading-[24px] text-muted-foreground max-w-xs relative z-10">
        {description}
      </p>
    </div>
  );
}
