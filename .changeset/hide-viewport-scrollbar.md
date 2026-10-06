---
'@slidedeck/react': minor
---

A deck no longer shows a scrollbar. It still scrolls by touch, trackpad, mouse wheel, drag, keyboard and its controls, and it snaps as before. Where scrollbars take layout space, as on Windows and most Linux desktops, the viewport no longer loses that space to one, so a horizontal deck is that much shorter and a vertical deck's slides that much wider.

The default is a zero-specificity rule, so any rule of yours wins. To bring the scrollbar back:

```css
[data-slidedeck-viewport] {
  scrollbar-width: auto;
}
```

Safari before 18.2 does not support `scrollbar-width`. There, also add:

```css
[data-slidedeck-viewport]::-webkit-scrollbar {
  display: block;
}
```
