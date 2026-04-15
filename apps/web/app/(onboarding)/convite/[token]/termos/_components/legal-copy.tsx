/**
 * Placeholder legal copy for spec 05.2. Real content will come from the
 * legal team (CMS or static versioned file). Rendered inside a scrollable
 * region so the user is never forced to read the whole text to unlock the
 * accept checkbox (per the spec — "referência, não bloqueio").
 */
export function LegalCopy() {
  return (
    <div className="space-y-6 text-sm leading-relaxed text-[var(--color-text-primary)]">
      <section aria-labelledby="legal-terms-heading">
        <h2
          id="legal-terms-heading"
          className="text-lg font-semibold text-[var(--color-text-primary)] sm:text-xl"
        >
          Termos de Uso
        </h2>
        <p className="mt-2 text-[var(--color-text-muted)]">
          Última atualização: 13 de abril de 2026
        </p>
        <div className="mt-3 space-y-3">
          <p>
            Ao aceitar estes termos, você autoriza sua igreja a usar o
            metanoia-hub para cuidar de pessoas, registrar encontros e
            acompanhar o discipulado. O serviço é oferecido &quot;como
            está&quot; e pode ser ajustado conforme a necessidade da sua
            comunidade.
          </p>
          <p>
            Você, como administrador, é responsável por convidar as pessoas
            certas, zelar pelos dados que registra e encerrar acessos quando
            alguém deixa a liderança. O metanoia-hub é ferramenta — o cuidado
            pastoral continua sendo da igreja.
          </p>
          <p>
            Se descumprirmos o combinado, você pode exportar seus dados e
            encerrar a conta a qualquer momento, sem multa.
          </p>
        </div>
      </section>

      <section aria-labelledby="legal-privacy-heading">
        <h2
          id="legal-privacy-heading"
          className="text-lg font-semibold text-[var(--color-text-primary)] sm:text-xl"
        >
          Política de Privacidade
        </h2>
        <p className="mt-2 text-[var(--color-text-muted)]">
          Última atualização: 13 de abril de 2026
        </p>
        <div className="mt-3 space-y-3">
          <p>
            Coletamos apenas o necessário para operar a plataforma: dados da
            igreja, perfis de líderes e membros, registros de encontros e
            sinais pastorais (presença, participação, consentimento).
          </p>
          <p>
            Seus dados pertencem à sua igreja. Não vendemos, não compartilhamos
            com anunciantes e não treinamos modelos com informações
            pessoais. Processamos tudo conforme a LGPD (Lei Geral de Proteção
            de Dados — Lei 13.709/2018).
          </p>
          <p>
            Você pode exportar todos os dados em qualquer momento e solicitar
            exclusão definitiva ao encerrar a conta. Após o cancelamento,
            mantemos backup cifrado por até 30 dias antes da remoção completa.
          </p>
          <p>
            Nosso contato para assuntos de privacidade:
            {" "}
            <a
              href="mailto:privacidade@metanoia-hub.com"
              className="underline underline-offset-4"
            >
              privacidade@metanoia-hub.com
            </a>
            .
          </p>
        </div>
      </section>
    </div>
  );
}
