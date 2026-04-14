/**
 * 05.3 Criar Conta Admin — stub (Session 0).
 * Real UI is built in Session 3.
 */
export default async function CriarContaStubPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <section className="mx-auto max-w-md px-6 py-12 text-center">
      <h1 className="text-2xl font-bold">Criar Conta Admin</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Stub — Cenário 05, página 05.3.
      </p>
      <p className="mt-4 break-all font-mono text-xs">token: {token}</p>
    </section>
  );
}
