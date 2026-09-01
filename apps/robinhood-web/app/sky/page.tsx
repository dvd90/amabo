import { Gallery } from '@/components/Gallery';
import { IS_SKY_DEPLOYED } from '@/lib/robinhood';

export default function SkyPage() {
  return (
    <main>
      {IS_SKY_DEPLOYED ? (
        <Gallery />
      ) : (
        <p className="muted">The Sky is not deployed yet; there is nothing to look up at.</p>
      )}
    </main>
  );
}
