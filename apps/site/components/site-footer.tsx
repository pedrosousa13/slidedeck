// The footer, rendered as build.chrome after the page's <main>. No
// 'use client': it ships no JavaScript.
export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <span>MIT licensed.</span>
        <span>Built with pagedeck. Served by Cloudflare.</span>
      </div>
    </footer>
  );
}
