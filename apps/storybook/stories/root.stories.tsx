import * as Deck from '@slidedeck/react';
import type { Meta, StoryObj } from '@storybook/react-vite';

// Placeholder: proves the story -> Playwright -> axe pipe. The tracer-bullet
// issue (#6) replaces it with real stories.
const meta = {
  title: 'Placeholder/Root',
  component: Deck.Root
} satisfies Meta<typeof Deck.Root>;

export default meta;

export const Default: StoryObj<typeof meta> = {
  args: { children: 'First slide' }
};
