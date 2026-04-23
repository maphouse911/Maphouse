import Link from "next/link";

const topics = [
  { title: "Financial Market Maps", desc: "Rates, equity structure, currency, and macro signals." },
  { title: "Commodity Maps", desc: "Origins, net exports, logistics, and price sensitivity." },
  { title: "Industry & Supply Chain", desc: "Semiconductor, AI chain, and manufacturing geography." },
  { title: "M&A Expansion Paths", desc: "Corporate expansion routes and strategic map implications." },
];

export default function TopicsPage() {
  return (
    <div className="maphouse-shell min-h-screen px-6 py-8 md:px-10">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="paper-card flex items-center justify-between px-6 py-4">
          <Link href="/" className="font-[family-name:var(--font-display)] text-3xl font-semibold">
            maphouse_
          </Link>
          <Link href="/map" className="text-sm text-[var(--muted)]">
            Interactive Map
          </Link>
        </header>

        <section className="paper-card p-7 md:p-10">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Works / Topics</p>
          <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl">A map-centric research library</h1>
          <p className="mt-3 text-[var(--muted)]">第一版先聚焦主題策展，後續可擴充每個主題的專頁與資料來源。</p>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          {topics.map((topic) => (
            <article key={topic.title} className="paper-card p-6">
              <h2 className="text-2xl font-semibold">{topic.title}</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{topic.desc}</p>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}

