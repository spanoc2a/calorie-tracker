import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';

export const Outro = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const bgScale = interpolate(frame, [0, 30], [1.05, 1], { extrapolateRight: 'clamp' });
  const logoOp = interpolate(frame, [10, 35], [0, 1], { extrapolateRight: 'clamp' });
  const logoY = interpolate(frame, [10, 35], [20, 0], { extrapolateRight: 'clamp' });

  const urlScale = spring({ frame: frame - 40, fps, config: { damping: 12, stiffness: 100 } });
  const urlOp = interpolate(frame, [40, 60], [0, 1], { extrapolateRight: 'clamp' });

  const trialOp = interpolate(frame, [65, 80], [0, 1], { extrapolateRight: 'clamp' });

  const btnScale = spring({ frame: frame - 85, fps, config: { damping: 10, stiffness: 90 } });
  const btnOp = interpolate(frame, [85, 100], [0, 1], { extrapolateRight: 'clamp' });

  const fadeOut = interpolate(frame, [durationInFrames - 10, durationInFrames], [1, 0], { extrapolateLeft: 'clamp' });

  return (
    <div style={{
      width: '100%', height: '100%',
      background: '#0d0d0d',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      transform: `scale(${bgScale})`,
      opacity: fadeOut,
      padding: '0 80px',
    }}>
      {/* Cercle décoratif */}
      <div style={{
        position: 'absolute',
        width: 600, height: 600,
        borderRadius: '50%',
        border: '1px solid #a8905020',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
      }} />
      <div style={{
        position: 'absolute',
        width: 800, height: 800,
        borderRadius: '50%',
        border: '1px solid #a8905010',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
      }} />

      {/* Logo */}
      <div style={{ opacity: logoOp, transform: `translateY(${logoY}px)`, textAlign: 'center', marginBottom: 16, zIndex: 1 }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 84, color: '#f0e6c8', letterSpacing: 8, fontWeight: 700 }}>
          Nutrainer
        </div>
        <div style={{ width: 60, height: 2, background: '#a89050', margin: '12px auto 0' }} />
      </div>

      {/* URL */}
      <div style={{
        opacity: urlOp,
        transform: `scale(${Math.min(urlScale, 1)})`,
        zIndex: 1, marginBottom: 60,
      }}>
        <div style={{
          fontFamily: 'Helvetica Neue, Arial, sans-serif',
          fontSize: 36, color: '#a89050', letterSpacing: 4,
        }}>
          nutrainer.io
        </div>
      </div>

      {/* Trial info */}
      <div style={{ opacity: trialOp, zIndex: 1, marginBottom: 48, textAlign: 'center' }}>
        <div style={{
          fontFamily: 'Helvetica Neue, Arial, sans-serif',
          fontSize: 28, color: '#666', lineHeight: 1.6,
        }}>
          Essai gratuit 7 jours · Sans engagement<br/>
          Annulable à tout moment
        </div>
      </div>

      {/* Bouton CTA */}
      <div style={{
        opacity: btnOp,
        transform: `scale(${Math.min(btnScale, 1)})`,
        zIndex: 1,
        background: '#a89050', borderRadius: 24,
        padding: '28px 80px',
        fontFamily: 'Helvetica Neue, Arial, sans-serif',
        fontSize: 32, color: '#0d0d0d', fontWeight: 700,
        letterSpacing: 1,
      }}>
        Commencer gratuitement →
      </div>
    </div>
  );
};
