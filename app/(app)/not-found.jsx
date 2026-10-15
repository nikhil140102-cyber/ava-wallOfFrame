import Link from "next/link";
import { Icon } from "@/components/Icon";

export default function NotFound() {
  return (
    <main className="page page-narrow">
      <div className="card empty">
        <span className="empty-icon">
          <Icon name="search" size={26} />
        </span>
        <h3>Not found</h3>
        <p>This page or post doesn&apos;t exist, or it was deleted.</p>
        <Link href="/home" className="btn btn-tinted" style={{ marginTop: 8 }}>
          Back to Home
        </Link>
      </div>
    </main>
  );
}
