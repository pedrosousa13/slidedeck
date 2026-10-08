interface Props {
  /** The page's address on the production origin, as its canonical. */
  url: string;
}

// The Open Graph tags build.head has no field for, rendered as build.chrome
// on every page. pagedeck moves them into the <head>. No 'use client': it
// ships no JavaScript.
export default function PageMeta({ url }: Props) {
  return (
    <>
      <meta property="og:url" content={url} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="slidedeck" />
    </>
  );
}
