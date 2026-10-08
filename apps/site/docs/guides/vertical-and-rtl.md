---
components: [example-vertical, example-right-to-left]
---

# Vertical and right-to-left

`orientation="vertical"` scrolls along the block axis. A vertical deck needs a
height, set on `Deck.Viewport` in CSS; each slide fills it by default.

Writing direction is read from the document's computed `direction`, so `dir`
on any ancestor applies. In a right-to-left document the deck starts at the
right, Next moves toward the inline end on the left, and a mouse drag and the
arrow keys follow.

A deck follows a change of `dir` after it mounts, as a locale switch makes:
it stays on its slide, and from there goes the new way. A change of
`direction` in CSS alone is not watched, and a deck inside a shadow root does
not see a change of `dir` on its ancestors outside it.
