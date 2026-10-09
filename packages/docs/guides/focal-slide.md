---
components: [example-focal-slide]
description: 'The focal slide is the one at the snap alignment point. How slidedeck marks it with data-focal, reports it with onFocalChange, and moves it on click.'
---

# Focal slide

The focal slide is the slide at the snap alignment point, the one the deck is
about. With one slide in view it is the current slide; with several in view,
centred, it is the middle one. It carries `data-focal`, and `onFocalChange`
reports it. The current slide, the first slide resting at the current snap
point, carries `data-current`.

The focal slide is defined by the alignment point, not by which slides are in
view: with several in view at the start, it is the first of them. To highlight
the middle one, see
[highlight the middle slide in view](/docs/recipes/middle-slide/).

With `clickToFocus`, clicking a slide brings it to the focal position, as near
as the scroll range allows. A click that ends a mouse drag does not, nor does
a keyboard click on a control in a slide.
