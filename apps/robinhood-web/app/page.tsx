import Link from 'next/link';
import { MyStars } from '@/components/MyStars';
import { Seats } from '@/components/Seats';
import { Wallet } from '@/components/Wallet';
import {
  APP_URL,
  IS_SKY_DEPLOYED,
  LUMEN_ADDRESS,
  ROBINHOOD_CHAIN_ID,
  STAR_ADDRESS,
  ZERO_ADDRESS,
} from '@/lib/robinhood';

export default function Home() {
  return (
    <main>
      <h1>The Sky</h1>
      <p>
        Inside a sealed glass world, the Amarium, a creature lives on its own clock and grows into
        someone based on how it is treated. When it is loved fully enough it becomes too bright for
        the glass and ascends — leaving a <strong>named star</strong> its Light can always find.
        This is the firmament outside the glass, where those stars are hung for anyone to look up
        at.
      </p>
      <p>
        An <strong>inscribed star</strong> is <em>earned</em>: only the Light who raised a soul to
        Elysium may strike it, one of one. An <strong>unnamed star</strong> is <em>bought</em>: a
        seat in the Sky, waiting to be called — and nothing in the glass, ever. Ambra, the
        love-light, is never sold. Neither a star nor a coin feeds, cures, or revives anything.
      </p>
      <p>
        <Link href="/sky" className="button">
          Look up ✦
        </Link>{' '}
        <a href={APP_URL} className="button">
          Raise one yourself ↗
        </a>
      </p>

      {!IS_SKY_DEPLOYED ? (
        <section>
          <p className="muted">
            The Sky is not deployed yet. <code>forge script script/Deploy.s.sol</code> writes{' '}
            <code>deployments/{ROBINHOOD_CHAIN_ID}.json</code>; its <code>star</code> address is the
            firmament.
          </p>
        </section>
      ) : (
        <>
          <section>
            <h2>Your wallet</h2>
            <Wallet />
            <p className="muted">
              stars <code>{STAR_ADDRESS}</code>
              {LUMEN_ADDRESS !== ZERO_ADDRESS && (
                <>
                  {' '}
                  · Lumen <code>{LUMEN_ADDRESS}</code>
                </>
              )}{' '}
              · Robinhood Chain {ROBINHOOD_CHAIN_ID}
            </p>
          </section>
          <MyStars />
          <Seats />
        </>
      )}
    </main>
  );
}
