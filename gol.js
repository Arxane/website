/**
 * gol.js — Conway's Game of Life as generative binary art
 * Renders '0'/'1' glyphs on a canvas inside the hero section.
 * B3/S23 rules, toroidal grid. Sim decoupled from render loop.
 */
(function () {
  'use strict';
  try {

    const CELL         = 10;
    const INTERVAL_MS  = 120;
    const SEED_DENSITY = 0.35;
    const ENTROPY_GEN  = 300;
    const ENTROPY_RATE = 0.03;
    const MAX_DPR      = 2;

    const PALETTE = [
      [100, 200, 255],
      [180, 220, 255],
      [255, 255, 255],
    ];

    const GLIDER = [[0,-1],[1,0],[-1,1],[0,1],[1,1]];
    const BLINKER = [[-1,0],[0,0],[1,0]];
    const R_PENTOMINO = [[0,-1],[1,-1],[-1,0],[0,0],[0,1]];

    const PULSAR = [
      [-4,-6],[-3,-6],[-2,-6],[2,-6],[3,-6],[4,-6],
      [-6,-4],[-1,-4],[1,-4],[6,-4],[-6,-3],[-1,-3],[1,-3],[6,-3],
      [-6,-2],[-1,-2],[1,-2],[6,-2],[-4,-1],[-3,-1],[-2,-1],[2,-1],[3,-1],[4,-1],
      [-4,1],[-3,1],[-2,1],[2,1],[3,1],[4,1],
      [-6,2],[-1,2],[1,2],[6,2],[-6,3],[-1,3],[1,3],[6,3],
      [-6,4],[-1,4],[1,4],[6,4],[-4,6],[-3,6],[-2,6],[2,6],[3,6],[4,6],
    ];

    const PENTADECATHLON = [
      [0,-4],[0,-3],[-1,-2],[1,-2],[0,-1],[0,0],[0,1],[0,2],[-1,3],[1,3],[0,4],[0,5],
    ];

    const _GUN_RAW = [
      [0,4],[0,5],[1,4],[1,5],[10,4],[10,5],[10,6],[11,3],[11,7],[12,2],[12,8],
      [13,2],[13,8],[14,5],[15,3],[15,7],[16,4],[16,5],[16,6],[17,5],
      [20,2],[20,3],[20,4],[21,2],[21,3],[21,4],[22,1],[22,5],[24,0],[24,1],
      [24,5],[24,6],[34,2],[34,3],[35,2],[35,3],
    ];
    const _gc = Math.min(..._GUN_RAW.map(([c])=>c)), _gC = Math.max(..._GUN_RAW.map(([c])=>c));
    const _gr = Math.min(..._GUN_RAW.map(([,r])=>r)), _gR = Math.max(..._GUN_RAW.map(([,r])=>r));
    const GOSPER = _GUN_RAW.map(([c,r]) => [c-_gc-Math.floor((_gC-_gc)/2), r-_gr-Math.floor((_gR-_gr)/2)]);

    const CLICK_PATTERNS = [GOSPER, PULSAR, PENTADECATHLON, GLIDER];

    let canvas, ctx, hero;
    let cols = 0, rows = 0;
    let current, next, glyphs, colorClass;
    let generation = 0, lastRenderedGen = -1;
    let simInterval = null, rafId = null;
    let lastW = -1, lastH = -1;
    let heroInView = true, tabVisible = true;
    let reducedMotion = false, clickIdx = 0;

    function idx(c,r)  { return r*cols+c; }
    function wc(c)     { return ((c%cols)+cols)%cols; }
    function wr(r)     { return ((r%rows)+rows)%rows; }
    function isDark()  { return document.documentElement.getAttribute('data-theme') !== 'light'; }

    function initGrid(pCols, pRows, pGlyphs, pColors) {
      const size = cols*rows;
      current = new Uint8Array(size); next = new Uint8Array(size);
      glyphs  = new Uint8Array(size); colorClass = new Uint8Array(size);
      for (let r=0; r<rows; r++) {
        for (let c=0; c<cols; c++) {
          const i = idx(c,r);
          if (pGlyphs && c<pCols && r<pRows) {
            glyphs[i] = pGlyphs[r*pCols+c]; colorClass[i] = pColors[r*pCols+c];
          } else {
            glyphs[i] = Math.random()<0.5?1:0; colorClass[i] = Math.floor(Math.random()*3);
          }
          if (Math.random()<SEED_DENSITY) current[i]=1;
        }
      }
      stamp(GLIDER,      Math.floor(Math.random()*cols), Math.floor(Math.random()*rows));
      stamp(GLIDER,      Math.floor(Math.random()*cols), Math.floor(Math.random()*rows));
      stamp(BLINKER,     Math.floor(Math.random()*cols), Math.floor(Math.random()*rows));
      stamp(R_PENTOMINO, Math.floor(Math.random()*cols), Math.floor(Math.random()*rows));
    }

    function stamp(pat, cc, cr) {
      for (const [dc,dr] of pat) current[idx(wc(cc+dc), wr(cr+dr))] = 1;
    }

    function step() {
      for (let r=0; r<rows; r++) {
        const rU=wr(r-1), rD=wr(r+1);
        for (let c=0; c<cols; c++) {
          const cL=wc(c-1), cR=wc(c+1);
          const n = current[idx(cL,rU)]+current[idx(c,rU)]+current[idx(cR,rU)]
                  + current[idx(cL,r)]                    +current[idx(cR,r)]
                  + current[idx(cL,rD)]+current[idx(c,rD)]+current[idx(cR,rD)];
          const alive = current[idx(c,r)];
          next[idx(c,r)] = alive ? (n===2||n===3?1:0) : (n===3?1:0);
        }
      }
      const tmp=current; current=next; next=tmp;
      generation++;
      if (generation%ENTROPY_GEN===0) {
        for (let i=0,s=cols*rows; i<s; i++) if (Math.random()<ENTROPY_RATE) current[i]=1;
      }
    }

    function render() {
      rafId = requestAnimationFrame(render);
      if (lastRenderedGen===generation) return;
      lastRenderedGen = generation;

      const dark = isDark();
      // Light mode bg matches the creamy page background
      ctx.fillStyle = dark ? '#050d1a' : '#ede8df';
      ctx.fillRect(0, 0, lastW, lastH);

      ctx.font = "9px 'Geist Mono', monospace";
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';

      const now = Date.now();
      for (let r=0; r<rows; r++) {
        for (let c=0; c<cols; c++) {
          const i = idx(c,r);
          if (!current[i]) continue;
          const [R,G,B] = PALETTE[colorClass[i]];
          let alpha = 0.55 + Math.sin(now/800 + i*0.3)*0.15;
          alpha = Math.max(0, Math.min(1, alpha));
          let fR, fG, fB;
          if (!dark) {
            // Dark warm tones on cream — clearly visible
            fR = Math.floor(R * 0.18);
            fG = Math.floor(G * 0.22);
            fB = Math.floor(B * 0.45);
            alpha = Math.min(1, alpha * 1.4);
          } else {
            fR=R; fG=G; fB=B;
          }
          ctx.fillStyle = `rgba(${fR},${fG},${fB},${alpha.toFixed(3)})`;
          ctx.fillText(glyphs[i]?'1':'0', c*CELL+1, r*CELL+CELL*0.5);
        }
      }
    }

    function resize() {
      if (!hero||!canvas) return;
      const w=hero.clientWidth, h=hero.clientHeight;
      if (w===lastW&&h===lastH) return;
      const pCols=cols, pRows=rows, pGlyphs=glyphs, pColors=colorClass;
      lastW=w; lastH=h;
      const dpr=Math.min(window.devicePixelRatio||1, MAX_DPR);
      canvas.width=Math.round(w*dpr); canvas.height=Math.round(h*dpr);
      canvas.style.width=w+'px'; canvas.style.height=h+'px';
      ctx.setTransform(dpr,0,0,dpr,0,0);
      cols=Math.max(1,Math.floor(w/CELL)); rows=Math.max(1,Math.floor(h/CELL));
      initGrid(pCols,pRows,pGlyphs,pColors);
      generation=0; lastRenderedGen=-1;
      clearSim();
      if (!reducedMotion) {
        simInterval = setInterval(function(){ if(heroInView&&tabVisible) step(); }, INTERVAL_MS);
      }
    }

    function clearSim() { if(simInterval!==null){clearInterval(simInterval);simInterval=null;} }
    function clearRaf()  { if(rafId!==null){cancelAnimationFrame(rafId);rafId=null;} }

    function onVisibilityChange() {
      tabVisible = !document.hidden;
      if (!tabVisible) { clearRaf(); }
      else if (!reducedMotion&&rafId===null) { rafId=requestAnimationFrame(render); }
    }

    function setupIntersection() {
      if (!('IntersectionObserver' in window)) return;
      new IntersectionObserver(function(entries){
        heroInView = entries[0].isIntersecting;
        if (heroInView&&!reducedMotion&&rafId===null&&!document.hidden) rafId=requestAnimationFrame(render);
        else if (!heroInView) clearRaf();
      },{threshold:0.01}).observe(hero);
    }

    function onCanvasClick(e) {
      try {
        const rect=canvas.getBoundingClientRect();
        const src=e.touches?e.touches[0]:e;
        stamp(CLICK_PATTERNS[clickIdx%CLICK_PATTERNS.length],
              Math.floor((src.clientX-rect.left)/CELL),
              Math.floor((src.clientY-rect.top)/CELL));
        clickIdx++;
      } catch(_) {}
    }

    function initGoL(canvasId, heroId) {
      try {
        canvas = document.getElementById(canvasId);
        if (!canvas||!canvas.getContext) return;
        ctx  = canvas.getContext('2d');
        if (!ctx) return;
        hero = document.getElementById(heroId)||canvas.parentElement;
        reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        resize();
        if (reducedMotion) { step(); lastRenderedGen=-1; render(); clearRaf(); return; }
        rafId = requestAnimationFrame(render);
        window.addEventListener('resize', resize);
        document.addEventListener('visibilitychange', onVisibilityChange);
        setupIntersection();
        canvas.addEventListener('click', onCanvasClick);
        canvas.addEventListener('touchstart', onCanvasClick, {passive:true});
      } catch(_) {}
    }

    window.GoL = { initGoL: initGoL };

  } catch(_) {}
})();
