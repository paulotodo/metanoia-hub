import { CircleCheck } from "lucide-react";

interface InboxZeroStateProps {
  nextMeeting: { day: string; time: string } | null;
}

export function InboxZeroState({ nextMeeting }: InboxZeroStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <CircleCheck
        className="size-12 text-care-ok"
        aria-hidden="true"
      />
      <h2 className="text-lg font-semibold text-text-primary lg:text-2xl">
        Seu grupo está bem hoje
      </h2>
      {nextMeeting && (
        <p className="text-sm text-text-secondary lg:text-base">
          Próxima reunião: {nextMeeting.day} às {nextMeeting.time}
        </p>
      )}
    </div>
  );
}
