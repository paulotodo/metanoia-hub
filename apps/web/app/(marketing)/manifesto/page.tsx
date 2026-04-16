import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@metanoia/ui';
import { LongFormContent } from '../../../src/components/marketing/long-form-content';
import messages from '../../../messages/pt-BR.json';

const t = messages.manifesto;

export const metadata: Metadata = {
  title: t.title,
  description: t.subtitle,
};

export default function ManifestoPage() {
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
        {/* TODO editorial: placeholder pastoral — substituir por copy final em revisão de conteúdo. */}
        <p>
          O metanoia nasceu de uma pergunta simples e incômoda: quem cuida de
          quem cuida? Pastores e líderes voluntários passam horas em planilhas,
          grupos de WhatsApp e listas de presença — e ainda assim perdem de
          vista a pessoa que está desaparecendo nos últimos meses.
        </p>

        <h2>Tecnologia a serviço do cuidado</h2>
        <p>
          Não queremos transformar a sua igreja numa plataforma de
          marketing, nem medir pessoas como se fossem métricas de produto. A
          palavra de ordem aqui é presença — e a tecnologia só faz sentido se
          devolver tempo para a conversa, para a visita, para o café depois
          da reunião.
        </p>

        <h2>O que recusamos</h2>
        <p>
          Recusamos funil, KPI, conversão, churn, lead. Recusamos urgência
          sintética e pop-ups que pressionam decisões. Recusamos
          gamificação de fé. O que construímos tem linguagem pastoral porque
          acreditamos que a linguagem molda o que você vê — e o que você vê
          molda o que você cuida.
        </p>

        <h2>O que escolhemos</h2>
        <p>
          Escolhemos visibilidade sem vigilância. Escolhemos dados que servem
          ao pastor, nunca o contrário. Escolhemos começar pelo manifesto,
          não pelo pricing. E escolhemos construir isto com igrejas reais —
          não para elas, com elas.
        </p>
      </LongFormContent>

      <section className="mx-auto mt-20 max-w-2xl px-4 text-center">
        <h2 className="text-2xl font-semibold tracking-tight text-text-primary md:text-3xl">
          {t.ctaHeading}
        </h2>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
          <Button asChild size="lg" data-testid="manifesto-cta-primary">
            <Link href="/funcionalidades">{t.ctaPrimary}</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            data-testid="manifesto-cta-secondary"
          >
            <Link href="/contato">{t.ctaSecondary}</Link>
          </Button>
        </div>
      </section>
    </article>
  );
}
