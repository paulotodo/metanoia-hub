import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@metanoia/ui';
import { LongFormContent } from '../../../src/components/marketing/long-form-content';
import messages from '../../../messages/pt-BR.json';

const t = messages.estudoCaso;

export const metadata: Metadata = {
  title: t.title,
  description: t.subtitle,
};

export default function EstudoDeCasoPage() {
  return (
    <article className="py-16 md:py-20">
      <header className="mx-auto max-w-[680px] px-4 text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-text-primary md:text-5xl">
          {t.title}
        </h1>
        <p className="mt-4 text-lg text-[var(--color-text-muted)]">
          {t.subtitle}
        </p>
      </header>

      <LongFormContent>
        {/* TODO editorial: estudo de caso placeholder — substituir por narrativa real após autorização da igreja parceira. */}
        <p>
          A Igreja da Vila — nome fictício de uma congregação real no interior
          de São Paulo — tem 180 membros ativos, 14 grupos pequenos e uma
          equipa pastoral de 3 pessoas. Antes do metanoia, a presença era
          anotada em planilhas no Google Drive. Cada líder usava um formato
          diferente, e o pastor titular passava 2 horas por semana só
          consolidando dados antes da reunião de equipa.
        </p>

        <h2>O ponto de virada</h2>
        <p>
          Em janeiro deste ano, três pessoas deixaram a igreja sem aviso. Em
          retrospecto, todas tinham começado a faltar gradualmente nas três
          ou quatro reuniões anteriores. O sinal estava lá — só não havia
          quem pudesse vê-lo a tempo.
        </p>

        <h2>O que mudou no dia a dia</h2>
        <p>
          Hoje, cada líder anota presença pelo telefone no caminho de casa —
          leva menos de 1 minuto. Toda quinta-feira, o pastor titular abre o
          Radar Pastoral antes do café e vê 3 a 5 nomes sugeridos para um
          olhar mais atento na semana. Não é uma lista de cobrança — é um
          lembrete pastoral.
        </p>

        <h2>O resultado humano</h2>
        <p>
          Em 6 meses, 8 pessoas que estavam no &ldquo;amarelo&rdquo; do radar
          receberam uma ligação ou visita. Cinco delas voltaram a frequentar.
          Três decidiram que aquela igreja não era o caminho — e foram
          despedidas com bênção, não com silêncio.
        </p>

        <h2>O que não mudou</h2>
        <p>
          A linguagem. As reuniões. O afeto. A tecnologia entrou pela cozinha
          — não pela porta da frente. Continua sendo uma igreja de pessoas que
          se conhecem pelo nome, e que agora têm uma ferramenta que respeita
          essa proximidade.
        </p>
      </LongFormContent>

      <footer className="mx-auto mt-20 max-w-2xl px-4 text-center">
        <h2 className="text-2xl font-semibold tracking-tight text-text-primary md:text-3xl">
          {t.ctaHeading}
        </h2>
        <div className="mt-8 flex justify-center">
          <Button asChild size="lg" data-testid="estudo-cta-primary">
            <Link href="/apresentacao">{t.ctaPrimary}</Link>
          </Button>
        </div>
      </footer>
    </article>
  );
}
