import type { ReactNode } from 'react';

// The nav bar, rendered as build.chrome before the page's <main>. No
// 'use client': it ships no JavaScript. Its children, the search island,
// sit at the end of the nav.
export default function SiteHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <a className="site-wordmark" href="/">
          slidedeck
        </a>
        <nav aria-label="Site">
          <a href="/docs/">Docs</a>
          <a href="/examples/">Examples</a>
          <a href="https://github.com/pedrosousa13/slidedeck">GitHub</a>
          <a className="site-install" href="/docs/install/">
            Install
          </a>
          {children}
        </nav>
      </div>
    </header>
  );
}
