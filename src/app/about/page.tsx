import Link from "next/link";

export default function AboutPage() {
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
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">About MapHouse</p>
          <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl md:text-5xl">
            地圖是語言，金融與產業是內容。
          </h1>
          <p className="mt-5 max-w-3xl leading-8 text-[var(--muted)]">
            我是張育誠 Vincent Chang。MapHouse 是我把地理視角、金融分析、產業研究與 M&A 興趣整合成的內容平台。從
            Instagram 的地圖圖文出發，MapHouse 下一步是成為可以互動探索、持續累積的數位研究產品。
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {[
            ["Research Focus", "Commodities, markets, supply chain, and strategic expansion."],
            ["Method", "Map-first storytelling with concise strategic commentary."],
            ["Direction", "From visual posts to a long-term analytical platform."],
          ].map(([title, desc]) => (
            <article key={title} className="paper-card p-5">
              <h2 className="text-lg font-semibold">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{desc}</p>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}

