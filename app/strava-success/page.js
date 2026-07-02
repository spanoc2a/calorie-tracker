"use client";
import { useEffect } from 'react';

const STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Mono:wght@400&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0d0d0d; font-family: 'DM Mono', monospace; color: #e8e0d0; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
  .wrap { max-width: 360px; width: 100%; padding: 40px 24px; text-align: center; }
  .icon { font-size: 3rem; margin-bottom: 24px; }
  .title { font-family: 'Playfair Display', serif; font-size: 1.8rem; color: #f0e6c8; margin-bottom: 12px; }
  .desc { font-size: 0.8rem; color: #8a8a7a; line-height: 1.7; margin-bottom: 32px; }
  .badge { display: inline-block; background: #fc4c02; color: #fff; font-size: 0.7rem; letter-spacing: 1px; padding: 6px 16px; border-radius: 20px; margin-bottom: 24px; }
`;

export default function StravaSuccessPage() {
  useEffect(() => {
    if (window.opener) {
      window.opener.postMessage({ stravaConnected: true }, window.location.origin);
      window.close();
    } else {
      window.location.href = '/';
    }
  }, []);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: STYLE }} />
      <div className="wrap">
        <div className="icon">🎉</div>
        <div className="badge">STRAVA CONNECTÉ</div>
        <h1 className="title">C&apos;est bon !</h1>
        <p className="desc">
          Ton compte Strava est maintenant lié à Nutrainer.<br />
          Retourne sur l&apos;app pour voir tes activités synchronisées.
        </p>
      </div>
    </>
  );
}
