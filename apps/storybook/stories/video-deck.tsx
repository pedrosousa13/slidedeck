import { useEffect, useEffectEvent, useRef } from 'react';
import * as Deck from '@slidedeck/react';
import * as Player from '@playdeck/react';

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/** A deck of videos: the one in the focal slide plays, muted; the rest pause.
 * Under reduced motion none plays by itself; a viewer can still press play. */
export function VideoDeck({ sources }: { sources: readonly string[] }) {
  const players = useRef<(Player.PlayerHandle | null)[]>([]);
  const focal = useRef(0);

  const playFocal = (slide: number) => {
    focal.current = slide;
    const still = () => matchMedia(REDUCED_MOTION).matches;
    players.current.forEach((player, i) => {
      if (i !== slide || still()) void player?.pause();
    });
    if (still()) return;
    // A player loads as its slide comes into view: wait until it can play,
    // and play only if its slide is still the focal one.
    const player = players.current[slide];
    void player?.whenReady().then((ready) => {
      if (ready && focal.current === slide && !still()) void player.play();
    });
  };

  // onFocalChange does not fire for where the deck starts, nor when the
  // viewer's motion preference changes: play or pause for both.
  const replay = useEffectEvent(() => playFocal(focal.current));
  useEffect(() => {
    const query = matchMedia(REDUCED_MOTION);
    const onChange = () => replay();
    onChange();
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return (
    <Deck.Root aria-label="Featured slides" onFocalChange={playFocal}>
      <Deck.Viewport>
        {sources.map((source, i) => (
          <Deck.Slide key={i}>
            <Player.Root
              ref={(player) => {
                players.current[i] = player;
              }}
              source={source}
              defaultMuted
              loop
            >
              <Player.Viewport style={{ aspectRatio: '16 / 9' }}>
                <Player.Media />
                <Player.Controls>
                  <Player.PlayButton />
                </Player.Controls>
              </Player.Viewport>
            </Player.Root>
          </Deck.Slide>
        ))}
      </Deck.Viewport>
      <Deck.Prev />
      <Deck.Next />
    </Deck.Root>
  );
}
