import { useCurrentFrame, useVideoConfig, spring, interpolate } from 'remotion';

const COLORS = { bg: '#0d0d0d', gold: '#a89050', cream: '#f0e6c8', dark: '#1a1a14', muted: '#666' };

const Bar = ({ label, value, goal, color, frame, delay }) => {
  const pct = goal > 0 ? Math.min(value / goal, 1) : 0;
  const width = interpolate(frame, [delay, delay + 35], [0, pct * 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const isLow = pct < 0.7;
  const isGood = pct >= 0.9 && pct <= 1.1;

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontFamily: 'Helvetica Neue, Arial, sans-serif', fontSize: 26, color: COLORS.muted }}>{label}</span>
        <span style={{ fontFamily: 'Helvetica Neue, Arial, sans-serif', fontSize: 26, color: isGood ? '#6b9e78' : isLow ? '#c87070' : COLORS.cream, fontWeight: 600 }}>
          {Math.round(value)} / {goal}
        </span>
      </div>
      <div style={{ height: 12, background: '#2a2a20', borderRadius: 6, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${width}%`, background: color, borderRadius: 6 }} />
      </div>
    </div>
  );
};

export const AthleteReport = ({
  name = 'Athlète',
  coachName = 'Coach',
  avgKcal7j = 0,
  goalKcal = 2000,
  avgProtein7j = 0,
  goalProtein = 150,
  activeDays7j = 0,
  lastWeight = null,
  weightTrend = null,
  alert = null,
  stravaCount7j = 0,
  weekLabel = '',
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const fadeOut = interpolate(frame, [durationInFrames - 20, durationInFrames], [1, 0], { extrapolateLeft: 'clamp' });
  const headerOp = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  const nameScale = spring({ frame: frame - 15, fps, config: { damping: 12 } });
  const nameOp = interpolate(frame, [15, 35], [0, 1], { extrapolateRight: 'clamp' });

  const alertOp = interpolate(frame, [45, 60], [0, 1], { extrapolateRight: 'clamp' });
  const alertX = interpolate(frame, [45, 60], [-20, 0], { extrapolateRight: 'clamp' });

  const statsOp = interpolate(frame, [65, 80], [0, 1], { extrapolateRight: 'clamp' });

  const bottomOp = interpolate(frame, [160, 175], [0, 1], { extrapolateRight: 'clamp' });

  const kcalPct = goalKcal > 0 ? Math.round((avgKcal7j / goalKcal) * 100) : 0;
  const protPct = goalProtein > 0 ? Math.round((avgProtein7j / goalProtein) * 100) : 0;

  return (
    <div style={{ width: '100%', height: '100%', background: COLORS.bg, display: 'flex', flexDirection: 'column', padding: '72px 64px', opacity: fadeOut }}>

      {/* Header coach */}
      <div style={{ opacity: headerOp, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 48 }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 34, color: COLORS.gold, letterSpacing: 3 }}>Nutrainer</div>
        <div style={{ fontFamily: 'Helvetica Neue, Arial, sans-serif', fontSize: 20, color: COLORS.muted }}>
          Rapport · {weekLabel}
        </div>
      </div>

      {/* Nom athlète */}
      <div style={{ opacity: nameOp, transform: `scale(${Math.min(nameScale, 1)})`, marginBottom: 16 }}>
        <div style={{ fontFamily: 'Helvetica Neue, Arial, sans-serif', fontSize: 26, color: COLORS.muted, marginBottom: 4 }}>
          Rapport hebdomadaire de
        </div>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 72, color: COLORS.cream, fontWeight: 700, lineHeight: 1.1 }}>
          {name}
        </div>
        <div style={{ fontFamily: 'Helvetica Neue, Arial, sans-serif', fontSize: 22, color: COLORS.muted }}>
          Suivi par {coachName}
        </div>
      </div>

      <div style={{ width: '100%', height: 1, background: '#2a2a20', margin: '24px 0' }} />

      {/* Alerte */}
      {alert && (
        <div style={{
          opacity: alertOp, transform: `translateX(${alertX}px)`,
          background: '#c8707020', border: '1px solid #c87070',
          borderLeft: '4px solid #c87070', borderRadius: 16,
          padding: '20px 28px', marginBottom: 28,
          fontFamily: 'Helvetica Neue, Arial, sans-serif', fontSize: 26, color: '#e08080',
        }}>
          ⚠️ {alert === 'sous-alimentation' ? 'Sous-alimentation détectée cette semaine' : 'Excès calorique détecté cette semaine'}
        </div>
      )}

      {/* Stats jours actifs */}
      <div style={{ opacity: statsOp, display: 'flex', gap: 20, marginBottom: 36 }}>
        {[
          { label: 'Jours loggés', value: `${activeDays7j}/7`, good: activeDays7j >= 5 },
          { label: 'Séances sport', value: stravaCount7j > 0 ? `${stravaCount7j} séances` : '—', good: stravaCount7j > 0 },
          { label: 'Poids actuel', value: lastWeight ? `${lastWeight} kg` : '—', good: true },
        ].map((s, i) => (
          <div key={i} style={{
            flex: 1, background: COLORS.dark, borderRadius: 20, padding: '24px 20px', textAlign: 'center',
            border: `1px solid ${s.good ? '#a8905040' : '#c8707040'}`,
          }}>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 36, color: s.good ? COLORS.gold : '#c87070', fontWeight: 700, marginBottom: 6 }}>{s.value}</div>
            <div style={{ fontFamily: 'Helvetica Neue, Arial, sans-serif', fontSize: 20, color: COLORS.muted }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Barres macros */}
      <div style={{ opacity: statsOp, background: COLORS.dark, borderRadius: 24, padding: '36px 40px', marginBottom: 28 }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: 28, color: COLORS.cream, marginBottom: 28 }}>Moyennes 7 jours</div>
        <Bar label="Calories (kcal/j)" value={avgKcal7j} goal={goalKcal} color="#a89050" frame={frame} delay={90} />
        <Bar label="Protéines (g/j)" value={avgProtein7j} goal={goalProtein} color="#6b9e78" frame={frame} delay={110} />
      </div>

      {/* Résumé */}
      <div style={{ opacity: statsOp, background: COLORS.dark, borderRadius: 24, padding: '28px 36px', marginBottom: 28 }}>
        <div style={{ fontFamily: 'Helvetica Neue, Arial, sans-serif', fontSize: 26, color: '#bbb', lineHeight: 1.7 }}>
          {kcalPct >= 90 && kcalPct <= 110
            ? `✅ Objectif calorique respecté (${kcalPct}%)`
            : kcalPct < 90
            ? `⚠️ Déficit calorique : ${kcalPct}% de l'objectif atteint`
            : `⚠️ Surplus calorique : ${kcalPct}% de l'objectif`}
          {'\n'}
          {protPct >= 90
            ? `✅ Protéines suffisantes (${protPct}%)`
            : `⚠️ Protéines insuffisantes : ${protPct}% de l'objectif`}
          {weightTrend !== null && (
            `\n${weightTrend > 0 ? `📈 Poids en hausse : +${weightTrend} kg` : weightTrend < 0 ? `📉 Poids en baisse : ${weightTrend} kg` : '→ Poids stable'}`
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{ opacity: bottomOp, marginTop: 'auto', textAlign: 'center' }}>
        <div style={{ fontFamily: 'Helvetica Neue, Arial, sans-serif', fontSize: 22, color: COLORS.muted }}>
          Généré automatiquement par Nutrainer · nutrainer.io
        </div>
      </div>
    </div>
  );
};
