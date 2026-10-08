// The examples' photos: Unsplash photos, by way of Lorem Picsum, cropped and
// saved as WebP at the size they are shown, in public/photos. Each is credited
// on /examples/ with a link to its page on Unsplash. A photo shown wide also
// has smaller copies, `<name>-<width>.webp`, resized from it with sharp, so a
// phone fetches the one its screen needs (#122).

export interface Photo {
  src: string;
  /** The file's own pixel size, so the browser reserves its box. */
  width: number;
  height: number;
  alt: string;
  author: string;
  /** The photo's page on Unsplash. */
  url: string;
  /** What it shows, in English, for the credits. */
  subject: string;
  /** Every copy, by its width, when there are smaller ones. */
  srcSet?: string;
  /** How wide the photo is shown, for `srcSet`. */
  sizes?: string;
}

const photo = (
  name: string,
  width: number,
  height: number,
  alt: string,
  author: string,
  id: string,
  subject: string
): Photo => ({
  src: `/photos/${name}.webp`,
  width,
  height,
  alt,
  author,
  url: `https://unsplash.com/photos/${id}`,
  subject
});

/** `photo`, with its smaller copies and how wide it is shown. */
const responsive = (
  widths: readonly number[],
  sizes: string,
  original: Photo
): Photo => ({
  ...original,
  srcSet: [
    ...widths.map(
      (width) =>
        `${original.src.replace(/\.webp$/, `-${width}.webp`)} ${width}w`
    ),
    `${original.src} ${original.width}w`
  ].join(', '),
  sizes
});

// How wide each set is shown, from styles/examples.css.
// The gallery: the page's column, at most 960px.
const product = (...args: Parameters<typeof photo>) =>
  responsive(
    [480, 800],
    '(min-width: 1004px) 960px, calc(100vw - 44px)',
    photo(...args)
  );
// The hero: the page's width, or wider on a phone, where its 420px height
// crops a 2:1 photo.
const scene = (...args: Parameters<typeof photo>) =>
  responsive([720], 'max(100vw, 840px)', photo(...args));
// The stories: a frame at most 340px wide.
const story = (...args: Parameters<typeof photo>) =>
  responsive([360], 'min(340px, calc(100vw - 44px))', photo(...args));
// The places: cards min(280px, 72vw) wide.
const place = (...args: Parameters<typeof photo>) =>
  responsive([320], 'min(280px, 72vw)', photo(...args));

const HEELS = ['Alejandro Escamilla', 'jVb0mSn0LbE', 'Heels'] as const;
const CARRY = ['Vadim Sherbakov', 'tCICLJ5ktBE', 'Everyday carry'] as const;
const MUG = ['Shyamanta Baruah', 'aeVA-j1y2BY', 'Stamp mug'] as const;
const COFFEE = ['Justin Leibow', 'ZJsseAxEcqM', 'Coffee on red'] as const;
const FOREST = ['Paul Jarvis', '6J--NXulQCs', 'Forest and sound'] as const;
const VALLEY = ['Paul Jarvis', 'Cm7oKel-X2Q', 'Valley'] as const;
const WATERFALL = ['Paul Jarvis', 'NYDo21ssGao', 'Waterfall'] as const;
const BAY = ['Paul Jarvis', 'gkT4FfgHO5o', 'Bay'] as const;
const PEAKS = ['Go Wild', 'V0yAek6BgGk', 'Peaks'] as const;
const STREET = ['Nicholas Swanson', 'SyBYM8R6VU4', 'Street'] as const;
const GRAPES = ['Jassy Onyae', '1gBUXhf0PtA', 'Grapes'] as const;
const TRAIL = ['Dorothy Lin', 'TIr6EwYMRUM', 'Mountain trail'] as const;
const FORKS = ['Alejandro Escamilla', '8yqds_91OLw', 'Forks'] as const;

export const PRODUCTS = {
  heels: product(
    'heels',
    1200,
    800,
    'White leather heels on a red wooden floor',
    ...HEELS
  ),
  carry: product(
    'carry',
    1200,
    800,
    'A wallet, sunglasses, a watch and headphones laid out on grey',
    ...CARRY
  ),
  mug: product(
    'mug',
    1200,
    800,
    'A red and white mug printed with a postage stamp',
    ...MUG
  ),
  coffee: product(
    'coffee',
    1200,
    800,
    'A cup of coffee from above, on red',
    ...COFFEE
  )
};

export const THUMBS = {
  heels: photo('heels-thumb', 144, 96, '', ...HEELS),
  carry: photo('carry-thumb', 144, 96, '', ...CARRY),
  mug: photo('mug-thumb', 144, 96, '', ...MUG),
  coffee: photo('coffee-thumb', 144, 96, '', ...COFFEE)
};

export const SCENES = {
  forest: scene(
    'forest',
    1440,
    720,
    'Pine forest above a blue sound',
    ...FOREST
  ),
  peaks: scene('peaks', 1440, 720, 'Snow on a range of high peaks', ...PEAKS),
  bay: scene('bay', 1440, 720, 'Driftwood and rocks on a calm bay', ...BAY)
};

export const STORIES = {
  street: story(
    'street',
    720,
    1280,
    'A cobbled street between brick buildings',
    ...STREET
  ),
  grapes: story('grapes', 720, 1280, 'Dark grapes on the vine', ...GRAPES),
  trail: story(
    'trail',
    720,
    1280,
    'A trail winding up a mountainside',
    ...TRAIL
  ),
  forks: story('forks', 720, 1280, 'Three forks in soft light', ...FORKS)
};

// Their alt text is Arabic, as the deck they are in is.
export const PLACES = {
  valley: place('valley', 640, 800, 'وادٍ أخضر بين الجبال', ...VALLEY),
  waterfall: place('waterfall', 640, 800, 'شلال بين الصخور', ...WATERFALL),
  summit: place('summit', 640, 800, 'جبال مغطاة بالثلوج', ...PEAKS),
  shore: place('shore', 640, 800, 'صخور على شاطئ البحر', ...BAY),
  pines: place('pines', 640, 800, 'غابة قرب البحر', ...FOREST)
};

/** Every photo, once each by its page on Unsplash, for the credits. */
export const CREDITS: readonly Photo[] = [
  ...new Map(
    [
      ...Object.values(PRODUCTS),
      ...Object.values(SCENES),
      ...Object.values(STORIES),
      ...Object.values(PLACES)
    ].map((photo) => [photo.url, photo])
  ).values()
];
