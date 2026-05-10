'use client';
import { useEffect, useRef, useState } from 'react';
import { useLocale } from '../lib/i18n';

const STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400;1,700&family=DM+Mono:wght@300;400;500&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  :root{
    --bg:#0d0d0d;--bg2:#111109;--card:#181812;--card2:#1e1e16;
    --border:#252520;--border2:#2e2e24;
    --gold:#c8b890;--gold-lt:#f0e6c8;--gold-dk:#a89050;
    --text:#e8e0d0;--muted:#6b6b58;--muted2:#4a4a3a;
    --red:#c87878;--green:#7cbd7c;--amber:#c8a850;
  }
  html{scroll-behavior:smooth}
  body{background:var(--bg);color:var(--text);font-family:'DM Mono',monospace;overflow-x:hidden;-webkit-font-smoothing:antialiased}

  /* CURSOR */
  #cg{position:fixed;pointer-events:none;z-index:0;width:600px;height:600px;border-radius:50%;background:radial-gradient(circle,rgba(200,184,144,.045)0%,transparent 65%);transform:translate(-50%,-50%);will-change:left,top;transition:left .07s linear,top .07s linear}

  /* NAV */
  .nav{position:fixed;inset:0 0 auto 0;z-index:200;height:60px;padding:0 48px;display:flex;align-items:center;justify-content:space-between;backdrop-filter:blur(24px) saturate(180%);background:rgba(13,13,13,.65);border-bottom:1px solid transparent;transition:border-color .3s}
  .nav.scrolled{border-bottom-color:var(--border)}
  .nav-logo{display:flex;align-items:center;gap:10px;text-decoration:none}
  .nav-name{font-family:'Playfair Display',serif;font-size:1.05rem;color:var(--gold-lt);letter-spacing:1px}
  .nav-links{display:flex;align-items:center;gap:28px}
  .nav-link{color:var(--muted);text-decoration:none;font-size:.66rem;letter-spacing:1px;transition:color .2s}
  .nav-link:hover{color:var(--gold)}
  .nav-cta{background:var(--gold);color:#0d0d0d;padding:8px 20px;border-radius:6px;font-family:'DM Mono',monospace;font-size:.66rem;font-weight:500;letter-spacing:1px;text-decoration:none;transition:background .2s,transform .15s}
  .nav-cta:hover{background:var(--gold-lt);transform:translateY(-1px)}

  /* HERO */
  .hero{min-height:100vh;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;padding:110px 48px 80px}
  .orb{position:absolute;border-radius:50%;filter:blur(80px);pointer-events:none}
  .o1{width:700px;height:700px;top:-250px;right:-180px;background:radial-gradient(circle,rgba(200,184,144,.14),transparent 70%);animation:ob1 9s ease-in-out infinite}
  .o2{width:500px;height:500px;bottom:-200px;left:-180px;background:radial-gradient(circle,rgba(168,144,80,.10),transparent 70%);animation:ob2 11s ease-in-out infinite}
  .o3{width:400px;height:400px;top:40%;left:25%;background:radial-gradient(circle,rgba(240,230,200,.05),transparent 70%);animation:ob3 14s ease-in-out infinite}
  @keyframes ob1{0%,100%{transform:translate(0,0)scale(1)}33%{transform:translate(-24px,18px)scale(1.04)}66%{transform:translate(16px,-22px)scale(.96)}}
  @keyframes ob2{0%,100%{transform:translate(0,0)}50%{transform:translate(32px,-18px)}}
  @keyframes ob3{0%,100%{transform:translate(0,0)scale(1)}50%{transform:translate(-14px,24px)scale(1.1)}}
  .hero-grid{position:absolute;inset:0;background-image:linear-gradient(rgba(200,184,144,.025)1px,transparent 1px),linear-gradient(90deg,rgba(200,184,144,.025)1px,transparent 1px);background-size:60px 60px}
  .hero-inner{position:relative;z-index:1;display:grid;grid-template-columns:1fr 1fr;gap:80px;align-items:center;max-width:1200px;width:100%}

  .hero-badge{display:inline-flex;align-items:center;gap:8px;background:rgba(200,184,144,.07);border:1px solid rgba(200,184,144,.2);border-radius:100px;padding:5px 14px 5px 10px;font-size:.6rem;color:var(--gold);letter-spacing:2px;text-transform:uppercase;margin-bottom:24px;animation:fadeUp .7s ease both;position:relative;overflow:hidden}
  .hero-badge::after{content:'';position:absolute;top:0;left:-100%;width:60%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.1),transparent);animation:shimmer 4s 2s ease-in-out infinite}
  @keyframes shimmer{0%{left:-100%}100%{left:160%}}
  .bdot{width:6px;height:6px;border-radius:50%;background:var(--gold);animation:bp 2s ease-in-out infinite}
  @keyframes bp{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.7)}}

  .hero-h1{font-family:'Playfair Display',serif;font-size:clamp(3rem,5.5vw,6rem);font-weight:700;line-height:1.02;color:var(--gold-lt);margin-bottom:22px;animation:fadeUp .7s .08s ease both}
  .hero-h1 em{font-style:italic;background:linear-gradient(130deg,#f0e6c8 20%,#c8b890 60%,#a89050 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}

  .hero-sub{font-size:.82rem;color:var(--muted);line-height:1.78;max-width:420px;margin-bottom:36px;letter-spacing:.3px;animation:fadeUp .7s .16s ease both}

  .hero-ctas{display:flex;gap:16px;align-items:center;flex-wrap:wrap;animation:fadeUp .7s .24s ease both}

  .btn-gold{background:linear-gradient(135deg,var(--gold-lt) 0%,var(--gold) 60%,var(--gold-dk) 100%);color:#0d0d0d;padding:15px 36px;border-radius:8px;font-family:'DM Mono',monospace;font-size:.76rem;font-weight:500;letter-spacing:1px;text-decoration:none;border:none;cursor:pointer;position:relative;overflow:hidden;display:inline-block;transition:transform .22s,box-shadow .22s}
  .btn-gold::before{content:'';position:absolute;inset:0;background:linear-gradient(135deg,rgba(255,255,255,.25),transparent 50%);opacity:0;transition:opacity .22s}
  .btn-gold:hover{transform:translateY(-2px);box-shadow:0 12px 32px rgba(200,184,144,.32)}
  .btn-gold:hover::before{opacity:1}

  .btn-out{color:var(--gold);font-family:'DM Mono',monospace;font-size:.76rem;letter-spacing:1px;text-decoration:none;display:inline-flex;align-items:center;gap:8px;border:1px solid rgba(200,184,144,.25);border-radius:8px;padding:14px 24px;transition:border-color .2s,background .2s,gap .2s}
  .btn-out:hover{border-color:rgba(200,184,144,.5);background:rgba(200,184,144,.05);gap:12px}

  .hero-trust{display:flex;gap:22px;align-items:center;flex-wrap:wrap;margin-top:20px;animation:fadeUp .7s .32s ease both}
  .ti{display:flex;align-items:center;gap:7px;font-size:.6rem;color:var(--muted2);letter-spacing:.5px}
  .tck{color:var(--green);font-size:.65rem}

  /* PHONE */
  .hero-visual{display:flex;justify-content:center;position:relative;animation:fadeRight .9s .3s ease both}
  .phone-outer{position:relative;animation:pFloat 4.5s ease-in-out infinite}
  @keyframes pFloat{0%,100%{transform:rotate(-2deg) translateY(0)}50%{transform:rotate(-2deg) translateY(-16px)}}
  .phone{width:252px;height:506px;background:#0a0a08;border-radius:38px;border:1.5px solid rgba(200,184,144,.12);overflow:hidden;position:relative;box-shadow:0 50px 100px rgba(0,0,0,.75),0 0 0 1px rgba(200,184,144,.03),inset 0 0 50px rgba(0,0,0,.5)}
  .p-notch{width:70px;height:21px;background:#0a0a08;border-radius:0 0 14px 14px;margin:0 auto;position:relative;z-index:10}
  .p-screen{padding:4px 13px 13px}
  .p-hdr{display:flex;justify-content:space-between;align-items:center;padding:7px 0 11px;border-bottom:1px solid rgba(200,184,144,.06);margin-bottom:13px}
  .p-ttl{font-family:'Playfair Display',serif;font-size:.86rem;color:#f0e6c8}
  .p-dt{font-size:.5rem;color:#2e2e24;letter-spacing:1px}
  .p-ring-w{display:flex;justify-content:center;margin-bottom:12px}
  .p-ring{width:96px;height:96px;position:relative}
  .r-svg{transform:rotate(-90deg);display:block}
  .r-tr{fill:none;stroke:rgba(200,184,144,.06);stroke-width:8}
  .r-arc{fill:none;stroke:url(#rg);stroke-width:8;stroke-linecap:round;stroke-dasharray:283;stroke-dashoffset:283;animation:rDraw 1.8s .5s ease forwards}
  @keyframes rDraw{to{stroke-dashoffset:70}}
  .r-ctr{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px}
  .r-val{font-family:'Playfair Display',serif;font-size:1.25rem;color:#f0e6c8}
  .r-lbl{font-size:.46rem;color:#2e2e24;letter-spacing:1.5px;text-transform:uppercase}
  .p-macros{display:flex;flex-direction:column;gap:6px;margin-bottom:13px}
  .p-mac{display:flex;flex-direction:column;gap:3px}
  .p-mh{display:flex;justify-content:space-between;font-size:.48rem;color:#4a4a3a}
  .p-bbg{height:3px;background:rgba(200,184,144,.06);border-radius:2px;overflow:hidden}
  .p-b{height:100%;border-radius:2px;animation:bGrow 1.4s ease both}
  @keyframes bGrow{from{width:0!important}}
  .pb1{background:linear-gradient(90deg,#c8b890,#f0e6c8);width:79%;animation-delay:.9s}
  .pb2{background:linear-gradient(90deg,#8a7a50,#c8b890);width:47%;animation-delay:1.0s}
  .pb3{background:linear-gradient(90deg,#6a6040,#a89050);width:62%;animation-delay:1.1s}
  .p-entries{display:flex;flex-direction:column;gap:5px}
  .p-ent{display:flex;justify-content:space-between;align-items:center;padding:7px 8px;background:rgba(200,184,144,.04);border:1px solid rgba(200,184,144,.05);border-radius:7px;opacity:0;animation:eIn .4s ease forwards}
  .p-ent:nth-child(1){animation-delay:1.6s}.p-ent:nth-child(2){animation-delay:1.85s}.p-ent:nth-child(3){animation-delay:2.1s}
  @keyframes eIn{from{opacity:0;transform:translateX(-10px)}to{opacity:1;transform:none}}
  .pen{font-size:.54rem;color:#c8b890}.pek{font-size:.48rem;color:#4a4a3a}
  .p-glow{position:absolute;bottom:-48px;left:50%;transform:translateX(-50%);width:200px;height:80px;background:radial-gradient(ellipse,rgba(200,184,144,.2),transparent 70%);filter:blur(10px);pointer-events:none}
  .chip{position:absolute;background:rgba(16,16,10,.94);border:1px solid rgba(200,184,144,.2);border-radius:10px;padding:8px 12px;font-size:.57rem;color:var(--gold);backdrop-filter:blur(16px);white-space:nowrap;display:flex;align-items:center;gap:6px;box-shadow:0 4px 16px rgba(0,0,0,.4)}
  .ch1{top:48px;left:-124px;animation:cb1 5s ease-in-out infinite}
  .ch2{bottom:125px;left:-112px;animation:cb2 6.5s ease-in-out infinite}
  .ch3{top:145px;right:-112px;animation:cb3 4.8s ease-in-out infinite}
  @keyframes cb1{0%,100%{transform:translateY(0)}50%{transform:translateY(-9px)}}
  @keyframes cb2{0%,100%{transform:translateY(0)}50%{transform:translateY(7px)}}
  @keyframes cb3{0%,100%{transform:translateY(0)}50%{transform:translateY(-11px)}}

  /* SOCIAL PROOF */
  .sp-strip{background:var(--bg);border-bottom:1px solid var(--border);padding:18px 48px;display:flex;justify-content:center;align-items:center;gap:36px;flex-wrap:wrap;overflow:hidden;position:relative}
  .sp-strip::before{content:'';position:absolute;inset:0;background:linear-gradient(90deg,transparent 0%,rgba(200,184,144,.025) 50%,transparent 100%);pointer-events:none}
  .sp-item{display:flex;align-items:center;gap:8px;font-size:.62rem;color:var(--muted);letter-spacing:.3px;white-space:nowrap}
  .sp-item strong{color:var(--gold-lt);font-family:'Playfair Display',serif;font-size:.9rem;font-weight:400}
  .sp-sep{width:1px;height:18px;background:var(--border)}
  .sp-stars{color:#c8b890;letter-spacing:1px;font-size:.7rem}

  /* TRUST BAR */
  .trust-bar{border-top:1px solid var(--border);border-bottom:1px solid var(--border);background:var(--bg2);padding:20px 48px;display:flex;justify-content:center;align-items:center;gap:48px;flex-wrap:wrap}
  .tb-item{display:flex;align-items:center;gap:12px}
  .tb-ico{font-size:1.1rem}
  .tb-text{font-size:.6rem;color:var(--muted);letter-spacing:.4px}
  .tb-text strong{color:var(--gold-lt);display:block;font-family:'Playfair Display',serif;font-size:.82rem;font-weight:400;margin-bottom:1px}

  /* QUOTE */
  .quote-sec{padding:80px 48px;background:linear-gradient(135deg,#0c0c0a,#111109,#0c0c0a);border-top:1px solid var(--border);border-bottom:1px solid var(--border);position:relative;overflow:hidden;text-align:center}
  .quote-sec::before{content:'';position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:800px;height:300px;border-radius:50%;background:radial-gradient(ellipse,rgba(200,184,144,.055),transparent 70%);filter:blur(40px);pointer-events:none}
  .quote-deco{display:flex;align-items:center;justify-content:center;gap:24px;margin-bottom:28px}
  .quote-line{width:60px;height:1px;background:linear-gradient(90deg,transparent,rgba(200,184,144,.3))}
  .quote-line.r{background:linear-gradient(90deg,rgba(200,184,144,.3),transparent)}
  .quote-ico{font-size:.6rem;color:rgba(200,184,144,.35);letter-spacing:4px}
  .quote-text{font-family:'Playfair Display',serif;font-size:clamp(1.4rem,3vw,2.4rem);font-style:italic;color:var(--gold-lt);line-height:1.45;max-width:820px;margin:0 auto 20px;position:relative;z-index:1;letter-spacing:.3px}
  .quote-text::before{content:'“';position:absolute;left:-32px;top:-14px;font-size:5rem;color:rgba(200,184,144,.12);font-style:normal;line-height:1;pointer-events:none}
  .quote-attr{font-size:.62rem;color:var(--muted2);letter-spacing:2.5px;text-transform:uppercase;position:relative;z-index:1}

  /* FOR WHO */
  .fw-sec{padding:100px 48px;border-top:1px solid var(--border);background:linear-gradient(180deg,#0d0d0b,#0f0f0c)}
  .fw-inner{max-width:1200px;margin:0 auto}
  .fw-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:56px}
  .fw-card{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:28px 24px;position:relative;overflow:hidden;transition:border-color .3s,transform .3s,box-shadow .3s;cursor:default}
  .fw-card::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,rgba(200,184,144,.35),transparent);opacity:0;transition:opacity .3s}
  .fw-card:hover{border-color:rgba(200,184,144,.28);transform:translateY(-4px);box-shadow:0 16px 40px rgba(0,0,0,.35)}
  .fw-card:hover::before{opacity:1}
  .fw-ico{font-size:2rem;margin-bottom:16px;display:block;filter:drop-shadow(0 0 12px rgba(200,184,144,.2))}
  .fw-ttl{font-family:'Playfair Display',serif;font-size:1rem;color:var(--gold-lt);margin-bottom:10px;line-height:1.25}
  .fw-desc{font-size:.68rem;color:var(--muted);line-height:1.75;letter-spacing:.2px}

  /* PROBLEM */
  .problem-section{background:linear-gradient(180deg,#0a0a08,#0d0d0b);padding:100px 48px;border-bottom:1px solid var(--border)}
  .problem-inner{max-width:1200px;margin:0 auto}
  .problem-grid{display:grid;grid-template-columns:1fr 1fr;gap:0;margin-top:52px;border:1px solid var(--border);border-radius:18px;overflow:hidden}
  .prob-col{padding:44px 40px}
  .prob-col.left{background:rgba(200,80,80,.025);border-right:1px solid var(--border)}
  .prob-col.right{background:rgba(100,200,100,.02)}
  .prob-head{font-size:.58rem;letter-spacing:3px;text-transform:uppercase;margin-bottom:28px;display:flex;align-items:center;gap:10px}
  .prob-head.bad{color:var(--red)}.prob-head.good{color:var(--green)}
  .prob-head .hl{flex:1;height:1px;background:currentColor;opacity:.2}
  .prob-item{display:flex;align-items:flex-start;gap:12px;padding:12px 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:.71rem;line-height:1.55;letter-spacing:.2px}
  .prob-item:last-child{border-bottom:none}
  .pico{flex-shrink:0;font-size:.7rem;margin-top:2px}
  .prob-item.bad{color:var(--muted)}.prob-item.good{color:var(--text)}
  .prob-item.bad .pico{color:var(--red)}.prob-item.good .pico{color:var(--green)}

  /* AI FLOW */
  .flow-section{padding:100px 48px;max-width:1200px;margin:0 auto}
  .flow-grid{display:grid;grid-template-columns:1fr 60px 1fr;gap:24px;align-items:center;margin-top:56px}
  .flow-inputs{display:flex;flex-direction:column;gap:12px}
  .fic{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:16px;display:flex;gap:12px;align-items:flex-start;transition:border-color .3s,transform .3s,box-shadow .3s}
  .fic:hover{border-color:rgba(200,184,144,.22);transform:translateX(-4px);box-shadow:0 8px 24px rgba(0,0,0,.3)}
  .fic-ico{font-size:1.1rem;flex-shrink:0;margin-top:1px}
  .fic-b{flex:1;min-width:0}
  .fic-ttl{font-size:.66rem;color:var(--gold-lt);margin-bottom:8px;letter-spacing:.3px}
  .fic-rows{display:flex;flex-direction:column;gap:5px}
  .fic-row{display:flex;justify-content:space-between;align-items:center;font-size:.56rem;color:var(--muted);gap:8px}
  .bad{color:var(--red)}.good{color:var(--green)}.amb{color:var(--amber)}

  .flow-mid{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;height:100%}
  .fm-line{flex:1;width:1px;background:linear-gradient(180deg,transparent,rgba(200,184,144,.18),transparent);position:relative;overflow:hidden}
  .fm-line::after{content:'';position:absolute;top:-18px;left:50%;transform:translateX(-50%);width:3px;height:18px;border-radius:2px;background:linear-gradient(180deg,transparent,var(--gold));animation:fFlow 1.8s ease-in-out infinite}
  @keyframes fFlow{0%{top:-18px;opacity:0}60%{opacity:.9}100%{top:100%;opacity:0}}
  .fm-node{width:48px;height:48px;border-radius:50%;background:rgba(200,184,144,.08);border:1.5px solid rgba(200,184,144,.25);display:flex;align-items:center;justify-content:center;font-family:'Playfair Display',serif;font-size:.62rem;color:var(--gold);letter-spacing:.5px;position:relative;flex-shrink:0;animation:nGlow 3s ease-in-out infinite}
  .fm-node::before{content:'';position:absolute;inset:-7px;border-radius:50%;border:1px solid rgba(200,184,144,.1);animation:nRing 3s ease-in-out infinite}
  .fm-node::after{content:'';position:absolute;inset:-14px;border-radius:50%;border:1px solid rgba(200,184,144,.05);animation:nRing 3s .4s ease-in-out infinite}
  @keyframes nGlow{0%,100%{box-shadow:0 0 14px rgba(200,184,144,.1)}50%{box-shadow:0 0 30px rgba(200,184,144,.26)}}
  @keyframes nRing{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.08);opacity:.4}}

  .flow-out{background:linear-gradient(135deg,#1e1e14,#181812);border:1px solid rgba(200,184,144,.2);border-radius:16px;padding:22px;box-shadow:0 0 50px rgba(200,184,144,.06),0 20px 50px rgba(0,0,0,.4);position:relative;overflow:hidden}
  .flow-out::before{content:'';position:absolute;top:0;right:0;width:140px;height:140px;background:radial-gradient(circle,rgba(200,184,144,.07),transparent 70%);pointer-events:none}
  .fo-hd{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px}
  .fo-ttl{font-family:'Playfair Display',serif;font-size:.88rem;color:var(--gold-lt)}
  .fo-badge{font-size:.48rem;color:var(--green);background:rgba(100,180,100,.1);border:1px solid rgba(100,180,100,.2);padding:3px 9px;border-radius:100px;letter-spacing:.5px}
  .fo-meta{font-size:.54rem;color:var(--muted);letter-spacing:.3px;margin-bottom:15px}
  .fo-meals{display:flex;flex-direction:column}
  .fo-meal{display:grid;grid-template-columns:68px 1fr auto;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid rgba(42,42,30,.5)}
  .fo-meal:last-child{border-bottom:none}
  .fo-t{font-size:.48rem;color:var(--muted);letter-spacing:.5px}
  .fo-n{font-size:.58rem;color:var(--gold-lt);letter-spacing:.2px}
  .fo-k{font-size:.48rem;color:var(--muted);text-align:right;white-space:nowrap}
  .fo-tags{display:flex;flex-wrap:wrap;gap:5px;margin-top:14px}
  .fo-tag{font-size:.48rem;color:var(--green);background:rgba(100,180,100,.08);border:1px solid rgba(100,180,100,.15);padding:3px 8px;border-radius:100px}

  .markers-strip{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:48px}
  .marker{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:16px 14px;transition:border-color .3s,transform .3s}
  .marker:hover{border-color:rgba(200,184,144,.22);transform:translateY(-3px)}
  .mk-lbl{font-size:.52rem;color:var(--muted);letter-spacing:.5px;text-transform:uppercase;margin-bottom:6px}
  .mk-val{font-family:'Playfair Display',serif;font-size:1.3rem;margin-bottom:2px}
  .mk-val.r{color:var(--red)}.mk-val.g{color:var(--green)}.mk-val.a{color:var(--amber)}
  .mk-unit{font-size:.5rem;color:var(--muted2);margin-bottom:8px}
  .mk-act{font-size:.56rem;color:var(--gold);line-height:1.5}

  /* ALTERNATING */
  .alt-section{padding:0 48px 80px}
  .alt-inner{max-width:1200px;margin:0 auto}
  .alt-row{display:grid;grid-template-columns:1fr 1fr;gap:80px;align-items:center;padding:80px 0;border-top:1px solid var(--border)}
  .alt-row.rev .alt-vis{order:-1}
  .alt-ey{font-size:.56rem;color:var(--gold);letter-spacing:3px;text-transform:uppercase;margin-bottom:14px;display:flex;align-items:center;gap:10px}
  .alt-ey::before{content:'';display:block;width:18px;height:1px;background:var(--gold)}
  .alt-h2{font-family:'Playfair Display',serif;font-size:clamp(1.8rem,3vw,2.8rem);font-weight:700;color:var(--gold-lt);line-height:1.1;margin-bottom:16px}
  .alt-h2 em{font-style:italic;background:linear-gradient(130deg,#f0e6c8,#c8b890 70%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
  .alt-p{font-size:.74rem;color:var(--muted);line-height:1.75;letter-spacing:.3px;margin-bottom:26px}
  .ck-list{display:flex;flex-direction:column;gap:11px}
  .ck-item{display:flex;align-items:flex-start;gap:11px;font-size:.69rem;color:var(--muted);line-height:1.55;letter-spacing:.2px}
  .ck{width:18px;height:18px;border-radius:50%;background:rgba(200,184,144,.1);border:1px solid rgba(200,184,144,.22);display:flex;align-items:center;justify-content:center;font-size:.56rem;color:var(--gold);flex-shrink:0;margin-top:1px}

  .vis-card{background:var(--card);border:1px solid var(--border);border-radius:18px;padding:26px;position:relative;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.4)}
  .vis-card::before{content:'';position:absolute;top:0;right:0;width:180px;height:180px;background:radial-gradient(circle,rgba(200,184,144,.06),transparent 70%);pointer-events:none}

  .bv-row{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid rgba(42,42,30,.5)}
  .bv-row:last-child{border-bottom:none}
  .bv-name{font-size:.6rem;color:var(--muted)}
  .bv-right{display:flex;align-items:center;gap:10px}
  .bv-val{font-family:'Playfair Display',serif;font-size:.88rem}
  .bv-bar{width:56px;height:4px;background:rgba(200,184,144,.08);border-radius:2px;overflow:hidden}
  .bv-fill{height:100%;border-radius:2px}
  .bv-act{font-size:.5rem;margin-top:3px;letter-spacing:.3px}
  .rz{color:var(--red)}.gz{color:var(--green)}.az{color:var(--amber)}

  .pv-hd{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}
  .pv-ttl{font-family:'Playfair Display',serif;font-size:.88rem;color:var(--gold-lt)}
  .pv-badge{font-size:.48rem;color:var(--green);background:rgba(100,180,100,.1);border:1px solid rgba(100,180,100,.18);padding:3px 8px;border-radius:100px}
  .pv-meta{font-size:.52rem;color:var(--muted);letter-spacing:.3px;margin-bottom:14px}
  .pv-day{margin-bottom:8px;padding:11px 12px;background:rgba(200,184,144,.04);border:1px solid rgba(42,42,30,.6);border-radius:10px}
  .pv-dh{display:flex;justify-content:space-between;font-size:.56rem;margin-bottom:5px}
  .pv-dn{color:var(--gold)}.pv-dk{color:var(--muted)}
  .pv-di{font-size:.52rem;color:var(--muted);line-height:1.6}
  .pv-tags{display:flex;gap:5px;flex-wrap:wrap;margin-top:12px}
  .pv-tag{font-size:.48rem;color:var(--green);background:rgba(100,180,100,.08);border:1px solid rgba(100,180,100,.15);padding:2px 7px;border-radius:100px}

  .cv-hd{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}
  .cv-ttl{font-family:'Playfair Display',serif;font-size:.9rem;color:var(--gold-lt)}
  .cv-cnt{font-size:.54rem;color:var(--gold);background:rgba(200,184,144,.1);border:1px solid rgba(200,184,144,.18);padding:3px 10px;border-radius:100px}
  .cv-ath{display:flex;justify-content:space-between;align-items:center;padding:9px 10px;background:rgba(200,184,144,.025);border:1px solid rgba(42,42,30,.7);border-radius:9px;margin-bottom:7px;opacity:0;animation:eIn .4s ease forwards}
  .cva-l{display:flex;align-items:center;gap:9px}
  .cva-av{width:28px;height:28px;border-radius:50%;background:rgba(200,184,144,.1);border:1px solid rgba(200,184,144,.16);display:flex;align-items:center;justify-content:center;font-size:.52rem;color:var(--gold)}
  .cva-name{font-size:.6rem;color:var(--gold-lt);margin-bottom:2px}
  .cva-meta{font-size:.5rem;color:var(--muted)}
  .cva-r{display:flex;align-items:center;gap:8px}
  .cva-str{font-size:.54rem;color:var(--muted)}
  .cv-badge{font-size:.46rem;letter-spacing:.5px;text-transform:uppercase;padding:3px 7px;border-radius:100px}
  .ok-b{background:rgba(100,180,100,.1);color:var(--green);border:1px solid rgba(100,180,100,.18)}
  .warn-b{background:rgba(200,160,60,.1);color:var(--amber);border:1px solid rgba(200,160,60,.18)}
  .new-b{background:rgba(200,184,144,.08);color:var(--gold);border:1px solid rgba(200,184,144,.18)}
  .cv-ft{margin-top:12px;padding:9px;border:1px dashed rgba(42,42,30,.8);border-radius:8px;text-align:center;font-size:.58rem;color:var(--muted);cursor:pointer;transition:color .2s,border-color .2s}
  .cv-ft:hover{color:var(--gold);border-color:rgba(200,184,144,.3)}

  /* REPORT STRIP */
  .rep-strip{background:var(--bg2);border-top:1px solid var(--border);border-bottom:1px solid var(--border);padding:30px 48px}
  .rep-inner{max-width:1200px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:40px}
  .rep-l{display:flex;align-items:center;gap:16px}
  .rep-ico{font-size:1.5rem}
  .rep-ttl{font-family:'Playfair Display',serif;font-size:1rem;color:var(--gold-lt);margin-bottom:3px}
  .rep-sub{font-size:.64rem;color:var(--muted);letter-spacing:.3px}
  .rep-items{display:flex;gap:20px;align-items:center;flex-wrap:wrap}
  .rep-item{display:flex;align-items:center;gap:7px;font-size:.6rem;color:var(--muted)}
  .rep-dot{width:4px;height:4px;border-radius:50%;background:var(--gold)}

  /* STEPS */
  .steps-sec{padding:100px 48px;border-top:1px solid var(--border)}
  .steps-wrap{max-width:1200px;margin:0 auto}
  .steps-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:0;margin-top:56px;position:relative}
  .steps-line{position:absolute;top:30px;left:calc(16.67% + 16px);right:calc(16.67% + 16px);height:1px;background:var(--border);overflow:hidden;z-index:0}
  .steps-prog{height:100%;width:0;background:linear-gradient(90deg,var(--gold-dk),var(--gold-lt));transition:width 1.6s cubic-bezier(.22,1,.36,1)}
  .steps-prog.in{width:100%}
  .step{display:flex;flex-direction:column;align-items:center;text-align:center;padding:0 24px;position:relative;z-index:1}
  .step-circ{width:60px;height:60px;border-radius:50%;background:var(--card);border:2px solid var(--border);display:flex;align-items:center;justify-content:center;font-family:'Playfair Display',serif;font-size:1.15rem;color:var(--gold);margin-bottom:22px;transition:border-color .3s,box-shadow .3s}
  .step:hover .step-circ{border-color:var(--gold);box-shadow:0 0 20px rgba(200,184,144,.2)}
  .step-ttl{font-family:'Playfair Display',serif;font-size:.95rem;color:var(--gold-lt);margin-bottom:10px}
  .step-desc{font-size:.66rem;color:var(--muted);line-height:1.65;letter-spacing:.3px}

  /* STATS */
  .stats-band{background:linear-gradient(135deg,#141410,#111109);border-top:1px solid var(--border);border-bottom:1px solid var(--border);padding:80px 48px}
  .stats-inner{max-width:1200px;margin:0 auto;display:grid;grid-template-columns:repeat(3,1fr);gap:60px;text-align:center}
  .stat-n{font-family:'Playfair Display',serif;font-size:clamp(2.8rem,5vw,4.5rem);font-weight:700;background:linear-gradient(130deg,#f0e6c8,#c8b890 70%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;line-height:1;margin-bottom:10px}
  .stat-l{font-size:.6rem;color:var(--muted);letter-spacing:2.5px;text-transform:uppercase}

  /* TESTIMONIALS */
  .testi-sec{padding:100px 48px;border-top:1px solid var(--border)}
  .testi-wrap{max-width:1200px;margin:0 auto}
  .testi-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:56px}
  .testi-card{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:26px 22px;display:flex;flex-direction:column;transition:border-color .3s,transform .3s}
  .testi-card:hover{border-color:rgba(200,184,144,.22);transform:translateY(-4px)}
  .testi-res{display:inline-flex;align-items:center;gap:7px;background:rgba(200,184,144,.07);border:1px solid rgba(200,184,144,.18);border-radius:100px;padding:4px 12px;font-size:.54rem;color:var(--gold);letter-spacing:.5px;margin-bottom:16px;align-self:flex-start}
  .testi-stars{font-size:.65rem;letter-spacing:2px;color:var(--gold);margin-bottom:14px}
  .testi-text{font-size:.69rem;color:var(--muted);line-height:1.7;letter-spacing:.2px;font-style:italic;flex:1;margin-bottom:20px}
  .testi-auth{display:flex;align-items:center;gap:10px}
  .testi-av{width:34px;height:34px;border-radius:50%;background:rgba(200,184,144,.1);border:1px solid rgba(200,184,144,.2);display:flex;align-items:center;justify-content:center;font-size:.66rem;color:var(--gold)}
  .testi-name{font-size:.62rem;color:var(--gold-lt);margin-bottom:2px}
  .testi-role{font-size:.54rem;color:var(--muted);letter-spacing:.3px}

  /* FAQ */
  .faq-sec{padding:100px 48px;border-top:1px solid var(--border)}
  .faq-wrap{max-width:760px;margin:0 auto}
  .faq-list{margin-top:52px;display:flex;flex-direction:column;gap:0}
  .faq-item{border-bottom:1px solid var(--border);overflow:hidden}
  .faq-item:first-child{border-top:1px solid var(--border)}
  .faq-q{width:100%;background:none;border:none;text-align:left;padding:22px 0;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:16px;font-family:'DM Mono',monospace;font-size:.78rem;color:var(--gold-lt);letter-spacing:.3px;line-height:1.45;transition:color .2s}
  .faq-q:hover{color:var(--gold)}
  .faq-ico{font-size:.8rem;color:var(--muted2);transition:transform .3s,color .2s;flex-shrink:0}
  .faq-ico.open{transform:rotate(45deg);color:var(--gold)}
  .faq-a{max-height:0;overflow:hidden;transition:max-height .38s cubic-bezier(.4,0,.2,1)}
  .faq-a.open{max-height:240px}
  .faq-a-inner{padding:0 0 20px;font-size:.72rem;color:var(--muted);line-height:1.8;letter-spacing:.2px}

  /* CTA */
  .cta-sec{padding:120px 48px;text-align:center;position:relative;overflow:hidden}
  .cta-orb{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:700px;height:400px;border-radius:50%;background:radial-gradient(ellipse,rgba(200,184,144,.09),transparent 70%);filter:blur(60px);pointer-events:none}
  .cta-inner{position:relative;z-index:1;max-width:620px;margin:0 auto}
  .cta-ey{font-size:.56rem;color:var(--gold);letter-spacing:3px;text-transform:uppercase;margin-bottom:20px;display:flex;align-items:center;justify-content:center;gap:12px}
  .cta-ey::before,.cta-ey::after{content:'';display:block;width:30px;height:1px;background:var(--gold)}
  .cta-h2{font-family:'Playfair Display',serif;font-size:clamp(2.2rem,4.5vw,4rem);font-weight:700;color:var(--gold-lt);line-height:1.06;margin-bottom:20px}
  .cta-h2 em{font-style:italic;background:linear-gradient(130deg,#f0e6c8,#c8b890 70%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
  .cta-sub{font-size:.78rem;color:var(--muted);line-height:1.75;margin-bottom:40px;letter-spacing:.3px}
  .cta-btns{display:flex;gap:16px;justify-content:center;flex-wrap:wrap;margin-bottom:20px}
  .cta-note{font-size:.58rem;color:var(--muted2);letter-spacing:.5px}

  /* PRICING */
  .pricing-sec{padding:100px 48px;border-top:1px solid var(--border);background:linear-gradient(180deg,#0d0d0b,#0f0f0c)}
  .pricing-inner{max-width:1100px;margin:0 auto}
  .pricing-toggle{display:flex;align-items:center;justify-content:center;gap:12px;margin:32px 0 52px;flex-wrap:wrap}
  .pt-opt{font-size:.68rem;color:var(--muted);letter-spacing:.5px;cursor:pointer;transition:color .2s}
  .pt-opt.active{color:var(--gold-lt)}
  .pt-switch{width:44px;height:24px;background:rgba(200,184,144,.12);border:1px solid rgba(200,184,144,.22);border-radius:100px;position:relative;cursor:pointer;transition:background .2s;flex-shrink:0}
  .pt-switch.on{background:rgba(200,184,144,.22)}
  .pt-knob{position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:var(--gold);transition:transform .22s}
  .pt-switch.on .pt-knob{transform:translateX(20px)}
  .pt-save{font-size:.54rem;color:var(--green);background:rgba(100,180,100,.1);border:1px solid rgba(100,180,100,.2);padding:2px 9px;border-radius:100px;letter-spacing:.5px}
  .pricing-group-label{font-size:.56rem;color:var(--muted);letter-spacing:3px;text-transform:uppercase;text-align:center;margin-bottom:22px;display:flex;align-items:center;gap:16px;justify-content:center}
  .pricing-group-label::before,.pricing-group-label::after{content:'';display:block;width:40px;height:1px;background:var(--border)}
  .plans-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;max-width:740px;margin:0 auto 52px}
  .coach-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
  .plan-card{background:var(--card);border:1px solid var(--border);border-radius:18px;padding:30px 26px;position:relative;overflow:hidden;transition:border-color .3s,transform .3s,box-shadow .3s}
  .plan-card:hover{border-color:rgba(200,184,144,.28);transform:translateY(-4px);box-shadow:0 16px 40px rgba(0,0,0,.35)}
  .plan-card.popular{border-color:rgba(200,184,144,.3);background:linear-gradient(145deg,#1e1e14,#181812)}
  .plan-card.popular::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,var(--gold),transparent)}
  .plan-badge{position:absolute;top:18px;right:18px;font-size:.48rem;color:#0d0d0d;background:var(--gold);padding:3px 10px;border-radius:100px;letter-spacing:.5px;font-weight:600;text-transform:uppercase}
  .plan-name{font-family:'Playfair Display',serif;font-size:1.1rem;color:var(--gold-lt);margin-bottom:4px}
  .plan-desc{font-size:.62rem;color:var(--muted);letter-spacing:.3px;margin-bottom:20px}
  .plan-price{display:flex;align-items:baseline;gap:4px;margin-bottom:5px}
  .plan-amount{font-family:'Playfair Display',serif;font-size:2.4rem;color:var(--gold-lt);line-height:1}
  .plan-per{font-size:.62rem;color:var(--muted);letter-spacing:.3px}
  .plan-annual{font-size:.58rem;color:var(--muted2);margin-bottom:22px;min-height:16px;letter-spacing:.3px}
  .plan-divider{height:1px;background:var(--border);margin-bottom:20px}
  .plan-items{display:flex;flex-direction:column;gap:9px;margin-bottom:26px}
  .plan-item{display:flex;align-items:flex-start;gap:9px;font-size:.65rem;color:var(--muted);line-height:1.5;letter-spacing:.2px}
  .plan-check{color:var(--green);font-size:.6rem;flex-shrink:0;margin-top:1px}
  .plan-cta{display:block;text-align:center;padding:12px;border-radius:8px;font-family:'DM Mono',monospace;font-size:.7rem;letter-spacing:1px;font-weight:500;text-decoration:none;transition:all .2s;cursor:pointer;border:none}
  .plan-cta.gold-c{background:linear-gradient(135deg,var(--gold-lt),var(--gold));color:#0d0d0d}
  .plan-cta.gold-c:hover{box-shadow:0 8px 24px rgba(200,184,144,.3);transform:translateY(-1px)}
  .plan-cta.outline-c{background:transparent;border:1px solid rgba(200,184,144,.22);color:var(--gold)}
  .plan-cta.outline-c:hover{border-color:rgba(200,184,144,.45);background:rgba(200,184,144,.05)}
  .coach-note{text-align:center;font-size:.6rem;color:var(--muted2);margin-top:18px;letter-spacing:.3px}
  @media(max-width:900px){.pricing-sec{padding:60px 20px}.plans-grid{grid-template-columns:1fr;max-width:100%}.coach-grid{grid-template-columns:1fr}}

  /* WAITLIST */
  .wl-sec{padding:100px 48px;text-align:center;border-top:1px solid var(--border);background:linear-gradient(135deg,#0c0c0a,#0f0f0c)}
  .wl-inner{max-width:580px;margin:0 auto}
  .wl-form{display:flex;gap:10px;margin:0 auto 16px;max-width:460px;flex-wrap:wrap;justify-content:center}
  .wl-input{flex:1;min-width:200px;background:rgba(255,255,255,.04);border:1px solid var(--border);border-radius:8px;padding:14px 18px;font-family:'DM Mono',monospace;font-size:.76rem;color:var(--text);outline:none;transition:border-color .2s}
  .wl-input::placeholder{color:var(--muted2)}
  .wl-input:focus{border-color:rgba(200,184,144,.4)}
  .wl-btn{flex-shrink:0}
  .wl-note{font-size:.56rem;color:var(--muted2);letter-spacing:.5px;margin-top:4px}
  .wl-sent{font-size:.76rem;color:var(--green);margin:0 auto 16px;letter-spacing:.3px;padding:14px 24px;background:rgba(100,180,100,.07);border:1px solid rgba(100,180,100,.18);border-radius:8px;display:inline-block}

  /* FOOTER */
  .footer{border-top:1px solid var(--border);padding:36px 48px;display:flex;align-items:center;justify-content:space-between}
  .footer-logo{display:flex;align-items:center;gap:9px;text-decoration:none}
  .footer-name{font-family:'Playfair Display',serif;font-size:.88rem;color:var(--gold);letter-spacing:1px}
  .footer-copy{font-size:.56rem;color:var(--muted2)}
  .footer-links{display:flex;gap:24px}
  .footer-link{font-size:.58rem;color:var(--muted);text-decoration:none;transition:color .2s}
  .footer-link:hover{color:var(--gold)}

  /* EYEBROW GENERIC */
  .ey{display:flex;align-items:center;gap:12px;font-size:.56rem;letter-spacing:3px;text-transform:uppercase;color:var(--gold);margin-bottom:16px}
  .ey::before{content:'';display:block;width:20px;height:1px;background:var(--gold)}
  .sh2{font-family:'Playfair Display',serif;font-size:clamp(2rem,4vw,3.4rem);font-weight:700;color:var(--gold-lt);line-height:1.1;margin-bottom:16px}
  .sh2 em{font-style:italic;background:linear-gradient(130deg,#f0e6c8,#c8b890 70%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
  .ssub{font-size:.76rem;color:var(--muted);line-height:1.75;max-width:480px;letter-spacing:.3px}

  /* ANIMATIONS */
  @keyframes fadeUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}
  @keyframes fadeRight{from{opacity:0;transform:translateX(30px)}to{opacity:1;transform:none}}
  [data-a]{opacity:0;transform:translateY(26px);transition:opacity .6s ease,transform .6s ease}
  [data-a].in{opacity:1;transform:none}
  [data-d="1"]{transition-delay:.05s}[data-d="2"]{transition-delay:.12s}[data-d="3"]{transition-delay:.19s}[data-d="4"]{transition-delay:.26s}[data-d="5"]{transition-delay:.33s}

  /* RESPONSIVE */
  @media(max-width:900px){
    .wl-sec{padding:60px 20px}.wl-form{flex-direction:column}.wl-input,.wl-btn{width:100%}
    .nav{padding:0 20px}.nav-links{display:none}
    .hero{padding:90px 20px 60px}
    .hero-inner{grid-template-columns:1fr;gap:56px;text-align:center}
    .hero-sub,.hero-trust{justify-content:center;margin-left:auto;margin-right:auto}
    .hero-ctas{justify-content:center}
    .hero-visual{order:-1}
    .ch1,.ch2,.ch3{display:none}
    .trust-bar{padding:16px 20px;gap:24px}
    .problem-section{padding:60px 20px}
    .problem-grid{grid-template-columns:1fr}
    .prob-col.left{border-right:none;border-bottom:1px solid var(--border)}
    .flow-section{padding:60px 20px}
    .flow-grid{grid-template-columns:1fr;gap:20px}
    .flow-mid{flex-direction:row;height:auto}
    .fm-line{width:100%;height:1px;flex:1}
    .fm-line::after{display:none}
    .markers-strip{grid-template-columns:repeat(2,1fr)}
    .alt-section{padding:0 20px 60px}
    .alt-row{grid-template-columns:1fr;gap:40px;padding:60px 0}
    .alt-row.rev .alt-vis{order:0}
    .rep-strip{padding:24px 20px}
    .rep-inner{flex-direction:column;gap:20px;text-align:center}
    .rep-items{justify-content:center}
    .steps-sec{padding:60px 20px}
    .steps-grid{grid-template-columns:1fr;gap:40px}
    .steps-line{display:none}
    .stats-band{padding:60px 20px}
    .stats-inner{grid-template-columns:1fr;gap:40px}
    .quote-sec{padding:50px 24px}
    .quote-text::before{display:none}
    .fw-sec{padding:60px 20px}
    .fw-grid{grid-template-columns:repeat(2,1fr);gap:14px}
    .testi-sec{padding:60px 20px}
    .testi-grid{grid-template-columns:1fr}
    .cta-sec{padding:80px 20px}
    .faq-sec{padding:60px 20px}
    .sp-strip{padding:14px 20px;gap:16px}
    .sp-sep{display:none}
    .footer{flex-direction:column;gap:18px;text-align:center;padding:28px 20px}
  }
  @media(min-width:901px) and (max-width:1100px){
    .testi-grid{grid-template-columns:repeat(2,1fr)}
  }
`;

function LogoMark({ id, size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 30 30" fill="none">
      <defs>
        <linearGradient id={`lb-${id}`} x1="0" y1="0" x2="30" y2="30">
          <stop offset="0%" stopColor="#1a1a14"/><stop offset="100%" stopColor="#0d0d0d"/>
        </linearGradient>
        <linearGradient id={`lg-${id}`} x1="0" y1="0" x2="8" y2="30">
          <stop offset="0%" stopColor="#f0e6c8"/><stop offset="100%" stopColor="#a89050"/>
        </linearGradient>
      </defs>
      <rect width="30" height="30" rx="7" fill={`url(#lb-${id})`}/>
      <rect x="4" y="4" width="5" height="22" rx="1" fill={`url(#lg-${id})`}/>
      <rect x="21" y="4" width="5" height="22" rx="1" fill={`url(#lg-${id})`}/>
      <polygon points="4,4 9,4 26,26 21,26" fill={`url(#lg-${id})`}/>
    </svg>
  );
}

export default function Landing() {
  const { t } = useLocale();
  const [scrolled, setScrolled] = useState(false);
  const [counts, setCounts] = useState({ users: 0, meals: 0, streak: 0 });
  const [faqOpen, setFaqOpen] = useState(null);
  const [annual, setAnnual] = useState(false);
  const statsRef = useRef(null);
  const stepsRef = useRef(null);
  const counted  = useRef(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  useEffect(() => {
    const el = document.getElementById('cg');
    if (!el) return;
    const fn = e => { el.style.left = e.clientX + 'px'; el.style.top = e.clientY + 'px'; };
    window.addEventListener('mousemove', fn, { passive: true });
    return () => window.removeEventListener('mousemove', fn);
  }, []);

  useEffect(() => {
    const obs = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); obs.unobserve(e.target); } }),
      { threshold: 0.1 }
    );
    document.querySelectorAll('[data-a]').forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!stepsRef.current) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { stepsRef.current.classList.add('in'); obs.disconnect(); } },
      { threshold: 0.4 }
    );
    obs.observe(stepsRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!statsRef.current) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !counted.current) {
          counted.current = true;
          tick('users', 3200); tick('meals', 186000); tick('streak', 142);
        }
      },
      { threshold: 0.3 }
    );
    obs.observe(statsRef.current);
    return () => obs.disconnect();
  }, []);

  function tick(key, target) {
    const t0 = Date.now(), dur = 2400;
    const run = () => {
      const p = Math.min((Date.now() - t0) / dur, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setCounts(prev => ({ ...prev, [key]: Math.floor(e * target) }));
      if (p < 1) requestAnimationFrame(run);
    };
    requestAnimationFrame(run);
  }

  function fmt(n) { return n >= 1000 ? (n / 1000).toFixed(1).replace('.0', '') + 'k' : String(n); }

  const forWho = t('landing.for_who');
  const pain = t('landing.pain');
  const gains = t('landing.gains');
  const athletes = t('landing.athletes');
  const steps = t('landing.steps');
  const testimonials = t('landing.testimonials');
  const meals = t('landing.meals');
  const repItems = t('landing.rep_items');
  const feat1Items = t('landing.feat1_items');
  const feat2Items = t('landing.feat2_items');
  const feat3Items = t('landing.feat3_items');
  const faq = t('landing.faq');

  return (
    <>
      <style>{STYLE}</style>
      <div id="cg" />

      {/* ─── NAV ─── */}
      <nav className={`nav${scrolled ? ' scrolled' : ''}`}>
        <a href="/" className="nav-logo">
          <LogoMark id="nav" size={28} />
          <span className="nav-name">Nutrainer</span>
        </a>
        <div className="nav-links">
          <a href="#pour-qui"  className="nav-link">{t('landing.for_who_ey')}</a>
          <a href="#ia"       className="nav-link">{t('landing.nav_ai')}</a>
          <a href="#coachs"   className="nav-link">{t('landing.nav_coaches')}</a>
          <a href="#tarifs"   className="nav-link">{t('landing.pricing_ey')}</a>
          <a href="#faq"      className="nav-link">{t('landing.faq_ey')}</a>
          <a href="/login"    className="nav-link">{t('landing.nav_login')}</a>
          <a href="/login"    className="nav-cta">{t('landing.nav_start')}</a>
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <section className="hero">
        <div className="o1 orb"/><div className="o2 orb"/><div className="o3 orb"/>
        <div className="hero-grid"/>
        <div className="hero-inner">
          <div>
            <div className="hero-badge"><span className="bdot"/>{t('landing.badge')}</div>
            <h1 className="hero-h1">{t('landing.h1_1')}<br/>{t('landing.h1_2')}<br/><em>{t('landing.h1_em')}</em></h1>
            <p className="hero-sub">{t('landing.sub')}</p>
            <div className="hero-ctas">
              <a href="/login" className="btn-gold">{t('landing.cta1')}</a>
              <a href="#ia" className="btn-out">
                {t('landing.cta2')}
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M7 2l5 5-5 5M2 7h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </a>
            </div>
            <div className="hero-trust">
              <span className="ti"><span className="tck">✓</span>{t('landing.trust1')}</span>
              <span className="ti"><span className="tck">✓</span>{t('landing.trust2')}</span>
              <span className="ti"><span className="tck">✓</span>{t('landing.trust3')}</span>
            </div>
          </div>

          <div className="hero-visual">
            <div className="phone-outer">
              <div className="chip ch1">🩸 Carence détectée</div>
              <div className="chip ch2">💪 78 g protéines</div>
              <div className="chip ch3">🔥 Objectif atteint</div>
              <div className="phone">
                <div className="p-notch"/>
                <div className="p-screen">
                  <div className="p-hdr"><span className="p-ttl">Nutrainer</span><span className="p-dt">VEN · 2 MAI</span></div>
                  <div className="p-ring-w">
                    <div className="p-ring">
                      <svg className="r-svg" width="96" height="96" viewBox="0 0 96 96">
                        <defs>
                          <linearGradient id="rg" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#f0e6c8"/><stop offset="100%" stopColor="#a89050"/>
                          </linearGradient>
                        </defs>
                        <circle className="r-tr" cx="48" cy="48" r="42"/>
                        <circle className="r-arc" cx="48" cy="48" r="42"/>
                      </svg>
                      <div className="r-ctr"><span className="r-val">1 847</span><span className="r-lbl">kcal</span></div>
                    </div>
                  </div>
                  <div className="p-macros">
                    {[['Protéines','142/180g','pb1'],['Glucides','186/240g','pb2'],['Lipides','54/70g','pb3']].map(([n,v,c]) => (
                      <div key={n} className="p-mac">
                        <div className="p-mh"><span>{n}</span><span>{v}</span></div>
                        <div className="p-bbg"><div className={`p-b ${c}`}/></div>
                      </div>
                    ))}
                  </div>
                  <div className="p-entries">
                    {[['Avoine · épinards','430 kcal'],['Lentilles · saumon','590 kcal'],['Poulet · brocolis','640 kcal']].map(([n,k]) => (
                      <div key={n} className="p-ent"><span className="pen">{n}</span><span className="pek">{k}</span></div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="p-glow"/>
            </div>
          </div>
        </div>
      </section>

      {/* ─── SOCIAL PROOF ─── */}
      <div className="sp-strip">
        <div className="sp-item"><span className="sp-stars">★★★★★</span><strong>{t('landing.sp_rating')}</strong></div>
        <div className="sp-sep"/>
        <div className="sp-item"><strong>{t('landing.sp_users')}</strong></div>
        <div className="sp-sep"/>
        <div className="sp-item"><strong>{t('landing.sp_plans')}</strong></div>
        <div className="sp-sep"/>
        <div className="sp-item">{t('landing.sp_rgpd')}</div>
        <div className="sp-sep"/>
        <div className="sp-item">{t('landing.sp_pwa')}</div>
      </div>

      {/* ─── TRUST BAR ─── */}
      <div className="trust-bar">
        {[
          { ico:'🩸', strong: t('landing.tb1s'), text: t('landing.tb1t') },
          { ico:'🤖', strong: t('landing.tb2s'), text: t('landing.tb2t') },
          { ico:'🚴', strong: t('landing.tb3s'), text: t('landing.tb3t') },
          { ico:'⚡', strong: t('landing.tb4s'), text: t('landing.tb4t') },
        ].map(item => (
          <div key={item.strong} className="tb-item">
            <span className="tb-ico">{item.ico}</span>
            <div className="tb-text"><strong>{item.strong}</strong>{item.text}</div>
          </div>
        ))}
      </div>

      {/* ─── FOR WHO ─── */}
      <section className="fw-sec" id="pour-qui">
        <div className="fw-inner">
          <div className="ey">{t('landing.for_who_ey')}</div>
          <h2 className="sh2">{t('landing.for_who_h2')} <em>{t('landing.for_who_h2_em')}</em></h2>
          <p className="ssub">{t('landing.for_who_sub')}</p>
          <div className="fw-grid">
            {Array.isArray(forWho) && forWho.map((item, i) => (
              <div key={i} className="fw-card" data-a data-d={String((i % 3) + 1)}>
                <span className="fw-ico">{item.ico}</span>
                <div className="fw-ttl">{item.title}</div>
                <p className="fw-desc">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── QUOTE ─── */}
      <div className="quote-sec" data-a>
        <div className="quote-deco">
          <span className="quote-line"/><span className="quote-ico">✦ ✦ ✦</span><span className="quote-line r"/>
        </div>
        <p className="quote-text">{t('landing.quote_text')}</p>
        <p className="quote-attr">{t('landing.quote_attr')}</p>
      </div>

      {/* ─── PROBLEM ─── */}
      <section className="problem-section" id="probleme">
        <div className="problem-inner">
          <div className="ey">{t('landing.prob_ey')}</div>
          <h2 className="sh2">{t('landing.prob_h2')}<br/><em>{t('landing.prob_h2_em')}</em></h2>
          <p className="ssub" style={{ marginBottom: 0 }}>{t('landing.prob_sub')}</p>
          <div className="problem-grid">
            <div className="prob-col left">
              <div className="prob-head bad"><span>✕</span>{t('landing.prob_left')}<span className="hl"/></div>
              {Array.isArray(pain) && pain.map((p, i) => (
                <div key={i} className="prob-item bad" data-a data-d={i + 1}>
                  <span className="pico">✕</span><span>{p}</span>
                </div>
              ))}
            </div>
            <div className="prob-col right">
              <div className="prob-head good"><span>✓</span>{t('landing.prob_right')}<span className="hl"/></div>
              {Array.isArray(gains) && gains.map((g, i) => (
                <div key={i} className="prob-item good" data-a data-d={i + 1}>
                  <span className="pico">✓</span><span>{g}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── AI FLOW ─── */}
      <section className="flow-section" id="ia">
        <div className="ey">{t('landing.flow_ey')}</div>
        <h2 className="sh2">{t('landing.flow_h2')}<br/><em>{t('landing.flow_h2_em')}</em></h2>
        <p className="ssub">{t('landing.flow_sub')}</p>

        <div className="flow-grid">
          <div className="flow-inputs">
            {[
              { ico:'🩸', ttl: t('landing.flow_blood'), rows:[['Ferritine','28 μg/L ↓','bad'],['Vitamine D','18 ng/mL ↓','bad'],['Cholestérol LDL','148 mg/dL ↑','bad'],['Glycémie','5.2 mmol/L ✓','good'],['TSH thyroïde','4.8 μUI/mL ≈','amb']] },
              { ico:'🏃', ttl: t('landing.flow_strava'), rows:[['Course ce matin','−580 kcal','good'],['Muscu demain 17h','Planifiée','amb'],['Récupération','Modérée','amb']] },
              { ico:'🏥', ttl: t('landing.flow_health'), rows:[['Hypothyroïdie légère','Pris en compte','amb'],['Intolérance gluten','Exclu','amb'],['Objectif','Perte −5 kg','good']] },
            ].map((c, i) => (
              <div key={c.ttl} className="fic" data-a data-d={i + 1}>
                <span className="fic-ico">{c.ico}</span>
                <div className="fic-b">
                  <div className="fic-ttl">{c.ttl}</div>
                  <div className="fic-rows">
                    {c.rows.map(([l, v, cls]) => (
                      <div key={l} className="fic-row"><span>{l}</span><span className={cls}>{v}</span></div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flow-mid">
            <div className="fm-line"/><div className="fm-node">IA</div><div className="fm-line"/>
          </div>

          <div className="flow-out" data-a data-d="4">
            <div className="fo-hd"><span className="fo-ttl">{t('landing.flow_out_ttl')}</span><span className="fo-badge">{t('landing.flow_out_badge')}</span></div>
            <div className="fo-meta">{t('landing.flow_out_meta')}</div>
            <div className="fo-meals">
              {[
                [Array.isArray(meals) ? meals[0] : 'Petit-déj.','Avoine sarrasin · œufs · épinards','430 kcal'],
                [Array.isArray(meals) ? meals[1] : 'Déjeuner','Lentilles · saumon · avocat','590 kcal'],
                [Array.isArray(meals) ? meals[2] : 'Collation','Amandes · orange · chia','260 kcal'],
                [Array.isArray(meals) ? meals[3] : 'Dîner','Poulet · brocolis · quinoa','640 kcal'],
              ].map(([tm,n,k]) => (
                <div key={tm} className="fo-meal"><span className="fo-t">{tm}</span><span className="fo-n">{n}</span><span className="fo-k">{k}</span></div>
              ))}
            </div>
            <div className="fo-tags">
              {['✓ Carence fer','✓ Vitamine D','✓ Anti-cholestérol','✓ Sans gluten','✓ Post-effort'].map(tag => (
                <span key={tag} className="fo-tag">{tag}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="markers-strip">
          {[
            { lbl:'Ferritine',       val:'28',  unit:'μg/L',    cls:'r', act:'→ Lentilles, épinards, abats au programme' },
            { lbl:'Vitamine D',      val:'18',  unit:'ng/mL',   cls:'r', act:'→ Saumon, œufs, champignons favorisés' },
            { lbl:'Cholestérol LDL', val:'148', unit:'mg/dL',   cls:'a', act:'→ Fibres ↑, graisses saturées ↓' },
            { lbl:'Glycémie',        val:'5.2', unit:'mmol/L',  cls:'g', act:'→ Stable — régime glucidique maintenu' },
          ].map(m => (
            <div key={m.lbl} className="marker" data-a>
              <div className="mk-lbl">{m.lbl}</div>
              <div className={`mk-val ${m.cls}`}>{m.val}</div>
              <div className="mk-unit">{m.unit}</div>
              <div className="mk-act">{m.act}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── ALTERNATING FEATURES ─── */}
      <section className="alt-section">
        <div className="alt-inner">

          {/* 1 — bilan sanguin */}
          <div className="alt-row">
            <div data-a>
              <div className="alt-ey">{t('landing.feat1_ey')}</div>
              <h2 className="alt-h2">{t('landing.feat1_h2')}<br/><em>{t('landing.feat1_h2_em')}</em></h2>
              <p className="alt-p">{t('landing.feat1_p')}</p>
              <div className="ck-list">
                {Array.isArray(feat1Items) && feat1Items.map((item, i) => (
                  <div key={i} className="ck-item"><span className="ck">✓</span><span>{item}</span></div>
                ))}
              </div>
            </div>
            <div className="alt-vis" data-a data-d="2">
              <div className="vis-card">
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px' }}>
                  <span style={{ fontFamily:"'Playfair Display',serif", fontSize:'.86rem', color:'var(--gold-lt)' }}>{t('landing.feat1_ey')}</span>
                  <span style={{ fontSize:'.5rem', color:'var(--muted)', letterSpacing:'.5px' }}>{t('landing.blood_date')}</span>
                </div>
                <div style={{ fontSize:'.54rem', color:'var(--muted)', marginBottom:'18px', letterSpacing:'.3px' }}>{t('landing.blood_ai')}</div>
                {[
                  { name:'Ferritine',       val:'28 μg/L',   cls:'rz', barcls:'var(--red)',   pct:25, act:'Carence. Programme adapté.' },
                  { name:'Vitamine D',       val:'18 ng/mL',  cls:'rz', barcls:'var(--red)',   pct:20, act:'Insuffisance. Alimentation ciblée.' },
                  { name:'Cholestérol LDL',  val:'148 mg/dL', cls:'az', barcls:'var(--amber)', pct:65, act:'Légèrement élevé. Fibres ↑.' },
                  { name:'Glycémie',         val:'5.2 mmol/L',cls:'gz', barcls:'var(--green)', pct:80, act:'Normal. Maintenir.' },
                  { name:'TSH (thyroïde)',   val:'4.8 μUI/mL',cls:'az', barcls:'var(--amber)', pct:60, act:'Limite haute. Pris en compte.' },
                ].map(m => (
                  <div key={m.name} className="bv-row">
                    <div><div className="bv-name">{m.name}</div><div className={`bv-act ${m.cls}`}>→ {m.act}</div></div>
                    <div className="bv-right">
                      <div className={`bv-val ${m.cls}`}>{m.val}</div>
                      <div className="bv-bar"><div className="bv-fill" style={{ width:`${m.pct}%`, background:m.barcls }}/></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 2 — génération IA */}
          <div className="alt-row rev">
            <div data-a>
              <div className="alt-ey">{t('landing.feat2_ey')}</div>
              <h2 className="alt-h2">{t('landing.feat2_h2')}<br/><em>{t('landing.feat2_h2_em')}</em></h2>
              <p className="alt-p">{t('landing.feat2_p')}</p>
              <div className="ck-list">
                {Array.isArray(feat2Items) && feat2Items.map((item, i) => (
                  <div key={i} className="ck-item"><span className="ck">✓</span><span>{item}</span></div>
                ))}
              </div>
            </div>
            <div className="alt-vis" data-a data-d="2">
              <div className="vis-card">
                <div className="pv-hd"><span className="pv-ttl">{t('landing.flow_out_ttl')}</span><span className="pv-badge">{t('landing.flow_out_badge')}</span></div>
                <div className="pv-meta">{t('landing.flow_out_meta')}</div>
                {[
                  { time: Array.isArray(meals) ? meals[0] : 'Petit-déjeuner', kcal:'430 kcal', items:'Porridge sarrasin · œufs brouillés · épinards sautés' },
                  { time: Array.isArray(meals) ? meals[1] : 'Déjeuner',       kcal:'590 kcal', items:'Lentilles corail · saumon vapeur · avocat' },
                  { time: Array.isArray(meals) ? meals[2] : 'Collation',      kcal:'260 kcal', items:'Amandes · orange · graines de chia' },
                  { time: Array.isArray(meals) ? meals[3] : 'Dîner',          kcal:'640 kcal', items:'Poulet rôti · brocolis · quinoa' },
                ].map(m => (
                  <div key={m.time} className="pv-day">
                    <div className="pv-dh"><span className="pv-dn">{m.time}</span><span className="pv-dk">{m.kcal}</span></div>
                    <div className="pv-di">{m.items}</div>
                  </div>
                ))}
                <div className="pv-tags">
                  {['✓ Carence fer corrigée','✓ Vit. D ↑','✓ Anti-cholestérol','✓ Sans gluten'].map(tag => <span key={tag} className="pv-tag">{tag}</span>)}
                </div>
              </div>
            </div>
          </div>

          {/* 3 — coachs */}
          <div className="alt-row" id="coachs">
            <div data-a>
              <div className="alt-ey">{t('landing.feat3_ey')}</div>
              <h2 className="alt-h2">{t('landing.feat3_h2')}<br/><em>{t('landing.feat3_h2_em')}</em></h2>
              <p className="alt-p">{t('landing.feat3_p')}</p>
              <div className="ck-list">
                {Array.isArray(feat3Items) && feat3Items.map((item, i) => (
                  <div key={i} className="ck-item"><span className="ck">✓</span><span>{item}</span></div>
                ))}
              </div>
              <a href="/login" className="btn-gold" style={{ marginTop:'28px', display:'inline-block' }}>{t('landing.feat3_cta')}</a>
            </div>
            <div className="alt-vis" data-a data-d="2">
              <div className="vis-card">
                <div className="cv-hd"><span className="cv-ttl">{t('landing.coach_athletes')}</span><span className="cv-cnt">{t('landing.coach_active')}</span></div>
                {Array.isArray(athletes) && athletes.map((a, i) => (
                  <div key={a.name} className="cv-ath" style={{ animationDelay:`${.5 + i * .15}s` }}>
                    <div className="cva-l">
                      <div className="cva-av">{a.initials}</div>
                      <div><div className="cva-name">{a.name}</div><div className="cva-meta">{a.meta}</div></div>
                    </div>
                    <div className="cva-r">
                      <span className="cva-str">{a.streak}</span>
                      <span className={`cv-badge ${a.cls}`}>{a.label}</span>
                    </div>
                  </div>
                ))}
                <div className="cv-ft">{t('landing.coach_reports')}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── REPORT STRIP ─── */}
      <div className="rep-strip">
        <div className="rep-inner">
          <div className="rep-l">
            <span className="rep-ico">📊</span>
            <div>
              <div className="rep-ttl">{t('landing.rep_ttl')}</div>
              <div className="rep-sub">{t('landing.rep_sub')}</div>
            </div>
          </div>
          <div className="rep-items">
            {Array.isArray(repItems) && repItems.map(item => (
              <div key={item} className="rep-item"><span className="rep-dot"/><span>{item}</span></div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── STEPS ─── */}
      <section className="steps-sec">
        <div className="steps-wrap">
          <div className="ey">{t('landing.steps_ey')}</div>
          <h2 className="sh2">{t('landing.steps_h2')} <em>{t('landing.steps_h2_em')}</em></h2>
          <div className="steps-grid">
            <div className="steps-line"><div className="steps-prog" ref={stepsRef}/></div>
            {Array.isArray(steps) && steps.map((s, i) => (
              <div key={s.n} className="step" data-a data-d={i + 1}>
                <div className="step-circ">{s.n}</div>
                <h3 className="step-ttl">{s.title}</h3>
                <p className="step-desc">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── STATS ─── */}
      <div className="stats-band" ref={statsRef}>
        <div className="stats-inner">
          <div data-a><div className="stat-n">{fmt(counts.users)}+</div><div className="stat-l">{t('landing.stat1')}</div></div>
          <div data-a data-d="2"><div className="stat-n">{fmt(counts.meals)}+</div><div className="stat-l">{t('landing.stat2')}</div></div>
          <div data-a data-d="3"><div className="stat-n">{counts.streak} j</div><div className="stat-l">{t('landing.stat3')}</div></div>
        </div>
      </div>

      {/* ─── TESTIMONIALS ─── */}
      <section className="testi-sec">
        <div className="testi-wrap">
          <div className="ey">{t('landing.testi_ey')}</div>
          <h2 className="sh2">{t('landing.testi_h2')} <em>{t('landing.testi_h2_em')}</em></h2>
          <div className="testi-grid">
            {Array.isArray(testimonials) && testimonials.map((tm, i) => (
              <div key={tm.name} className="testi-card" data-a data-d={i + 1}>
                <div className="testi-res">📈 {tm.result}</div>
                <div className="testi-stars">{'★'.repeat(tm.stars)}</div>
                <p className="testi-text">{tm.text}</p>
                <div className="testi-auth">
                  <div className="testi-av">{tm.initials}</div>
                  <div><div className="testi-name">{tm.name}</div><div className="testi-role">{tm.role}</div></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── PRICING ─── */}
      <section className="pricing-sec" id="tarifs">
        <div className="pricing-inner">
          <div className="ey" style={{ justifyContent:'center' }}>{t('landing.pricing_ey')}</div>
          <h2 className="sh2" style={{ textAlign:'center' }}>{t('landing.pricing_h2')} <em>{t('landing.pricing_h2_em')}</em></h2>

          <div className="pricing-toggle">
            <span className={`pt-opt${!annual?' active':''}`} onClick={() => setAnnual(false)}>{t('landing.pricing_toggle_m')}</span>
            <div className={`pt-switch${annual?' on':''}`} onClick={() => setAnnual(a => !a)}><div className="pt-knob"/></div>
            <span className={`pt-opt${annual?' active':''}`} onClick={() => setAnnual(true)}>{t('landing.pricing_toggle_a')}</span>
            <span className="pt-save">{t('landing.pricing_save')}</span>
          </div>

          <div className="pricing-group-label">{t('landing.pricing_individual')}</div>
          <div className="plans-grid" data-a>
            <div className="plan-card">
              <div className="plan-name">{t('landing.pricing_free_name')}</div>
              <div className="plan-desc">{t('landing.pricing_free_desc')}</div>
              <div className="plan-price"><span className="plan-amount" style={{ fontSize:'2rem' }}>0€</span></div>
              <div className="plan-annual">&nbsp;</div>
              <div className="plan-divider"/>
              <div className="plan-items">
                {t('landing.pricing_free_items').map((item, i) => (
                  <div key={i} className="plan-item"><span className="plan-check">✓</span><span>{item}</span></div>
                ))}
              </div>
              <a href="/login" className="plan-cta outline-c">{t('landing.pricing_cta_free')}</a>
            </div>
            <div className="plan-card popular">
              <div className="plan-badge">{t('landing.pricing_popular')}</div>
              <div className="plan-name">{t('landing.pricing_pro_name')}</div>
              <div className="plan-desc">{t('landing.pricing_pro_desc')}</div>
              <div className="plan-price">
                <span className="plan-amount">{annual ? '7,99€' : '9,99€'}</span>
                <span className="plan-per">{t('landing.pricing_month')}</span>
              </div>
              <div className="plan-annual">{annual ? `95,90€ ${t('landing.pricing_year')}` : ' '}</div>
              <div className="plan-divider"/>
              <div className="plan-items">
                {t('landing.pricing_pro_items').map((item, i) => (
                  <div key={i} className="plan-item"><span className="plan-check">✓</span><span>{item}</span></div>
                ))}
              </div>
              <a href={annual ? 'https://buy.stripe.com/eVqbIU2n0eqt1t74K22Nq01' : 'https://buy.stripe.com/eVqeV6f9M8251t73FY2Nq00'} className="plan-cta gold-c">{t('landing.pricing_cta_pro')}</a>
            </div>
          </div>

          <div className="pricing-group-label">{t('landing.pricing_coach_title')}</div>
          <div className="coach-grid" data-a>
            {[
              { name: t('landing.pricing_starter_name'), desc: t('landing.pricing_starter_desc'), m:'29,99€', a:'23,99€', ay:'287,90€', lm:'https://buy.stripe.com/14A28k4v8fux3Bf5O62Nq02', la:'https://buy.stripe.com/dRmbIU7Hkbeh3Bf6Sa2Nq03' },
              { name: t('landing.pricing_growth_name'),  desc: t('landing.pricing_growth_desc'),  m:'59,99€', a:'47,99€', ay:'575,90€', lm:'https://buy.stripe.com/7sYbIU8Lo4PTefT7We2Nq04', la:'https://buy.stripe.com/cNi4gsbXA0zD7Rv7We2Nq07' },
              { name: t('landing.pricing_coach_pro_name'), desc: t('landing.pricing_coach_pro_desc'), m:'99,99€', a:'79,99€', ay:'959,90€', lm:'https://buy.stripe.com/bJe14g7Hk6Y19ZD90i2Nq06', la:'https://buy.stripe.com/3cI4gs3r45TXefT0tM2Nq08' },
            ].map((plan, i) => (
              <div key={i} className="plan-card" data-d={i+1}>
                <div className="plan-name">{plan.name}</div>
                <div className="plan-desc">{plan.desc}</div>
                <div className="plan-price">
                  <span className="plan-amount" style={{ fontSize:'1.9rem' }}>{annual ? plan.a : plan.m}</span>
                  <span className="plan-per">{t('landing.pricing_month')}</span>
                </div>
                <div className="plan-annual">{annual ? `${plan.ay} ${t('landing.pricing_year')}` : ' '}</div>
                <div className="plan-divider"/>
                <div className="plan-items">
                  {t('landing.pricing_coach_items').map((item, j) => (
                    <div key={j} className="plan-item"><span className="plan-check">✓</span><span>{item}</span></div>
                  ))}
                </div>
                <a href={annual ? plan.la : plan.lm} className="plan-cta outline-c">{t('landing.pricing_cta_coach')}</a>
              </div>
            ))}
          </div>
          <p className="coach-note">{t('landing.pricing_coach_sub')}</p>
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section className="faq-sec" id="faq">
        <div className="faq-wrap">
          <div className="ey" style={{ justifyContent:'center' }}>{t('landing.faq_ey')}</div>
          <h2 className="sh2" style={{ textAlign:'center', marginBottom:0 }}>{t('landing.faq_h2')} <em>{t('landing.faq_h2_em')}</em></h2>
          <div className="faq-list">
            {Array.isArray(faq) && faq.map((item, i) => (
              <div key={i} className="faq-item">
                <button className="faq-q" onClick={() => setFaqOpen(faqOpen === i ? null : i)}>
                  <span>{item.q}</span>
                  <span className={`faq-ico${faqOpen === i ? ' open' : ''}`}>+</span>
                </button>
                <div className={`faq-a${faqOpen === i ? ' open' : ''}`}>
                  <div className="faq-a-inner">{item.a}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FREE TRIAL CTA ─── */}
      <section className="wl-sec" id="waitlist">
        <div className="wl-inner" data-a>
          <div className="cta-ey">{t('landing.waitlist_ey')}</div>
          <h2 className="cta-h2" style={{ marginBottom:'16px' }}>{t('landing.waitlist_h2')} <em>{t('landing.waitlist_h2_em')}</em></h2>
          <p className="cta-sub">{t('landing.waitlist_sub')}</p>
          <a href="/login" className="btn-gold" style={{ display:'inline-block', marginBottom:'16px' }}>{t('landing.waitlist_btn')}</a>
          <p className="wl-note">{t('landing.waitlist_note')}</p>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="cta-sec">
        <div className="cta-orb"/>
        <div className="cta-inner" data-a>
          <div className="cta-ey">{t('landing.cta_ey')}</div>
          <h2 className="cta-h2">{t('landing.cta_h2')}<br/><em>{t('landing.cta_h2_em')}</em></h2>
          <p className="cta-sub">{t('landing.cta_sub')}</p>
          <div className="cta-btns">
            <a href="/login" className="btn-gold">{t('landing.cta_btn1')}</a>
            <a href="/login" className="btn-out">{t('landing.cta_btn2')}</a>
          </div>
          <p className="cta-note">{t('landing.cta_note')}</p>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="footer">
        <a href="/" className="footer-logo"><LogoMark id="ft" size={24}/><span className="footer-name">Nutrainer</span></a>
        <span className="footer-copy">{t('landing.footer_copy')}</span>
        <div className="footer-links">
          <a href="/cgu"     className="footer-link">{t('landing.footer_cgu')}</a>
          <a href="/privacy" className="footer-link">{t('landing.footer_privacy')}</a>
          <a href="/login"   className="footer-link">{t('landing.footer_login')}</a>
        </div>
      </footer>
    </>
  );
}

