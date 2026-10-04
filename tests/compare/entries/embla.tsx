// The same carousel with Embla's React hook, as its docs write it: the
// viewport and container styles are the consumer's, and Embla ships none.
import { createRoot } from 'react-dom/client';
import useEmblaCarousel from 'embla-carousel-react';

const Fixture = () => {
  const [viewportRef, api] = useEmblaCarousel();
  return (
    <section>
      <div ref={viewportRef} style={{ overflow: 'hidden' }}>
        <div style={{ display: 'flex' }}>
          <div style={{ flex: '0 0 100%' }}>One</div>
          <div style={{ flex: '0 0 100%' }}>Two</div>
          <div style={{ flex: '0 0 100%' }}>Three</div>
        </div>
      </div>
      <button type="button" onClick={() => api?.scrollPrev()}>
        Previous
      </button>
      <button type="button" onClick={() => api?.scrollNext()}>
        Next
      </button>
    </section>
  );
};

createRoot(document.getElementById('root')!).render(<Fixture />);
