import type { PastoralConversation } from '@metanoia/types';
import messages from '../../../../../../../../messages/pt-BR.json';

const t = messages.leader.conversation;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

interface LastConversationEntryProps {
  firstName: string;
  conversation: PastoralConversation | null;
}

export function LastConversationEntry({
  firstName,
  conversation,
}: LastConversationEntryProps) {
  return (
    <section className="rounded-lg border border-border bg-surface p-5">
      <h2 className="text-heading mb-2">
        {t.label.replace('{firstName}', firstName)}
      </h2>
      {conversation ? (
        <>
          <p className="text-body-sm text-text-tertiary mb-2">
            {formatDate(conversation.occurredAt)}
          </p>
          <blockquote className="border-l-2 border-primary pl-3 text-body text-text-primary italic">
            {conversation.note}
          </blockquote>
        </>
      ) : (
        <p className="text-body text-text-secondary">
          {t.empty.replace('{firstName}', firstName)}
        </p>
      )}
    </section>
  );
}
