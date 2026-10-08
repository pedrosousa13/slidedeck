---
components: [example-drag]
---

# Drag

A mouse can drag the deck by default. Snapping is off while it drags; on
release the deck projects the flick's velocity to a snap point and settles
there. A drag never clicks what it started on; a plain click still does.
Touch, pen and trackpad always scroll natively. Set `drag={false}` for decks
whose content is itself draggable.
