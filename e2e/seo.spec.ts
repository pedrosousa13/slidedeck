import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

// The built site's metadata, page by page: what a search engine and a share
// card read. The site is served as in e2e/site.spec.ts; SITE_URL moves it.
test.use({ baseURL: process.env.SITE_URL ?? 'http://127.0.0.1:4174' });

// The production origin, as SITE_ORIGIN in apps/site/lib/seo.ts declares it.
// Every canonical, og:url and sitemap entry names it, whatever host serves
// the build.
const ORIGIN = 'https://slidedeck.pages.dev';

// The build's output, which playwright.config.ts builds before the tests run.
const OUT = fileURLToPath(new URL('../apps/site/site/', import.meta.url));

/** Every page the build wrote, as its path: `/`, `/docs/guides/loop/`. */
function builtPages(): string[] {
  return readdirSync(OUT, { recursive: true, encoding: 'utf8' })
    .filter((file) => file === 'index.html' || file.endsWith('/index.html'))
    .map((file) => `/${file.slice(0, -'index.html'.length)}`)
    .sort();
}

interface Head {
  lang: string | null;
  titles: string[];
  descriptions: string[];
  canonicals: string[];
  meta: Record<string, string[]>;
  h1s: number;
  jsonLd: unknown[];
}

/** What a crawler reads from the page's HTML, before any script runs. */
async function headOf(page: Page, path: string): Promise<Head> {
  await page.goto(path);
  return page.evaluate(() => {
    const all = (selector: string) => [...document.querySelectorAll(selector)];
    const meta: Record<string, string[]> = {};
    for (const tag of all('meta[property], meta[name]')) {
      const key = tag.getAttribute('property') ?? tag.getAttribute('name')!;
      (meta[key] ??= []).push(tag.getAttribute('content') ?? '');
    }
    return {
      lang: document.documentElement.getAttribute('lang'),
      titles: all('title').map((title) => title.textContent ?? ''),
      descriptions: meta['description'] ?? [],
      canonicals: all('link[rel="canonical"]').map(
        (link) => link.getAttribute('href') ?? ''
      ),
      meta,
      h1s: all('h1').length,
      jsonLd: all('script[type="application/ld+json"]').map(
        (script) => JSON.parse(script.textContent ?? 'null') as unknown
      )
    };
  });
}

// The HTML is the same in every browser, so one reads it.
test.describe('every built page', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'HTML only');

  let heads: Map<string, Head>;
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage({
      baseURL: process.env.SITE_URL ?? 'http://127.0.0.1:4174',
      javaScriptEnabled: false
    });
    heads = new Map();
    for (const path of builtPages()) heads.set(path, await headOf(page, path));
    await page.close();
  });

  test('there are pages to check', () => {
    expect(heads.size).toBeGreaterThan(1);
  });

  test('has one title, unique to it', () => {
    for (const [path, head] of heads) {
      expect.soft(head.titles, path).toHaveLength(1);
    }
    const titles = [...heads.values()].map((head) => head.titles[0]);
    expect(new Set(titles).size, 'titles are unique').toBe(titles.length);
  });

  test('has one description of 50 to 160 characters, unique to it', () => {
    for (const [path, head] of heads) {
      expect.soft(head.descriptions, path).toHaveLength(1);
      const length = head.descriptions[0]?.length ?? 0;
      expect
        .soft(length, `${path} description length`)
        .toBeGreaterThanOrEqual(50);
      expect
        .soft(length, `${path} description length`)
        .toBeLessThanOrEqual(160);
    }
    const descriptions = [...heads.values()].map(
      (head) => head.descriptions[0]
    );
    expect(new Set(descriptions).size, 'descriptions are unique').toBe(
      descriptions.length
    );
  });

  test('has a canonical on the production origin', () => {
    for (const [path, head] of heads) {
      expect.soft(head.canonicals, path).toEqual([`${ORIGIN}${path}`]);
    }
  });

  test('has Open Graph and Twitter card tags, with its own image', () => {
    for (const [path, head] of heads) {
      const one = (key: string) => {
        expect.soft(head.meta[key], `${path} ${key}`).toHaveLength(1);
        return head.meta[key]?.[0] ?? '';
      };
      expect.soft(one('og:title'), path).toBe(head.titles[0]);
      expect.soft(one('og:description'), path).toBe(head.descriptions[0]);
      expect.soft(one('og:url'), path).toBe(`${ORIGIN}${path}`);
      expect.soft(one('og:type'), path).not.toBe('');
      expect.soft(one('twitter:card'), path).toBe('summary_large_image');
      const image = new URL(one('og:image'), ORIGIN);
      expect.soft(image.origin, `${path} og:image`).toBe(ORIGIN);
      expect
        .soft(existsSync(`${OUT}${image.pathname.slice(1)}`), image.pathname)
        .toBe(true);
    }
  });

  test('is in English and has one level-1 heading', () => {
    for (const [path, head] of heads) {
      expect.soft(head.lang, path).toBe('en');
      expect.soft(head.h1s, `${path} <h1> count`).toBe(1);
    }
  });

  test('describes the landing page as source code, and each docs page by its trail', () => {
    expect(heads.get('/')!.jsonLd).toEqual([
      expect.objectContaining({
        '@context': 'https://schema.org',
        '@type': 'SoftwareSourceCode',
        name: 'slidedeck',
        description: heads.get('/')!.descriptions[0],
        codeRepository: 'https://github.com/pedrosousa13/slidedeck',
        programmingLanguage: 'TypeScript',
        license: 'https://opensource.org/licenses/MIT'
      })
    ]);
    for (const [path, head] of heads) {
      if (!path.startsWith('/docs/')) continue;
      const [trail] = head.jsonLd as {
        '@type': string;
        itemListElement: { position: number; item?: string; name: string }[];
      }[];
      expect.soft(trail?.['@type'], path).toBe('BreadcrumbList');
      const items = trail?.itemListElement ?? [];
      expect.soft(items.at(-1)?.item, path).toBe(`${ORIGIN}${path}`);
      expect
        .soft(
          items.map((item) => item.position),
          path
        )
        .toEqual(items.map((_, i) => i + 1));
    }
  });
});

test.describe('the crawler files', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'HTTP only');

  test('the sitemap lists exactly the built pages', async ({ request }) => {
    const index = await (await request.get('/sitemap.xml')).text();
    const sitemaps = [...index.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
      (match) => new URL(match[1]!).pathname
    );
    expect(sitemaps.length).toBeGreaterThan(0);
    const urls: string[] = [];
    for (const sitemap of sitemaps) {
      const xml = await (await request.get(sitemap)).text();
      for (const match of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
        urls.push(match[1]!);
      }
    }
    expect(urls.sort()).toEqual(builtPages().map((path) => `${ORIGIN}${path}`));
  });

  test('robots.txt allows every page and points at the sitemap', async ({
    request
  }) => {
    const robots = await (await request.get('/robots.txt')).text();
    expect(robots).not.toMatch(/^Disallow: *\/\S*/m);
    expect(robots).toContain(`Sitemap: ${ORIGIN}/sitemap.xml`);
  });

  test('the icons a browser asks for unprompted are there', async ({
    request
  }) => {
    for (const [path, type] of [
      ['/favicon.ico', 'image/'],
      ['/apple-touch-icon.png', 'image/png']
    ] as const) {
      const response = await request.get(path);
      expect.soft(response.status(), path).toBe(200);
      expect.soft(response.headers()['content-type'], path).toContain(type);
    }
  });
});
