import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { COLORS } from '../data/videos';

const Stars = ({ count }) => (
  <div style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
    {Array.from({ length: count }).map((_, i) => (
      <span key={i} style={{ fontSize: 36, color: COLORS.gold }}>★</span>
    ))}
  </div>
);

export const Testimonial = ({ name, age, job, quote, result, stars, feature }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoOp = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const featureOp = interpolate(frame, [10, 30], [0, 1], { extrapolateRight: 'clamp' });
  const featureY = interpolate(frame, [10, 30], [10, 0], { extrapolateRight: 'clamp' });

  const quoteScale = spring({ frame: frame - 25, fps, config: { damping: 14 } });
  const quoteOp = interpolate(frame, [25, 45], [0, 1], { extrapolateRight: 'clamp' });

  const nameOp = interpolate(frame, [60, 80], [0, 1], { extrapolateRight: 'clamp' });
  const nameY = interpolate(frame, [60, 80], [15, 0], { extrapolateRight: 'clamp' });

  const resultOp = interpolate(frame, [90, 110], [0, 1], { extrapolateRight: 'clamp' });
  const resultScale = spring({ frame: frame - 90, fps, config: { damping: 12, stiffness: 120 } });

  const ctaOp = interpolate(frame, [130, 150], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <div style={{
      width: '100%', height: '100%',
      background: COLORS.bg,
      display: 'flex', flexDirection: 'column',
      padding: '80px 64px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 60, opacity: logoOp }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 38, color: COLORS.gold, letterSpacing: 3 }}>Nutrainer</div>
        <div style={{
          opacity: featureOp, transform: `translateY(${featureY}px)`,
          background: '#1a1a14', borderRadius: 20, padding: '10px 22px',
          fontFamily: 'Helvetica Neue, Arial, sans-serif', fontSize: 20, color: COLORS.gold,
          border: `1px solid ${COLORS.gold}44`,
        }}>
          {feature}
        </div>
      </div>

      {/* Stars */}
      <Stars count={stars} />

      {/* Quote */}
      <div style={{
        opacity: quoteOp,
        transform: `scale(${Math.min(quoteScale, 1)})`,
        fontFamily: 'Georgia, serif',
        fontSize: 52,
        color: COLORS.cream,
        lineHeight: 1.35,
        fontWeight: 700,
        marginBottom: 48,
        flex: 1,
      }}>
        « {quote} »
      </div>

      {/* Person */}
      <div style={{ opacity: nameOp, transform: `translateY(${nameY}px)`, marginBottom: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: `linear-gradient(135deg, ${COLORS.gold}, #c8a050)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Georgia, serif', fontSize: 26, color: '#0d0d0d', fontWeight: 700,
          }}>
            {name[0]}
          </div>
          <div>
            <div style={{ fontFamily: 'Helvetica Neue, Arial, sans-serif', fontSize: 28, color: COLORS.cream, fontWeight: 600 }}>{name}</div>
            <div style={{ fontFamily: 'Helvetica Neue, Arial, sans-serif', fontSize: 22, color: COLORS.muted }}>{age} ans · {job}</div>
          </div>
        </div>
      </div>

      {/* Result badge */}
      <div style={{
        opacity: resultOp,
        transform: `scale(${Math.min(resultScale, 1)})`,
        background: `linear-gradient(135deg, ${COLORS.gold}22, ${COLORS.gold}11)`,
        border: `2px solid ${COLORS.gold}`,
        borderRadius: 20, padding: '24px 36px', marginBottom: 48,
        fontFamily: 'Georgia, serif', fontSize: 36, color: COLORS.gold, fontWeight: 700,
        textAlign: 'center',
      }}>
        ✓ {result}
      </div>

      {/* CTA */}
      <div style={{ opacity: ctaOp, textAlign: 'center' }}>
        <div style={{ fontFamily: 'Helvetica Neue, Arial, sans-serif', fontSize: 24, color: COLORS.muted, marginBottom: 12 }}>
          Essai gratuit 7 jours · Sans engagement
        </div>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 32, color: COLORS.gold, letterSpacing: 2 }}>
          nutrainer.io
        </div>
      </div>
    </div>
  );
};
