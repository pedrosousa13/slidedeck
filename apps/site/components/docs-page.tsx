import { Children, type ReactNode } from 'react';

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
  /** The page's live examples, named in its frontmatter `components`. */
  children?: ReactNode;
}

// What is the same on every page, so search finds a page by its own words only.
const UNINDEXED = { 'data-fw-search': 'ignore' } as const;

/**
 * The page's HTML before and after the place its example goes: after the
 * intro, so before the page's first code block or `##` heading, or at the end.
 */
function splitIntro(html: string): [string, string] {
  const at = html.search(/<pre[\s>]|<h2[\s>]/);
  return at === -1 ? [html, ''] : [html.slice(0, at), html.slice(at)];
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
  const [intro, rest] = splitIntro(prose(html));
  return (
    <>
      <title>{`${title} · slidedeck`}</title>
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
          {Children.count(children) > 0 && (
            <figure className="docs-example" aria-labelledby="docs-example">
              <figcaption id="docs-example" {...UNINDEXED}>
                Example
              </figcaption>
              {children}
            </figure>
          )}
          {rest !== '' && (
            <div
              className="docs-prose"
              dangerouslySetInnerHTML={{ __html: rest }}
            />
          )}
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
