import HeartLogo from "./HeartLogo";

export default function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <main className="safe-top safe-bottom flex min-h-[100dvh] items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <HeartLogo />
          <span className="mt-3 text-lg font-extrabold tracking-tight text-brand-600">usie</span>
          <h1 className="mt-4 text-3xl font-extrabold text-ink dark:text-white">{title}</h1>
          <p className="mt-2 max-w-[18rem] text-sm text-ink-muted">{subtitle}</p>
        </div>
        {children}
      </div>
    </main>
  );
}
