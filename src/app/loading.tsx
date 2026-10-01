import { SiteHeader } from "@/components/site-header/site-header";
import { Skeleton } from "@/components/ui/skeleton";

/** Shown while a navigation to the home is waiting for the catalog; mirrors the real layout heights. */
export default function Loading() {
  return (
    <main className="site-shell" aria-busy="true">
      <SiteHeader />
      <section className="hero hero-skeleton" aria-hidden="true" />
      <section className="menu-section">
        <div className="menu-heading"><Skeleton width={260} height={44} /></div>
        <div className="product-grid">
          {Array.from({ length: 6 }, (_, index) => (
            <article className="product-card product-card-skeleton" key={index}>
              <Skeleton /><Skeleton width="60%" /><Skeleton width="90%" /><Skeleton width="40%" />
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
