import { Claim } from '@/components/Claim';
import { IS_SKY_DEPLOYED } from '@/lib/robinhood';

export default function ClaimPage() {
  return (
    <main>
      {IS_SKY_DEPLOYED ? (
        <Claim />
      ) : (
        <p className="muted">The Sky is not deployed yet; nothing can be inscribed.</p>
      )}
    </main>
  );
}
