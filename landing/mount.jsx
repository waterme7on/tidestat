import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import { animate, hover, press } from 'motion';
import { BorderBeam } from './border-beam.jsx';
import { Marquee } from './marquee.jsx';
import { SPRING_LAYOUT, SPRING_PRESS } from './ease.js';

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

function signalLabels() {
  return [...document.querySelectorAll('.signal-row li')].map((item) => item.textContent.trim()).filter(Boolean);
}

function SignalMarquee() {
  const [items, setItems] = useState(signalLabels);
  useEffect(() => {
    const update = () => setItems(signalLabels());
    window.addEventListener('tide:languagechange', update);
    return () => window.removeEventListener('tide:languagechange', update);
  }, []);
  return (
    <Marquee>
      {items.map((label) => <span className="signal-chip" key={label}>{label}</span>)}
    </Marquee>
  );
}

function mountMarquee() {
  const source = document.querySelector('.signal-row');
  if (!source || document.querySelector('.magic-marquee-host')) return;
  const host = document.createElement('div');
  host.className = 'magic-marquee-host';
  host.setAttribute('aria-hidden', 'true');
  source.after(host);
  source.classList.add('is-source');
  createRoot(host).render(<SignalMarquee />);
}

function mountBorderBeam() {
  const art = document.querySelector('.story-art');
  if (!art || art.querySelector('.border-beam')) return;
  const host = document.createElement('div');
  host.className = 'border-beam-host';
  art.append(host);
  createRoot(host).render(<BorderBeam />);
}

function mountPress() {
  document.querySelectorAll('.button, .nav-cta').forEach((element) => {
    press(element, () => {
      animate(element, { scale: 0.96 }, SPRING_PRESS);
      return () => animate(element, { scale: 1 }, SPRING_PRESS);
    });
  });
}

// Spectrum UI Animated Card lifts on hover. Scale stays small so the grid does not overflow.
function mountCards() {
  document.querySelectorAll('.audience-card, .workflow-card').forEach((card) => {
    hover(card, () => {
      const lift = animate(card, { y: -4 }, SPRING_LAYOUT);
      return () => { lift.stop(); return animate(card, { y: 0 }, SPRING_LAYOUT); };
    });
  });
}

if (!reduced) {
  document.body.classList.add('motion-ready');
  mountBorderBeam();
  mountMarquee();
  mountPress();
  mountCards();
}
