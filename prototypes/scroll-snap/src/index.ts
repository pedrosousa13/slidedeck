// THROWAWAY (#3). Index of technique pages, plus what this browser supports.

import './style.css';

const yes = (ok: boolean) => (ok ? 'yes' : 'no');

document.body.innerHTML = `
  <div class="banner">THROWAWAY prototype for issue #3 (ADR-0001 engine gate). Not package code; deleted after the go/no-go.</div>
  <h1>Native scroll snap: loop, drag and fade</h1>
  <p>Each page is one technique on a real scroll-snap viewport. Toggles are URL parameters, so a configuration is a shareable link. The box under each deck is a live jump detector: it turns red when a frame moves the content discontinuously or the scroller hits its physical edge while looping.</p>
  <ul>
    <li><a href="./loop-clone-jump.html">Loop: clone and jump</a> (copies at both ends, jump back at <code>scrollend</code>)</li>
    <li><a href="./loop-reposition.html">Loop: reposition</a> (no copies; move slides from one end to the other at rest)</li>
    <li><a href="./drag.html">Mouse drag</a> (plain deck; the loop pages have the same drag)</li>
    <li><a href="./fade.html">Fade</a> (slides stacked with <code>position: sticky</code>, opacity from scroll progress)</li>
  </ul>
  <h2>This browser</h2>
  <ul>
    <li><code>scrollend</code>: ${yes('onscrollend' in window)}</li>
    <li><code>scrollsnapchange</code>: ${yes('onscrollsnapchange' in window)}</li>
    <li><code>Element.moveBefore</code>: ${yes('moveBefore' in Element.prototype)}</li>
    <li>Scroll-driven animations: ${yes(CSS.supports('animation-timeline: scroll()'))}</li>
    <li>User agent: <code></code></li>
  </ul>`;
document.querySelector('li:last-child code')!.textContent = navigator.userAgent;
