/**
 * Legal.tsx — the small print, in plain language (LAUNCH_PLAN.md L2). Two public
 * pages (/terms, /privacy) served by the SPA fallback, honest about the three things
 * that matter here: what we store, that an AI writes the creature's diary, and that
 * we neither run ads nor sell data. Update the date when the words change.
 */

const UPDATED = 'July 2026';

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="legal">
      <p className="intro-kicker">Amabo · the Amarium</p>
      <h1 className="legal-title">{title}</h1>
      <p className="legal-updated">Last updated {UPDATED}</p>
      {children}
      <p className="legal-footer">
        <a href="/">← back to the glass</a> · <a href="/terms">Terms</a> ·{' '}
        <a href="/privacy">Privacy</a>
      </p>
    </main>
  );
}

export function TermsPage() {
  return (
    <Shell title="Terms of Service">
      <h2>The short version</h2>
      <p>
        Amabo is a virtual-creature game. You care for a small light in a glass world; an AI helps
        write what it thinks and feels. Be kind — to your creature and to other Lights.
      </p>
      <h2>Who may play</h2>
      <p>
        You must be <strong>13 or older</strong> to hold an account. If you are under 18, make sure
        a parent or guardian is okay with you playing.
      </p>
      <h2>Your account</h2>
      <p>
        You sign in with an email link or Google — no passwords are stored. You are responsible for
        what happens under your account. You can delete your account (and everything in it) at any
        time from Settings.
      </p>
      <h2>The creatures and their words</h2>
      <p>
        Creature journals, letters and gatherings are generated — partly by simple rules, partly by
        an AI model. They are fiction, told in the voice of your creature. Don’t treat them as
        advice of any kind.
      </p>
      <h2>Fair play</h2>
      <p>
        Don’t abuse the service: no automated scraping, no flooding, no trying to reach another
        Light’s creatures (everything is owner-scoped, and we rate-limit). Share links you mint are
        yours to revoke.
      </p>
      <h2>Paid things (when they arrive)</h2>
      <p>
        Some conveniences may cost money one day — more room on the shelf, a richer voice. The heart
        of the game never will: caring for a creature, its souring, illness, endings and redemption
        are never sold, gated, or metered.
      </p>
      <h2>The service</h2>
      <p>
        Amabo is provided as-is, by a very small team. We may change or discontinue features; if we
        ever shut the Amarium, we’ll give you notice and a way to export your creatures’ stories.
      </p>
      <h2>Contact</h2>
      <p>
        Questions: <a href="mailto:dvdsellam@gmail.com?subject=Amabo">dvdsellam@gmail.com</a>
      </p>
    </Shell>
  );
}

export function PrivacyPage() {
  return (
    <Shell title="Privacy Policy">
      <h2>The short version</h2>
      <p>
        We store the minimum needed to run the game, in our own database. No ads. No selling data.
        No third-party trackers.
      </p>
      <h2>What we store</h2>
      <ul>
        <li>
          <strong>Account:</strong> your email address, display name, sign-in method, and your
          stated age band (13–17 or 18+).
        </li>
        <li>
          <strong>Game state:</strong> your creatures, their journals, memories, friendships,
          letters, share links and gatherings.
        </li>
        <li>
          <strong>Product signals:</strong> small named events (a visit, a signup, a care action)
          tied to a random device id — used only to understand and improve the game.
        </li>
        <li>
          <strong>Errors:</strong> crash reports (the error message and where it happened) so we can
          fix things.
        </li>
      </ul>
      <h2>The AI</h2>
      <p>
        Your creature’s diary is written with the help of an AI model (Anthropic’s Claude). What we
        send it: the creature’s name, its state, and its short memories. What we never send it: your
        email or anything about your identity.
      </p>
      <h2>Cookies</h2>
      <p>
        One session cookie to keep you signed in, one CSRF cookie to keep requests safe. No
        advertising or cross-site cookies, ever.
      </p>
      <h2>Children</h2>
      <p>
        Amabo is not for children under 13, and we don’t knowingly keep accounts for them. If you
        believe a child under 13 holds an account, write to us and we will delete it.
      </p>
      <h2>Your rights</h2>
      <p>
        Delete your account any time from Settings — it erases your creatures, journals, bonds,
        letters, share links, notifications and product signals, immediately. For anything else,
        email <a href="mailto:dvdsellam@gmail.com?subject=Amabo%20privacy">dvdsellam@gmail.com</a>.
      </p>
    </Shell>
  );
}
