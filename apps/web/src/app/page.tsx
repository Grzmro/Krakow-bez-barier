import { pl } from "@/i18n/pl";

export default function Home() {
  return (
    <main id="main" tabIndex={-1} className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-3 px-4 py-10">
      <h1 className="font-heading text-display font-extrabold text-foreground">{pl.home.title}</h1>
      <p className="text-body text-muted-foreground">{pl.home.lead}</p>
    </main>
  );
}
