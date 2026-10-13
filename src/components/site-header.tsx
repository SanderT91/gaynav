import Image from "next/image";
import Link from "next/link";

// Shared header for every page: wordmark, main navigation, sign-in.
// The "GN" mark is the logo from the old gaynav.com (PNG, 317×245); a vector
// version is still to come from the owner (CLAUDE.md, Open items).
export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link href="/" className="wordmark" aria-label="GAYNAV home">
          <Image src="/brand/logo-gn.png" alt="" width={42} height={32} priority />
          GAYNAV
        </Link>
        <nav aria-label="Main" className="site-nav">
          <Link href="/#cities">Cities</Link>
          <Link href="/search">Find a hotel</Link>
          <Link href="/how-we-vet">How we vet</Link>
          <Link href="/about">About</Link>
          <Link href="/login" className="button button--small">
            Sign in
          </Link>
        </nav>
      </div>
    </header>
  );
}
