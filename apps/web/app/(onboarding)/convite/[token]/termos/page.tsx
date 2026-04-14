/**
 * 05.2 Termos e LGPD — stub (Session 0).
 * Real UI is built in Session 2.
 */
export default async function TermosStubPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <section className="mx-auto max-w-md px-6 py-12 text-center">
      <h1 className="text-2xl font-bold">Termos e LGPD</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Stub — Cenário 05, página 05.2.
      </p>
      <p className="mt-4 break-all font-mono text-xs">token: {token}</p>
    </section>
  );
}
