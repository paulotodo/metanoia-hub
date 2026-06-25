export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header />
      <main id="conteudo" className="flex min-h-screen items-center justify-center bg-surface-base p-4">
        {children}
      </main>
      <footer />
    </>
  );
}
