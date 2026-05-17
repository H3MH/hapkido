/*
  Fallback de animaciones.
  Si GSAP no carga desde el CDN, este shim mantiene el flujo funcional
  aplicando los estados finales sin romper la invitacion.
*/
(function setupGsapFallback(){
  if (typeof window.gsap !== 'undefined') return;

  console.warn('GSAP no disponible — usando fallback estatico.');

  const resolveTargets = (targets) => {
    if (!targets) return [];
    if (typeof targets === 'string') return document.querySelectorAll(targets);
    if (targets instanceof Element || targets === window || targets === document) return [targets];
    return typeof targets.length === 'number' ? targets : [targets];
  };

  const toCssLength = (value) => typeof value === 'string' ? value : value + 'px';

  const apply = (targets, props = {}) => {
    resolveTargets(targets).forEach(el => {
      if (!el || !el.style) return;

      if ('opacity' in props) el.style.opacity = props.opacity;
      if ('transformOrigin' in props) el.style.transformOrigin = props.transformOrigin;

      const hasTransform = ['x', 'y', 'scale', 'rotateX', 'rotation'].some(key => key in props);
      if (hasTransform) {
        const x = props.x !== undefined ? props.x : 0;
        const y = props.y !== undefined ? props.y : 0;
        const scale = props.scale !== undefined ? props.scale : 1;
        const rotateX = props.rotateX !== undefined ? props.rotateX : 0;
        const rotate = props.rotation !== undefined ? props.rotation : 0;
        el.style.transform = 'translate(' + toCssLength(x) + ', ' + toCssLength(y) + ') scale(' + scale + ') rotateX(' + rotateX + 'deg) rotate(' + rotate + 'deg)';
      }
    });
  };

  const finish = (props = {}) => {
    if (typeof props.onComplete === 'function') {
      const delay = ((props.delay || 0) + (props.duration || 0)) * 1000;
      window.setTimeout(props.onComplete, delay);
    }
    return { kill(){} };
  };

  window.gsap = {
    __fallback: true,
    to(targets, props){ apply(targets, props); return finish(props); },
    from(targets, props){ apply(targets, { opacity: 1, x: 0, y: 0, scale: 1 }); return finish(props); },
    fromTo(targets, _fromProps, toProps){ apply(targets, toProps); return finish(toProps); },
    timeline(opts = {}){
      const timeline = {
        to(){ return this; },
        from(){ return this; },
        fromTo(){ return this; }
      };
      window.setTimeout(() => opts.onComplete && opts.onComplete(), 50);
      return timeline;
    }
  };
})();
