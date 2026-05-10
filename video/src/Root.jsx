import { Composition } from 'remotion';
import { Testimonial } from './templates/Testimonial';
import { FeatureDemo } from './templates/FeatureDemo';
import { EducContent } from './templates/EducContent';
import { LogoIntro } from './compositions/LogoIntro';
import { AthleteReport } from './compositions/AthleteReport';
import { Outro } from './compositions/Outro';
import { StatsBadge } from './compositions/StatsBadge';
import { TESTIMONIALS, FEATURES, EDUC } from './data/videos';

const W = 1080;
const H = 1920;
const FPS = 30;

// Durée dynamique selon le contenu
const testimonialFrames = 200; // ~6.6s
const featureFrames = (steps) => 50 + steps.length * 22 + 100; // dynamique
const educFrames = (points) => 70 + points.length * 25 + 130; // dynamique

export const RemotionRoot = () => (
  <>
    {/* ── ANIMATIONS LOGO ── */}
    <Composition id="LogoIntro" component={LogoIntro} durationInFrames={120} fps={FPS} width={W} height={H} />
    <Composition id="LogoIntro-Square" component={LogoIntro} durationInFrames={120} fps={FPS} width={1080} height={1080} />
    <Composition id="Outro" component={Outro} durationInFrames={150} fps={FPS} width={W} height={H} />
    <Composition id="StatsBadge" component={StatsBadge} durationInFrames={180} fps={FPS} width={W} height={H} />
    <Composition id="AthleteReport" component={AthleteReport} durationInFrames={210} fps={FPS} width={W} height={H}
      defaultProps={{ name: 'Prénom', coachName: 'Coach', avgKcal7j: 1850, goalKcal: 2200, avgProtein7j: 130, goalProtein: 160, activeDays7j: 5, lastWeight: 78.5, weightTrend: -0.4, alert: null, stravaCount7j: 3, weekLabel: 'Semaine du 3 mai 2026' }}
    />

    {/* ── 12 TÉMOIGNAGES ── */}
    {TESTIMONIALS.map((t) => (
      <Composition
        key={t.id}
        id={t.id}
        component={Testimonial}
        defaultProps={t}
        durationInFrames={testimonialFrames}
        fps={FPS}
        width={W}
        height={H}
      />
    ))}

    {/* ── 6 DÉMOS FEATURES ── */}
    {FEATURES.map((f) => (
      <Composition
        key={f.id}
        id={f.id}
        component={FeatureDemo}
        defaultProps={f}
        durationInFrames={featureFrames(f.steps)}
        fps={FPS}
        width={W}
        height={H}
      />
    ))}

    {/* ── 6 CONTENUS ÉDUCATIFS ── */}
    {EDUC.map((e) => (
      <Composition
        key={e.id}
        id={e.id}
        component={EducContent}
        defaultProps={e}
        durationInFrames={educFrames(e.points)}
        fps={FPS}
        width={W}
        height={H}
      />
    ))}
  </>
);
