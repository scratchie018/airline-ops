import { ReactNode } from "react";
import { Link } from "react-router-dom";
import BuildInfo from "../components/BuildInfo";

const REPO_URL = "https://github.com/scratchie018/airline-ops";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted mb-2">{title}</h2>
      <div className="text-sm text-ink space-y-2">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <div className="min-h-full bg-bg">
      <div className="mx-auto max-w-2xl px-4 py-10">
        <Link to="/login" className="text-sm text-brand-300 hover:text-brand-200 hover:underline mb-6 inline-block">
          <i className="fa-solid fa-arrow-left mr-1.5" /> Back
        </Link>

        <h1 className="text-2xl font-bold text-ink mb-1">Privacy &amp; verification</h1>
        <p className="text-ink-muted mb-6">What this app collects, what it doesn't, and how to check it yourself.</p>

        <div className="bg-accent border rounded-xl p-5">
          <Section title="What signing in with Discord gives us">
            <p>
              Just your Discord user ID, username, and avatar (the OAuth <code className="text-xs">identify</code>{" "}
              scope) - stored so the app knows who you are on your next visit.
            </p>
            <p>
              We also ask for your list of Discord servers (the <code className="text-xs">guilds</code> scope), but
              only to check, once at login, whether you're already in an airline's Discord server - if so you're
              added as a Passenger there automatically. That list itself isn't stored anywhere.
            </p>
            <p>
              Your Discord access token is used for those two lookups during login and then discarded - it's never
              saved to a database and never used again after that.
            </p>
            <p className="text-ink-muted">
              We never see your email, your DMs, or the content of any channel. This app can't message anyone as
              you or read anything you haven't explicitly shown it.
            </p>
          </Section>

          <Section title="How your role is decided">
            <p>
              Each airline's own Discord bot reads your roles in <em>their</em> server using the bot's own
              permissions, not your personal login - that's how "Pilot," "Manager," etc. stay in sync with your
              Discord roles without this app ever touching your account directly.
            </p>
          </Section>

          <Section title="Staying signed in">
            <p>
              After login you get a signed token kept in your browser and sent with each request to prove who you
              are. There's no separate server-side session store to be breached independently of that token.
            </p>
          </Section>

          <Section title="Anyone else involved?">
            <p>
              Discord, for the login itself. And, only if an airline's Owner has set one up, a Discord webhook URL{" "}
              <em>they</em> configured, used solely to post that airline's own flight announcements to a channel
              they chose - not something this app reaches out to on its own for any other reason.
            </p>
          </Section>

          <Section title="Verifying this yourself">
            <p>
              The full source is public: <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="text-brand-300 hover:text-brand-200 hover:underline">{REPO_URL}</a>.
              Everything above is implemented in <code className="text-xs">packages/server/src/routes/auth.ts</code>{" "}
              and <code className="text-xs">packages/server/src/services/discordAuth.ts</code> - read it yourself
              rather than take our word for it.
            </p>
            <p>
              Every build also stamps the exact git commit it was compiled from (shown at the bottom of this page).
              Open that commit on GitHub and you're looking at literally the code this site is running - not just
              "code that exists somewhere in the repo."
            </p>
          </Section>
        </div>

        <div className="mt-6 text-center">
          <BuildInfo />
        </div>
      </div>
    </div>
  );
}
