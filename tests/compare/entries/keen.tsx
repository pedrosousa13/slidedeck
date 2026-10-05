// The same carousel with Keen's React hook, as its docs write it, with the
// stylesheet its docs import: the slider does not lay out without it.
import { createRoot } from 'react-dom/client';
import 'keen-slider/keen-slider.min.css';
import { useKeenSlider } from 'keen-slider/react';

const Fixture = () => {
  const [sliderRef, slider] = useKeenSlider<HTMLDivElement>();
  return (
    <section>
      <div ref={sliderRef} className="keen-slider">
        <div className="keen-slider__slide">One</div>
        <div className="keen-slider__slide">Two</div>
        <div className="keen-slider__slide">Three</div>
      </div>
      <button type="button" onClick={() => slider.current?.prev()}>
        Previous
      </button>
      <button type="button" onClick={() => slider.current?.next()}>
        Next
      </button>
    </section>
  );
};

createRoot(document.getElementById('root')!).render(<Fixture />);
