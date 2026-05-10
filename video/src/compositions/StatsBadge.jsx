import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';

const STATS = [
  { value: '7j', label: 'Essai gratuit', icon: '🎁' },
  { value: '9,99€', label: 'Par mois', icon: '💳' },
  { value: 'IA', label: 'Suggestions chaque soir', icon: '🤖' },
  { value: '∞', label: 'Bilans sanguins', icon: '🩸' },
];

export const StatsBadge = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const titleOp = interpolate(frame, [0, 25], [0, 1], { extrapolateRight: 'clamp' });
  const titleY = interpolate(frame, [0, 25], [20, 0], { extrapolateRight: 'clamp' });
  const fadeOut = interpolate(frame, [durationInFrames - 15, durationInFrames], [1, 0], { extrapolateLeft: 'clamp' });

  return (
    <div style={{
      width: '100%', height: '100%',
      background: '#0d0d0d',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '80px 64px',
      opacity: fadeOut,
    }}>
      {/* Logo */}
      <div style={{ opacity: titleOp, transform: `translateY(${titleY}px)`, textAlign: 'center', marginBottom: 20 }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 46, color: '#a89050', letterSpacing: 4, marginBottom: 8 }}>
          Nutrainer
        </div>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 58, color: '#f0e6c8', fontWeight: 700, lineHeight: 1.2 }}>
          Tout ce qu'il te faut.<br/>Rien de superflu.
        </div>
        <div style={{ width: 60, height: 2, background: '#a89050', margin: '20px auto 0' }} />
      </div>

      {/* Stats grid */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, justifyContent: 'center', marginTop: 56 }}>
        {STATS.map((s, i) => {
          const scale = spring({ frame: frame - (30 + i * 20), fps, config: { damping: 12, stiffness: 100 } });
          const op = interpolate(frame, [30 + i * 20, 50 + i * 20], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
          return (
            <div key={i} style={{
              opacity: op,
              transform: `scale(${Math.min(scale, 1)})`,
              background: '#1a1a14',
              border: '1px solid #a8905040',
              borderRadius: 24,
              padding: '36px 40px',
              width: 420,
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 52, marginBottom: 8 }}>{s.icon}</div>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: 56, color: '#a89050', fontWeight: 700, marginBottom: 8 }}>{s.value}</div>
              <div style={{ fontFamily: 'Helvetica Neue, Arial, sans-serif', fontSize: 24, color: '#888' }}>{s.label}</div>
            </div>
          );
        })}
      </div>

      {/* URL */}
      <div style={{
        marginTop: 60,
        opacity: interpolate(frame, [120, 140], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }),
        fontFamily: 'Helvetica Neue, Arial, sans-serif',
        fontSize: 30, color: '#a89050', letterSpacing: 4,
      }}>
        nutrainer.io
      </div>
    </div>
  );
};
