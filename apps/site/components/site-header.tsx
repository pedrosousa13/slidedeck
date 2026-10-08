// The package README, until the site has its own docs (#110) and examples
// (#109): pagedeck refuses a link to a page the build does not emit.
const README =
  'https://github.com/pedrosousa13/slidedeck/tree/main/packages/react';

// The nav bar, rendered as build.chrome before the page's <main>. No
// 'use client': it ships no JavaScript.
export default function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <a className="site-wordmark" href="/">
          slidedeck
        </a>
        <nav aria-label="Site">
          <a href={`${README}#readme`}>Docs</a>
          <a href={`${README}#recipes`}>Examples</a>
          <a href="https://github.com/pedrosousa13/slidedeck">GitHub</a>
          <a className="site-install" href={`${README}#install`}>
            Install
          </a>
        </nav>
      </div>
    </header>
  );
}
