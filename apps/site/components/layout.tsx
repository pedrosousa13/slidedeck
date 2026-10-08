import type { ReactNode } from 'react';

interface Props {
  title: string;
  html: string;
  children?: ReactNode;
}

// pagedeck hoists the <meta> into the document's <head>. The title is
// build.head's, from lib/seo.ts.
export default function Layout({ title, html, children }: Props) {
  return (
    <>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      {/* A page with no body, as the landing page, is its components alone. */}
      {html.trim() === '' ? (
        children
      ) : (
        <article className="site-page">
          <h1>{title}</h1>
          <div dangerouslySetInnerHTML={{ __html: html }} />
          {children}
        </article>
      )}
    </>
  );
}
