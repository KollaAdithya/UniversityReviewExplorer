import { ReactNode } from "react";

interface Props {
  children: ReactNode;
  hero?: ReactNode;
}

export function PageShell({ children, hero }: Props) {
  return (
    <main className="page-shell">
      {hero}
      {children}
    </main>
  );
}

interface HeroProps {
  eyebrow?: string;
  title: string;
  description: string;
  children?: ReactNode;
}

export function PageHero({ eyebrow, title, description, children }: HeroProps) {
  return (
    <header className="hero-panel mb-8">
      {eyebrow && (
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-brand-600">{eyebrow}</p>
      )}
      <h1 className="font-display text-3xl font-bold tracking-tight text-ink-950 sm:text-4xl">{title}</h1>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink-600">{description}</p>
      {children && <div className="mt-6">{children}</div>}
    </header>
  );
}

export function SectionCard({
  title,
  subtitle,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`section-card ${className}`}>
      {title && (
        <div className="mb-5">
          <h2 className="section-title">{title}</h2>
          {subtitle && <p className="section-subtitle">{subtitle}</p>}
        </div>
      )}
      {children}
    </section>
  );
}
