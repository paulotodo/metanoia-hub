import messages from '../../../messages/pt-BR.json';

const t = messages.precos.faq;

const ITEMS: ReadonlyArray<{ key: string; question: string; answer: string }> =
  [
    { key: 'q1', question: t.q1.question, answer: t.q1.answer },
    { key: 'q2', question: t.q2.question, answer: t.q2.answer },
    { key: 'q3', question: t.q3.question, answer: t.q3.answer },
  ];

export function FaqAccordion() {
  return (
    <div className="mx-auto mt-12 max-w-2xl">
      <h2 className="text-center text-2xl font-semibold tracking-tight text-text-primary md:text-3xl">
        {t.heading}
      </h2>
      <div className="mt-8 divide-y divide-[var(--color-border-default)] rounded-lg border border-[var(--color-border-default)] bg-surface-base">
        {ITEMS.map((item) => (
          <details
            key={item.key}
            data-testid={`faq-${item.key}`}
            className="group p-6 [&_summary::-webkit-details-marker]:hidden"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-medium text-text-primary">
              <span>{item.question}</span>
              <span
                aria-hidden="true"
                className="text-xl text-[var(--color-text-muted)] transition group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <p className="mt-3 text-base leading-relaxed text-[var(--color-text-muted)]">
              {item.answer}
            </p>
          </details>
        ))}
      </div>
    </div>
  );
}
