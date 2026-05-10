import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';

export const LogoIntro = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const lineWidth = interpolate(frame, [0, 40], [0, 100], { extrapolateRight: 'clamp' });
  const logoOp = interpolate(frame, [20, 45], [0, 1], { extrapolateRight: 'clamp' });
  const logoY = interpolate(frame, [20, 45], [30, 0], { extrapolateRight: 'clamp' });

  const tagOp = interpolate(frame, [50, 70], [0, 1], { extrapolateRight: 'clamp' });
  const tagY = interpolate(frame, [50, 70], [15, 0], { extrapolateRight: 'clamp' });

  const dotScale = spring({ frame: frame - 75, fps, config: { damping: 8, stiffness: 120 } });

  const fadeOut = interpolate(frame, [durationInFrames - 15, durationInFrames], [1, 0], { extrapolateLeft: 'clamp' });

  return (
    <div style={{
      width: '100%', height: '100%',
      background: '#0d0d0d',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      opacity: fadeOut,
    }}>
      {/* Ligne dorée qui s'étend */}
      <div style={{
        width: `${lineWidth}%`, height: 1,
        background: 'linear-gradient(90deg, transparent, #a89050, transparent)',
        marginBottom: 40,
      }} />

      {/* Logo */}
      <div style={{ opacity: logoOp, transform: `translateY(${logoY}px)`, textAlign: 'center', marginBottom: 20 }}>
        <div style={{
          fontFamily: 'Georgia, serif', fontSize: 100,
          color: '#f0e6c8', letterSpacing: 10, fontWeight: 700,
        }}>
          Nutrainer
        </div>
      </div>

      {/* Tagline */}
      <div style={{ opacity: tagOp, transform: `translateY(${tagY}px)`, textAlign: 'center', marginBottom: 40 }}>
        <div style={{
          fontFamily: 'Helvetica Neue, Arial, sans-serif',
          fontSize: 26, color: '#a89050',
          letterSpacing: 6, textTransform: 'uppercase',
        }}>
          Nutrition · Sport · Santé
        </div>
      </div>

      {/* Point doré pulsant */}
      <div style={{
        width: 10, height: 10, borderRadius: '50%',
        background: '#a89050',
        transform: `scale(${Math.min(dotScale, 1)})`,
        opacity: dotScale > 0 ? 1 : 0,
      }} />

      {/* Ligne dorée bas */}
      <div style={{
        position: 'absolute', bottom: 80,
        width: `${lineWidth}%`, height: 1,
        background: 'linear-gradient(90deg, transparent, #a89050, transparent)',
      }} />
    </div>
  );
};
