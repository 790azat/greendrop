export function LogoMark({ size = 36, animated = false }: { size?: number; animated?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" className={animated ? 'logo-anim' : undefined}>
      <defs>
        <linearGradient id="gdg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#34d399" />
          <stop offset="0.5" stopColor="#16a34a" />
          <stop offset="1" stopColor="#166534" />
        </linearGradient>
      </defs>
      <rect className="l-bg" width="100" height="100" rx="24" fill="url(#gdg)" />
      <path className="l-drop" d="M50 14C50 14 23 45 23 63a27 27 0 0 0 54 0C77 45 50 14 50 14Z" fill="#fff" />
      <path className="l-leaf" d="M37 72C36 56 47 47 63 46c1 15-9 26-26 26Z" fill="#16a34a" />
      <path className="l-vein" d="M38 71C45 62 52 56 60 50" stroke="#fff" strokeWidth="3" strokeLinecap="round" fill="none" pathLength={1} />
    </svg>
  );
}

export function Brand({ size = 34 }: { size?: number }) {
  return (
    <span className="brand">
      <LogoMark size={size} />
      <span>
        Green<b>Drop</b>
      </span>
    </span>
  );
}

/** Animated logo shown while the app starts (once per launch) */
export function Splash() {
  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `try{if(sessionStorage.getItem('gd_splash')){document.documentElement.classList.add('nosplash')}else{sessionStorage.setItem('gd_splash','1')}}catch(e){}`,
        }}
      />
      <div id="splash" aria-hidden="true">
        <div className="sp-glow" />
        <div className="sp-ring" />
        <div className="sp-logo">
          <LogoMark size={112} animated />
        </div>
        <div className="sp-name">
          Green<b>Drop</b>
        </div>
        <div className="sp-dots"><i /><i /><i /></div>
      </div>
    </>
  );
}
