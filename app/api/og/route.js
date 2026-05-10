import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          background: '#0d0d0d',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Top bar */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '4px', background: '#c8b890', display: 'flex' }} />

        {/* Logo */}
        <div style={{ fontSize: '88px', color: '#f0e6c8', fontWeight: 700, letterSpacing: '2px', display: 'flex', marginBottom: '12px' }}>
          Nutrainer
        </div>

        {/* Separator */}
        <div style={{ width: '60px', height: '2px', background: '#c8b890', marginBottom: '24px', display: 'flex' }} />

        {/* Tagline */}
        <div style={{ fontSize: '22px', color: '#c8b890', letterSpacing: '5px', display: 'flex', marginBottom: '56px' }}>
          NUTRITION · SPORT · SANTE
        </div>

        {/* Pills */}
        <div style={{ display: 'flex', gap: '16px' }}>
          {['Bilan sanguin IA', 'Nutrition personnalisee', 'Rapports', 'Sync Strava'].map(f => (
            <div key={f} style={{
              background: '#1a1a1a',
              border: '1px solid #2a2a2a',
              borderRadius: '8px',
              padding: '10px 20px',
              fontSize: '18px',
              color: '#7a7060',
              display: 'flex',
            }}>
              {f}
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '4px', background: '#c8b890', display: 'flex' }} />
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
