import messages from '../../../../../../messages/pt-BR.json';

export default function VistaPlaceholderPage() {
  const t = messages.vista;
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-display mb-2">{t.title}</h1>
      <p className="text-body text-text-secondary">
        {t.subtitle.replace('{groupCount}', '0')}
      </p>
    </main>
  );
}
