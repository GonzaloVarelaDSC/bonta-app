import { useEffect, useRef, useState, type ReactNode } from 'react';
import clsx from 'clsx';

// Señal visual de que hay más contenido a la derecha para scrollear
// horizontalmente — sin esto, el borde del contenedor corta el contenido sin
// ningún aviso (Kanban y Tabla de trabajos en mobile, ver
// AUDITORIA_UXUI_2026-09-15.md, ítem #9). El degradé se apaga solo cuando el
// scroll ya llegó al final — no es una sombra fija que quede ahí siempre.
export function ScrollFadeX({
  className, wrapperClassName, fadeFrom = 'from-white', children,
}: {
  className?: string;
  wrapperClassName?: string;
  fadeFrom?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [showFade, setShowFade] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    function update() {
      if (!el) return;
      // 1px de margen: redondeo de subpíxel a veces deja scrollLeft+clientWidth
      // apenas por debajo de scrollWidth aunque visualmente ya se llegó al final.
      setShowFade(el.scrollWidth - el.clientWidth - el.scrollLeft > 1);
    }
    update();
    el.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      observer.disconnect();
    };
  }, []);

  return (
    <div className={clsx('relative min-w-0', wrapperClassName)}>
      <div ref={ref} className={className}>
        {children}
      </div>
      <div
        aria-hidden
        className={clsx(
          'pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l to-transparent transition-opacity duration-200',
          fadeFrom,
          showFade ? 'opacity-100' : 'opacity-0'
        )}
      />
    </div>
  );
}
