import React, { useRef, useEffect } from 'react';

function animateCountUp(el, target, duration = 800) {
  if (typeof target !== 'number' || isNaN(target)) { el.textContent = target; return; }
  const start = parseInt(el.textContent) || 0;
  if (start === target) return;
  const startTime = performance.now();
  function tick(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(start + (target - start) * eased);
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function SpotlightCard({ icon, value, label, isNumber = true }) {
  const valRef = useRef(null);
  const cardRef = useRef(null);

  useEffect(() => {
    if (isNumber && valRef.current) animateCountUp(valRef.current, value);
  }, [value, isNumber]);

  const handleMouseMove = (e) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    card.style.setProperty('--mx', ((e.clientX - rect.left) / rect.width * 100) + '%');
    card.style.setProperty('--my', ((e.clientY - rect.top) / rect.height * 100) + '%');
  };

  return (
    <div className="card spotlight-card" ref={cardRef} onMouseMove={handleMouseMove}>
      <div className="card-icon">{icon}</div>
      <div className="card-value" ref={valRef}>{isNumber ? 0 : value}</div>
      <div className="card-label">{label}</div>
    </div>
  );
}

export default function StatsCards({ skillCount, todayCount, weekCount, topSkill, t }) {
  return (
    <div className="cards">
      <SpotlightCard icon="📦" value={skillCount} label={t('totalSkills')} />
      <SpotlightCard icon="📈" value={todayCount} label={t('today')} />
      <SpotlightCard icon="📅" value={weekCount} label={t('thisWeek')} />
      <SpotlightCard icon="🏆" value={topSkill} label={t('mostUsed')} isNumber={false} />
    </div>
  );
}
