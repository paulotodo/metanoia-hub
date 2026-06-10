import messages from '../../../../../../messages/pt-BR.json';

interface WelcomeHeaderProps {
  name: string;
}

export function WelcomeHeader({ name }: WelcomeHeaderProps) {
  const t = messages.welcome;
  const title = t.title.replace('{name}', name);

  return (
    <header className="space-y-2 text-center">
      <h1
        className="text-2xl font-bold text-text-primary lg:text-3xl"
        data-testid="welcome-heading"
      >
        {title}
      </h1>
      <p className="text-base text-text-secondary">{t.subtitle}</p>
    </header>
  );
}
