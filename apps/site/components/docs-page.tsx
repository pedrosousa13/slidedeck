import { Children, Fragment, type ReactNode } from 'react';

export interface DocsLink {
  href: string;
  label: string;
  current: boolean;
}

export interface DocsSection {
  label: string;
  links: readonly DocsLink[];
}

interface Props {
  title: string;
  html: string;
  /** The page's `##` headings. */
  toc: readonly { text: string; slug: string }[];
  nav: readonly DocsSection[];
  previous?: DocsLink;
  next?: DocsLink;
  /** The page's live examples, in the order its demo markers name them. */
  children?: ReactNode;
}

// What is the same on every page, so search finds a page by its own words only.
const UNINDEXED = { 'data-fw-search': 'ignore' } as const;

// A run of demo markers, `<!-- demo:<name> -->`: one figure of examples.
const DEMOS = /((?:<!-- demo:[A-Za-z0-9_-]+ -->\s*)+)/;

/**
 * The page's HTML cut at each run of demo markers: the prose, then for each
 * run the examples it shows, from `start` to `end` in marker order, and the
 * prose after it.
 */
function splitAtDemos(html: string): {
  intro: string;
  runs: { start: number; end: number; prose: string }[];
} {
  const [intro = '', ...rest] = html.split(DEMOS);
  if (rest.length === 0) {
    // No example: the page is still cut where one would go, after the intro,
    // so before its first code block or `##` heading, as every page was cut
    // before the examples moved into demo markers (#133).
    const at = html.search(/<pre[\s>]|<h2[\s>]/);
    return at === -1
      ? { intro: html, runs: [] }
      : {
          intro: html.slice(0, at),
          runs: [{ start: 0, end: 0, prose: html.slice(at) }]
        };
  }
  const runs = [];
  let end = 0;
  for (let i = 0; i < rest.length; i += 2) {
    const start = end;
    end += rest[i]?.match(/<!-- demo:/g)?.length ?? 0;
    runs.push({ start, end, prose: rest[i + 1] ?? '' });
  }
  return { intro, runs };
}

/**
 * A code block scrolls sideways, so it takes focus for the keyboard, and a
 * table sits in a box that scrolls on a narrow screen.
 */
function prose(html: string): string {
  return html
    .replaceAll('<pre class="shiki', '<pre tabindex="0" class="shiki')
    .replaceAll('<table>', '<div class="docs-table" tabindex="0"><table>')
    .replaceAll('</table>', '</table></div>');
}

// A docs page: a sidebar, then the page. No 'use client': it ships no
// JavaScript. Only the examples, its children, are islands.
export default function DocsPage({
  title,
  html,
  toc,
  nav,
  previous,
  next,
  children
}: Props) {
  const { intro, runs } = splitAtDemos(prose(html));
  const examples = Children.toArray(children);
  return (
    <>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <div className="docs">
        <nav className="docs-sidebar" aria-label="Documentation" {...UNINDEXED}>
          {nav.map((section) => (
            <section key={section.label}>
              <h2>{section.label}</h2>
              <ul>
                {section.links.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      aria-current={link.current ? 'page' : undefined}
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </nav>
        <article className="docs-article">
          <h1>{title}</h1>
          {toc.length > 1 && (
            <nav className="docs-toc" aria-label="On this page" {...UNINDEXED}>
              <p>On this page</p>
              <ul>
                {toc.map((heading) => (
                  <li key={heading.slug}>
                    <a href={`#${heading.slug}`}>{heading.text}</a>
                  </li>
                ))}
              </ul>
            </nav>
          )}
          <div
            className="docs-prose"
            dangerouslySetInnerHTML={{ __html: intro }}
          />
          {runs.map(({ start, end, prose: after }, run) => {
            const id = run === 0 ? 'docs-example' : `docs-example-${run + 1}`;
            return (
              <Fragment key={id}>
                {end > start && (
                  <figure className="docs-example" aria-labelledby={id}>
                    <figcaption id={id} {...UNINDEXED}>
                      Example
                    </figcaption>
                    {examples.slice(start, end)}
                  </figure>
                )}
                {after !== '' && (
                  <div
                    className="docs-prose"
                    dangerouslySetInnerHTML={{ __html: after }}
                  />
                )}
              </Fragment>
            );
          })}
          {(previous !== undefined || next !== undefined) && (
            <nav
              className="docs-pager"
              aria-label="Previous and next"
              {...UNINDEXED}
            >
              {previous !== undefined && (
                <a href={previous.href} rel="prev">
                  <span>Previous</span> {previous.label}
                </a>
              )}
              {next !== undefined && (
                <a href={next.href} rel="next">
                  <span>Next</span> {next.label}
                </a>
              )}
            </nav>
          )}
        </article>
      </div>
    </>
  );
}
