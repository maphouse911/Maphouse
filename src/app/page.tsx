import Link from "next/link";
import { commodityThemes } from "./data";

export default function Home() {
  const featured = commodityThemes[0];

  return (
    <div className="maphouse-shell min-h-screen px-6 py-8 md:px-10">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="paper-card flex flex-wrap items-center justify-between gap-4 px-6 py-4">
          <Link href="/" className="font-[family-name:var(--font-display)] text-3xl font-semibold">
            maphouse_
          </Link>
          <nav className="flex items-center gap-3 text-sm text-[var(--muted)]">
            <Link href="/map" className="rounded-full border border-[var(--line)] px-4 py-2 hover:bg-white">
              Interactive Map
            </Link>
            <Link href="/topics" className="rounded-full border border-[var(--line)] px-4 py-2 hover:bg-white">
              Topics
            </Link>
            <Link href="/about" className="rounded-full border border-[var(--line)] px-4 py-2 hover:bg-white">
              About
            </Link>
          </nav>
        </header>

        <section className="paper-card grid gap-6 p-7 md:grid-cols-[1.2fr,0.8fr] md:p-10">
          <div className="space-y-5">
            <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">MapHouse / MVP v1</p>
            <h1 className="font-[family-name:var(--font-display)] text-4xl leading-tight md:text-6xl">
              Geography Meets Finance
            </h1>
            <p className="max-w-xl text-lg text-[var(--muted)]">
              用地圖探索金融市場、產業脈動與世界變化。MapHouse 將 IG 圖文升級為可互動的研究型平台。
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/map" className="rounded-full bg-[var(--foreground)] px-5 py-2.5 text-sm text-white">
                Start with Commodities
              </Link>
              <Link href="/about" className="rounded-full border border-[var(--line)] px-5 py-2.5 text-sm">
                Why Map-Driven?
              </Link>
            </div>
          </div>
          <div className="rounded-2xl border border-[var(--line)] bg-white/80 p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Featured Theme</p>
            <h2 className="mt-2 font-[family-name:var(--font-display)] text-3xl">{featured.title}</h2>
            <p className="mt-3 text-sm text-[var(--muted)]">{featured.subtitle}</p>
            <ul className="mt-5 space-y-2 text-sm">
              {featured.insights.map((item) => (
                <li key={item.id} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2">
                  <span className="font-semibold">{item.region}</span> · {item.metric}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          {[
            "Financial Market Maps",
            "Commodity Maps",
            "Industry & Supply Chain",
            "M&A Expansion Paths",
          ].map((title, i) => (
            <article key={title} className="paper-card p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Pillar 0{i + 1}</p>
              <h3 className="mt-3 text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-[var(--muted)]">Map-first storytelling with short, strategic insights.</p>
            </article>
          ))}
        </section>

        <section className="paper-card p-7 md:p-9">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">Selected Insight</p>
          <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl md:text-4xl">
            Markets are not just numbers. They are mapped structures.
          </h2>
          <p className="mt-4 max-w-3xl text-[var(--muted)]">
            從產地、貿易路徑到終端價格，MapHouse 透過可視化與互動，幫助讀者更快建立全球市場直覺。
          </p>
        </section>
      </main>
    </div>
  );
}
        </div>
        <div className="flex flex-col gap-4 text-base font-medium sm:flex-row">
          <a
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc] md:w-[158px]"
            href="https://vercel.com/new?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Image
              className="dark:invert"
              src="/vercel.svg"
              alt="Vercel logomark"
              width={16}
              height={16}
            />
            Deploy Now
          </a>
          <a
            className="flex h-12 w-full items-center justify-center rounded-full border border-solid border-black/[.08] px-5 transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a] md:w-[158px]"
            href="https://nextjs.org/docs?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
          >
            Documentation
          </a>
        </div>
      </main>
    </div>
  );
}
