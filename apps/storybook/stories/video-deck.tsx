import { useEffect, useEffectEvent, useRef } from 'react';
import * as Deck from '@slidedeck/react';
import * as Player from '@playdeck/react';

/** A deck of videos: the one in the focal slide plays, muted; the rest pause. */
export function VideoDeck({ sources }: { sources: readonly string[] }) {
  const players = useRef<(Player.PlayerHandle | null)[]>([]);
  const focal = useRef(0);

  const playFocal = (slide: number) => {
    focal.current = slide;
    players.current.forEach((player, i) => {
      if (i !== slide) void player?.pause();
    });
    // A player loads as its slide comes into view: wait until it can play,
    // and play only if its slide is still the focal one.
    const player = players.current[slide];
    void player?.whenReady().then((ready) => {
      if (ready && focal.current === slide) void player.play();
    });
  };

  // onFocalChange does not fire for where the deck starts: play it on mount.
  const playOnMount = useEffectEvent(() => playFocal(focal.current));
  useEffect(() => playOnMount(), []);

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
