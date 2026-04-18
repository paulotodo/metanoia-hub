import type { InviteResolveParticipant } from "@metanoia/types";
import { LeaderAvatar } from "./leader-avatar";
import { ParticipantAuthButtons } from "./participant-auth-buttons";
import { TermsNotice } from "./terms-notice";

interface ParticipantWelcomeViewProps {
  invite: InviteResolveParticipant;
  token: string;
}

/**
 * Spec 06.2 — landing for Juliana after the email tap. Personal welcome
 * with the leader's face and group name. Zero form before auth choice.
 */
export function ParticipantWelcomeView({
  invite,
  token,
}: ParticipantWelcomeViewProps) {
  const { leader, group } = invite;
  return (
    <div className="flex w-full flex-col items-center gap-6">
      <LeaderAvatar firstName={leader.firstName} avatarUrl={leader.avatarUrl} />
      <h1 className="text-center text-[22px] font-bold leading-tight text-[var(--color-text-primary)] sm:text-[28px]">
        O {leader.firstName} te convidou pro grupo{" "}
        <span className="text-[var(--color-brand-teal)]">{group.name}</span>
      </h1>
      <ParticipantAuthButtons token={token} />
      <TermsNotice token={token} />
    </div>
  );
}
