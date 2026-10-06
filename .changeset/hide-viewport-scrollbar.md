---
'@slidedeck/react': minor
---

A deck no longer shows a scrollbar. It still scrolls by touch, trackpad, mouse wheel, drag, keyboard and its controls, and it snaps as before. Where scrollbars take layout space, as on Windows and most Linux desktops, the viewport no longer loses that space to one, so a horizontal deck is that much shorter and a vertical deck's slides that much wider.

The default `scrollbar-width: none` is a zero-specificity rule, so any rule of yours wins. To bring the scrollbar back:

```css
[data-slidedeck-viewport] {
  scrollbar-width: auto;
}
```

Safari before 18.2 does not support `scrollbar-width`. There the deck hides the scrollbar with `::-webkit-scrollbar { display: none }` instead, at the specificity of one element, so your `[data-slidedeck-viewport]::-webkit-scrollbar` rule wins. The native scrollbar cannot come back there: any `::-webkit-scrollbar` rule replaces it with one drawn from your CSS. To show a styled one there, and leave other browsers theirs (untested in Safari before 18.2):

```css
@supports not (scrollbar-width: auto) {
  [data-slidedeck-viewport]::-webkit-scrollbar {
    display: block;
    width: 8px;
    height: 8px;
  }
  [data-slidedeck-viewport]::-webkit-scrollbar-thumb {
    background: rgb(0 0 0 / 0.4);
    border-radius: 4px;
  }
}
```
