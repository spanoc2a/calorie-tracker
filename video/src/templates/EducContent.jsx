import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { COLORS } from '../data/videos';

export const EducContent = ({ title, hook, points, cta }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoOp = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

  const hookScale = spring({ frame: frame - 10, fps, config: { damping: 12, stiffness: 100 } });
  const hookOp = interpolate(frame, [10, 30], [0, 1], { extrapolateRight: 'clamp' });

  const titleOp = interpolate(frame, [40, 60], [0, 1], { extrapolateRight: 'clamp' });
  const titleY = interpolate(frame, [40, 60], [20, 0], { extrapolateRight: 'clamp' });

  const ctaOp = interpolate(frame, [points.length * 25 + 80, points.length * 25 + 100], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <div style={{
      width: '100%', height: '100%',
      background: COLORS.bg,
      display: 'flex', flexDirection: 'column',
      padding: '72px 64px',
    }}>
      {/* Logo */}
      <div style={{ opacity: logoOp, marginBottom: 48 }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 34, color: COLORS.gold, letterSpacing: 3 }}>Nutrainer</div>
      </div>

      {/* Hook accrocheur */}
      <div style={{
        opacity: hookOp,
        transform: `scale(${Math.min(hookScale, 1)})`,
        background: '#1a1a14',
        border: `1px solid ${COLORS.gold}44`,
        borderLeft: `4px solid ${COLORS.gold}`,
        borderRadius: 16, padding: '28px 32px',
        fontFamily: 'Helvetica Neue, Arial, sans-serif',
        fontSize: 30, color: COLORS.cream, lineHeight: 1.45,
        marginBottom: 40,
      }}>
        {hook}
      </div>

      {/* Titre */}
      <div style={{ opacity: titleOp, transform: `translateY(${titleY}px)`, marginBottom: 48 }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 54, color: COLORS.cream, fontWeight: 700, lineHeight: 1.2 }}>
          {title}
        </div>
        <div style={{ width: 60, height: 3, background: COLORS.gold, marginTop: 16 }} />
      </div>

      {/* Points */}
      <div style={{ flex: 1 }}>
        {points.map((point, i) => {
          const op = interpolate(frame, [70 + i * 25, 90 + i * 25], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
          const x = interpolate(frame, [70 + i * 25, 90 + i * 25], [-20, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
          return (
            <div key={i} style={{ opacity: op, transform: `translateX(${x}px)`, display: 'flex', gap: 20, marginBottom: 32, alignItems: 'flex-start' }}>
              <div style={{ color: COLORS.gold, fontSize: 30, flexShrink: 0, lineHeight: 1.4 }}>▸</div>
              <div style={{ fontFamily: 'Helvetica Neue, Arial, sans-serif', fontSize: 30, color: '#bbb', lineHeight: 1.5 }}>{point}</div>
            </div>
          );
        })}
      </div>

      {/* CTA */}
      <div style={{ opacity: ctaOp }}>
        <div style={{
          background: COLORS.gold, borderRadius: 20, padding: '28px 0', textAlign: 'center',
          fontFamily: 'Helvetica Neue, Arial, sans-serif', fontSize: 30, color: '#0d0d0d', fontWeight: 700,
          marginBottom: 16,
        }}>
          {cta} →
        </div>
        <div style={{ textAlign: 'center', fontFamily: 'Georgia, serif', fontSize: 26, color: COLORS.gold, letterSpacing: 2 }}>
          nutrainer.io
        </div>
      </div>
    </div>
  );
};
