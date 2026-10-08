---
components: [example-drag]
description: 'A mouse can drag a slidedeck deck; on release it projects the flick to a snap point. Touch, pen and trackpad scroll natively. Turn it off with drag={false}.'
---

# Drag

A mouse can drag the deck by default. Snapping is off while it drags; on
release the deck projects the flick's velocity to a snap point and settles
there. A drag never clicks what it started on; a plain click still does.
Touch, pen and trackpad always scroll natively. Set `drag={false}` for decks
whose content is itself draggable.
