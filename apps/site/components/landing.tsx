// The landing page at /. A server component: it ships no JavaScript of its
// own. Its two decks are islands, each a 'use client' module of its own.
import CurveDeck from './curve-deck.tsx';
import FeatureDeck from './feature-deck.tsx';
import { install, libraries, quickstart, size, version } from '../lib/facts.ts';
import { SLIDEDECK } from '../lib/readme.ts';

const REPO = 'https://github.com/pedrosousa13/slidedeck';
const README = `${REPO}/tree/main/packages/react`;

/** A README cell's text, its `code spans` as <code>. */
function Cell({ text }: { text: string }) {
  return text
    .split('`')
    .map((part, i) => (i % 2 === 1 ? <code key={i}>{part}</code> : part));
}

export default function Landing() {
  return (
    <>
      <section className="landing-hero">
        <p className="landing-eyebrow">slidedeck {version}</p>
        <h1>Smooth. Natively.</h1>
        <p className="landing-lede">
          A carousel for React that lets the browser do the scrolling. Native
          momentum, native snapping and native focus scrolling, in {size}{' '}
          min+gzip.
        </p>
        <div className="landing-actions">
          <a className="landing-button" href={`${README}#quickstart`}>
            Get started
          </a>
          <a href={REPO}>View on GitHub ›</a>
        </div>
      </section>

      <section className="landing-features" aria-labelledby="features">
        <h2 id="features">Get to know slidedeck.</h2>
        <FeatureDeck />
      </section>

      <section className="landing-band" aria-labelledby="native">
        <h2 id="native">
          Feels native. <span>Because it is.</span>
        </h2>
        <ul className="landing-stats">
          <li>
            <strong>{size}</strong> min+gzip, React external
          </li>
          <li>
            <strong>0</strong> stylesheets required
          </li>
          <li>
            <strong>React 19</strong> server components render it
          </li>
        </ul>
      </section>

      <section className="landing-curve" aria-labelledby="curve">
        <p className="landing-eyebrow">
          <code>effect={'{curve}'}</code>
        </p>
        <h2 id="curve">Scroll it. It bends.</h2>
        <CurveDeck />
      </section>

      <section className="landing-quickstart" aria-labelledby="quickstart">
        <div>
          <h2 id="quickstart">
            A few components.
            <br />
            One deck.
          </h2>
          <p>
            Prev and Next buttons, a dot per page and a “1 / 3” counter. No
            stylesheet is needed. Style it with plain CSS when you want to.
          </p>
          <code className="landing-install">{install}</code>
          <a href={`${README}#readme`}>Read the docs ›</a>
        </div>
        <div
          className="landing-code"
          dangerouslySetInnerHTML={{ __html: quickstart }}
        />
      </section>

      <section className="landing-band" aria-labelledby="compare">
        <h2 id="compare">Compare.</h2>
        <ul className="landing-compare">
          {libraries.map((row) => (
            <li key={row.library}>
              <h3>
                <code>{row.library}</code>
                {/* Slidedeck's row is this repo's build, with no version. */}
                {row.library !== SLIDEDECK && ` ${row.version}`}
              </h3>
              <strong>{row.size}</strong>
              <p>
                <Cell text={row.nativeScroll} />
              </p>
              <p>
                <Cell text={row.accessibility} />
              </p>
            </li>
          ))}
        </ul>
        <p className="landing-note">
          Min+gzip of the same basic deck in each, React external, measured by{' '}
          <code>pnpm compare</code>.{' '}
          <a href={`${README}#comparison-with-embla-and-keen`}>
            How it is measured ›
          </a>
        </p>
      </section>
    </>
  );
}
