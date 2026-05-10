import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';
import { COLORS } from '../data/videos';

const Step = ({ text, index, frame, startAt }) => {
  const op = interpolate(frame, [startAt, startAt + 18], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const x = interpolate(frame, [startAt, startAt + 18], [-30, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <div style={{
      opacity: op, transform: `translateX(${x}px)`,
      display: 'flex', alignItems: 'flex-start', gap: 24, marginBottom: 32,
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
        background: COLORS.gold,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Georgia, serif', fontSize: 22, color: '#0d0d0d', fontWeight: 700,
      }}>
        {index + 1}
      </div>
      <div style={{
        fontFamily: 'Helvetica Neue, Arial, sans-serif', fontSize: 32,
        color: COLORS.cream, lineHeight: 1.4, paddingTop: 8,
      }}>
        {text}
      </div>
    </div>
  );
};

export const FeatureDemo = ({ title, emoji, steps, hook, cta }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headerOp = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  const emojiScale = spring({ frame, fps, config: { damping: 10, stiffness: 80 } });

  const hookOp = interpolate(frame, [20, 40], [0, 1], { extrapolateRight: 'clamp' });
  const hookY = interpolate(frame, [20, 40], [20, 0], { extrapolateRight: 'clamp' });

  const ctaOp = interpolate(frame, [steps.length * 22 + 50, steps.length * 22 + 70], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <div style={{
      width: '100%', height: '100%',
      background: COLORS.bg,
      display: 'flex', flexDirection: 'column',
      padding: '72px 64px',
    }}>
      {/* Logo */}
      <div style={{ opacity: headerOp, marginBottom: 48, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 34, color: COLORS.gold, letterSpacing: 3 }}>Nutrainer</div>
        <div style={{ fontFamily: 'Helvetica Neue, Arial, sans-serif', fontSize: 20, color: COLORS.muted }}>nutrainer.io</div>
      </div>

      {/* Emoji + titre */}
      <div style={{ opacity: headerOp, marginBottom: 40 }}>
        <div style={{ fontSize: 80, transform: `scale(${Math.min(emojiScale, 1)})`, display: 'inline-block', marginBottom: 16 }}>{emoji}</div>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 60, color: COLORS.cream, fontWeight: 700, lineHeight: 1.15 }}>{title}</div>
        <div style={{ width: 60, height: 3, background: COLORS.gold, marginTop: 16 }} />
      </div>

      {/* Hook */}
      <div style={{
        opacity: hookOp, transform: `translateY(${hookY}px)`,
        fontFamily: 'Helvetica Neue, Arial, sans-serif', fontSize: 28,
        color: COLORS.gold, lineHeight: 1.4, marginBottom: 48, fontStyle: 'italic',
      }}>
        {hook}
      </div>

      {/* Steps */}
      <div style={{ flex: 1 }}>
        {steps.map((s, i) => (
          <Step key={i} text={s} index={i} frame={frame} startAt={50 + i * 22} />
        ))}
      </div>

      {/* CTA */}
      <div style={{ opacity: ctaOp }}>
        <div style={{
          background: COLORS.gold, borderRadius: 20, padding: '28px 0', textAlign: 'center',
          fontFamily: 'Helvetica Neue, Arial, sans-serif', fontSize: 30, color: '#0d0d0d', fontWeight: 700,
        }}>
          {cta} →
        </div>
        <div style={{ textAlign: 'center', marginTop: 16, fontFamily: 'Helvetica Neue, Arial, sans-serif', fontSize: 22, color: COLORS.muted }}>
          7 jours gratuits · Sans engagement
        </div>
      </div>
    </div>
  );
};
