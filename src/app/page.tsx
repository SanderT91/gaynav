import Link from "next/link";

export default function Home() {
  return (
    <main style={{ padding: "4rem 1.5rem", maxWidth: "40rem", margin: "0 auto" }}>
      <h1>GAYNAV</h1>
      <p style={{ marginTop: "1rem" }}>
        Curated LGBTQ+ travel. This is the foundation build — search and booking are not live yet.
      </p>
      <p style={{ marginTop: "1.5rem" }}>
        <Link href="/account">Your account</Link> · <Link href="/login">Sign in</Link>
      </p>
    </main>
  );
}
