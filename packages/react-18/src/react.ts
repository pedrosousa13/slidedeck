// `react` for @slidedeck/react's source, built for React 18. The source is
// written for React 19; each export here is React 18's own, or stands in for
// the React 19 API the source uses. A name the source imports and this
// module does not export fails the build.
import {
  createContext as createReactContext,
  useContext,
  useEffect,
  useLayoutEffect as useReactLayoutEffect,
  version,
  type Context,
  type Provider
} from 'react';

export {
  Children,
  Fragment,
  isValidElement,
  useEffect,
  useImperativeHandle,
  useRef,
  useState
} from 'react';

// Left in the build for the consumer's bundler to replace, as in the source.
declare const process: { env: { NODE_ENV?: string } };

if (process.env.NODE_ENV !== 'production' && !version.startsWith('18.')) {
  console.error(
    `@slidedeck/react-18 is for React 18, and this is React ${version}. ` +
      'Use @slidedeck/react with React 19.'
  );
}

/** A context the source renders as its own provider, as React 19 does:
 * here, React 18's provider, which `use` reads the context through. */
export const createContext = <T>(value: T) =>
  createReactContext(value).Provider as unknown as Context<T>;

/** React 18 has no `use`; the source reads contexts with it, and nothing
 * else. */
export const use = <T>(context: Context<T>): T =>
  useContext(
    (context as unknown as Provider<T> & { _context: Context<T> })._context
  );

/** React 18 warns about a layout effect on the server; React 19 does not. */
export const useLayoutEffect =
  typeof window === 'undefined' ? useEffect : useReactLayoutEffect;
