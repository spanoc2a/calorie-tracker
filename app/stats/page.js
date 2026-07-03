'use client';
import { Fragment, useState, useEffect, useMemo } from 'react';

// Tableau de bord télémétrie — réservé au propriétaire (voir /api/telemetry/summary).
// DAU 14 jours (barres CSS), crashs récents, événements agrégés avec détail par jour.

const GOLD = '#d4af37';

function fmtDay(dateStr) {
  try {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
  } catch { return dateStr; }
}

function fmtDateTime(iso) {
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris',
    });
  } catch { return iso || '—'; }
}

export default function StatsPage() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null); // 'auth' | 'forbidden' | 'error'
  const [selectedEvent, setSelectedEvent] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/telemetry/summary')
      .then(async (r) => {
        if (cancelled) return;
        if (r.status === 401) { setErr('auth'); return; }
        if (r.status === 403) { setErr('forbidden'); return; }
        if (!r.ok) { setErr('error'); return; }
        setData(await r.json());
      })
      .catch(() => { if (!cancelled) setErr('error'); });
    return () => { cancelled = true; };
  }, []);

  // days arrive du plus récent au plus ancien → chronologique pour l'affichage.
  const days = useMemo(() => (data?.days ? [...data.days].reverse() : []), [data]);
  const maxDau = useMemo(() => Math.max(1, ...days.map((d) => d.dau || 0)), [days]);
  const totalCrashes = useMemo(() => days.reduce((s, d) => s + (d.crashes || 0), 0), [days]);

  // Agrégat 14 j par nom d'événement, trié décroissant.
  const events = useMemo(() => {
    const agg = {};
    for (const d of days) {
      for (const [name, n] of Object.entries(d.events || {})) {
        agg[name] = (agg[name] || 0) + (Number(n) || 0);
      }
    }
    return Object.entries(agg).sort((a, b) => b[1] - a[1]);
  }, [days]);

  const shell = (children) => (
    <div style={{
      minHeight: '100vh', background: '#111', color: '#e8e2d2',
      fontFamily: "-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif",
      padding: '32px 20px 64px',
    }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        <div style={{ fontSize: 11, letterSpacing: 2.5, textTransform: 'uppercase', color: '#8a8068', marginBottom: 6 }}>
          Nutrainer — propriétaire
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 600, color: GOLD, margin: '0 0 28px' }}>Statistiques</h1>
        {children}
      </div>
    </div>
  );

  if (err === 'auth') return shell(
    <p style={{ color: '#b4ad9e', fontSize: 15 }}>
      Session expirée. <a href="/login" style={{ color: GOLD }}>Se connecter</a>
    </p>
  );
  if (err === 'forbidden') return shell(
    <p style={{ color: '#b4ad9e', fontSize: 15 }}>Réservé au propriétaire.</p>
  );
  if (err === 'error') return shell(
    <p style={{ color: '#b4ad9e', fontSize: 15 }}>Impossible de charger les statistiques. Réessaie plus tard.</p>
  );
  if (!data) return shell(
    <p style={{ color: '#615c50', fontSize: 13, letterSpacing: 2 }}>CHARGEMENT…</p>
  );

  const panel = {
    background: '#1a1916', border: '1px solid #2a2820', borderRadius: 14, padding: '20px 22px', marginBottom: 24,
  };
  const sectionTitle = {
    fontSize: 11.5, fontWeight: 600, letterSpacing: 1.8, textTransform: 'uppercase', color: '#9a8f76', margin: '0 0 16px',
  };
  const mono = "ui-monospace,'Cascadia Mono','Segoe UI Mono',Menlo,Consolas,monospace";

  return shell(
    <>
      {/* ── DAU 14 jours ── */}
      <section style={panel}>
        <h2 style={sectionTitle}>Utilisateurs actifs — 14 derniers jours</h2>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120 }}>
          {days.map((d) => (
            <div key={d.date} title={`${d.date} — ${d.dau} utilisateur(s)`}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 0 }}>
              <div style={{ fontSize: 10.5, color: '#b4ad9e' }}>{d.dau}</div>
              <div style={{
                width: '100%', maxWidth: 34, borderRadius: '3px 3px 0 0',
                height: `${Math.max(3, Math.round((d.dau / maxDau) * 84))}px`,
                background: d.dau > 0 ? GOLD : '#2e2b22',
              }} />
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
          {days.map((d) => (
            <div key={d.date} style={{ flex: 1, textAlign: 'center', fontSize: 9.5, color: '#615c50', minWidth: 0, overflow: 'hidden' }}>
              {fmtDay(d.date)}
            </div>
          ))}
        </div>
      </section>

      {/* ── Crashs ── */}
      <section style={panel}>
        <h2 style={sectionTitle}>
          Crashs — 14 jours : <span style={{ color: totalCrashes > 0 ? '#d28484' : '#86c896' }}>{totalCrashes}</span>
        </h2>
        {(!data.crashes || data.crashes.length === 0) ? (
          <p style={{ color: '#615c50', fontSize: 13, margin: 0 }}>Aucun crash enregistré. Tout roule.</p>
        ) : (
          <div style={{ fontFamily: mono, fontSize: 11.5, lineHeight: 1.5, overflowX: 'auto' }}>
            {data.crashes.map((c, i) => (
              <div key={i} style={{
                padding: '8px 0', borderBottom: i < data.crashes.length - 1 ? '1px solid #232119' : 'none',
                whiteSpace: 'nowrap',
              }}>
                <span style={{ color: '#8a8068' }}>{fmtDateTime(c.at)}</span>
                <span style={{ color: '#615c50' }}>{' · '}</span>
                <span style={{ color: GOLD }}>{c.screen || 'écran ?'}</span>
                <span style={{ color: '#615c50' }}>{' · '}</span>
                <span style={{ color: '#d28484' }}>{(c.message || '—').slice(0, 120)}</span>
                <span style={{ color: '#615c50' }}>{' · '}</span>
                <span style={{ color: '#8a8474' }}>{c.platform || '?'} {c.version || ''}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Événements agrégés ── */}
      <section style={panel}>
        <h2 style={sectionTitle}>Événements — somme sur 14 jours</h2>
        {events.length === 0 ? (
          <p style={{ color: '#615c50', fontSize: 13, margin: 0 }}>Aucun événement sur la période.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', color: '#8a8474', fontWeight: 500, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', padding: '4px 8px 10px' }}>Événement</th>
                <th style={{ textAlign: 'right', color: '#8a8474', fontWeight: 500, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', padding: '4px 8px 10px' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {events.map(([name, total]) => (
                <Fragment key={name}>
                  <tr
                    onClick={() => setSelectedEvent(selectedEvent === name ? null : name)}
                    style={{ cursor: 'pointer', background: selectedEvent === name ? '#221f18' : 'transparent' }}>
                    <td style={{ padding: '8px', borderTop: '1px solid #232119', fontFamily: mono, fontSize: 12.5 }}>
                      <span style={{ color: '#615c50', marginRight: 8 }}>{selectedEvent === name ? '▾' : '▸'}</span>
                      {name}
                    </td>
                    <td style={{ padding: '8px', borderTop: '1px solid #232119', textAlign: 'right', color: GOLD, fontWeight: 600 }}>
                      {total}
                    </td>
                  </tr>
                  {selectedEvent === name && (
                    <tr>
                      <td colSpan={2} style={{ padding: '4px 8px 14px', borderTop: '1px solid #232119' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {days.map((d) => (
                            <div key={d.date} style={{
                              fontSize: 11, fontFamily: mono, padding: '4px 8px',
                              border: '1px solid #2a2820', borderRadius: 7,
                              color: (d.events?.[name] || 0) > 0 ? '#e8e2d2' : '#615c50',
                            }}>
                              {fmtDay(d.date)} · <span style={{ color: (d.events?.[name] || 0) > 0 ? GOLD : '#615c50' }}>{d.events?.[name] || 0}</span>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
