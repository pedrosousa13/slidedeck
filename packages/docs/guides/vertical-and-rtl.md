---
title: Vertical and right-to-left
description: 'Scroll a slidedeck deck along the block axis with orientation="vertical", and how a deck follows a right-to-left writing direction, a change of dir included.'
---

`orientation="vertical"` scrolls along the block axis. A vertical deck needs a
height, set on `Deck.Viewport` in CSS. Each slide fills it by default.

The deck reads the writing direction from the document's computed
`direction`, so `dir` on any ancestor applies. In a right-to-left document the deck starts at the
right, Next moves toward the inline end on the left, and a mouse drag and the
arrow keys follow.

A deck follows a change of `dir` after it mounts, as after a locale switch.
It stays on its slide and goes the new way from there. The deck does
not watch a change of `direction` in CSS alone, and a deck inside a shadow
root does not see a change of `dir` on its ancestors outside it.

<!-- demo:example-vertical -->

<!-- demo:example-right-to-left -->
