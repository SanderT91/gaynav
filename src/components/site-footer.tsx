import Link from "next/link";
import { CITIES } from "@/lib/cities";

// Shared footer for every page: the cities and the information pages.
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div>
          <p className="wordmark wordmark--footer">GAYNAV</p>
          <p className="muted">
            Hotels reviewed by a person on our team before they&apos;re listed.
          </p>
        </div>
        <nav aria-label="Cities">
          <h2 className="site-footer__heading">Cities</h2>
          <ul>
            {CITIES.map((c) => (
              <li key={c.slug}>
                <Link href={`/cities/${c.slug}`}>{c.name}</Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="GAYNAV">
          <h2 className="site-footer__heading">GAYNAV</h2>
          <ul>
            <li>
              <Link href="/about">About</Link>
            </li>
            <li>
              <Link href="/privacy">Privacy</Link>
            </li>
            <li>
              <Link href="/terms">Terms</Link>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
