// Magic UI Marquee (MIT), adapted off Tailwind.
// https://github.com/magicuidesign/magicui
export function Marquee({ children, reverse = false, pauseOnHover = true, repeat = 2 }) {
  return (
    <div className={`magic-marquee${pauseOnHover ? ' is-pausable' : ''}`}>
      {Array.from({ length: repeat }, (_, index) => (
        <div key={index} className={`magic-marquee-track${reverse ? ' is-reverse' : ''}`}>
          {children}
        </div>
      ))}
    </div>
  );
}
