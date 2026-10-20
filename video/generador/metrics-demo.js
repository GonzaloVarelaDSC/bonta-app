// Datos sintéticos + verificación de cálculos del módulo Métricas (19/10).
// Corre DENTRO de la página del dev server (no toca Supabase): llena el store con
// ~90 trabajos ficticios con historial generado, y compara lo que calcula
// src/lib/metrics.ts contra valores calculados acá por separado a partir de la
// "verdad" con la que se generaron los datos. Uso, desde la consola de la página:
//   eval(await (await import('/video/generador/metrics-demo.js?raw')).default)()
// Devuelve { ok, checks } y deja la app en /metricas con los datos ficticios.
async () => {
  const { useStore } = await import('/src/store/useStore.ts');
  const M = await import('/src/lib/metrics.ts');
  const DAY = 86400000;
  const now = new Date();
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  let seq = 1;
  const uid = () => `00000000-0000-4000-9000-${String(seq++).padStart(12, '0')}`;
  const iso = (ms) => new Date(ms).toISOString();
  const at18 = (ms) => { const d = new Date(ms); d.setHours(18, 0, 0, 0); return d.toISOString(); };

  const mk = (name, role, isProducer) => ({ id: uid(), name, email: `${name}@demo`, role, sector: '', avatarColor: '#a06f24', active: true, isProducer, creditsAsAssigner: true });
  const users = [mk('Gonzalo Varela', 'admin', true), mk('Gastón Benítez', 'coordinador', true), mk('Pancho Bonta', 'admin', false)];
  const clients = ['Café Molinari', 'Librería Atlas', 'Constructora del Plata', 'Óptica Visión', 'Hotel Soho', 'Farmacias del Norte', 'Vivero La Huerta', 'Estudio Ríos']
    .map((n) => ({ id: uid(), name: n, company: n, contacts: [], address: '', notes: '', tier: 'estandar' }));
  const types = ['impresion_v7000', 'corporeo', 'corte_laser', 'acrilico', 'vidrieras_stands'];
  const STAGE_STATUS = { pendiente: 'PENDIENTE', diseno: 'EN_DISENO', produccion: 'EN_PRODUCCION', control_calidad: 'EN_CONTROL_CALIDAD', listo: 'LISTO_PARA_ENTREGA', instalacion: 'EN_INSTALACION', terminado: 'TERMINADO' };

  const jobs = []; const events = []; const truth = []; const prices = {};
  const base = (o) => ({
    code: null, contactName: '', contactPhone: '', createdByUserId: users[2].id, assignedUserIds: [], assignedNames: [],
    requestedDate: o.committedDate, description: '', quantity: '', measurements: '', sizeItems: [], materialIds: [], products: [],
    technique: '', finish: '', color: '', observations: '', specialRequirements: '', priorityAuto: 'NORMAL', priorityManual: 'NORMAL',
    sampleReview: 'none', qualityChecks: [], files: [], blockRecords: [], clientImportant: false, productionConfig: { items: [] },
    lastActivityAt: o.createdAt, ...o,
  });

  for (let i = 0; i < 90; i++) {
    const id = uid();
    const created = now.getTime() - (2 + rnd() * 150) * DAY;
    const install = rnd() < 0.3;
    const path = ['pendiente', 'diseno', 'produccion', ...(rnd() < 0.5 ? ['control_calidad'] : []), 'listo', ...(install ? ['instalacion'] : []), 'terminado'];
    const type = types[i % types.length];
    const segs = []; let t = created; let status = 'PENDIENTE';
    for (let k = 0; k < path.length; k++) {
      const stage = path[k];
      if (stage === 'terminado') { segs.push({ stage, start: t, end: null }); status = 'TERMINADO'; break; }
      const dur = (stage === 'diseno' && type === 'corporeo' ? 3 : 0.3) + rnd() * 5;
      if (t + dur * DAY > now.getTime()) { segs.push({ stage, start: t, end: null }); status = STAGE_STATUS[stage]; break; }
      segs.push({ stage, start: t, end: t + dur * DAY }); t += dur * DAY;
    }
    const committed = at18(created + (3 + Math.floor(rnd() * 14)) * DAY);
    const finishedAt = status === 'TERMINADO' ? iso(segs[segs.length - 1].start) : undefined;
    const legacy = i % 3 === 0; // eventos viejos: sin from/to, solo el texto
    const dropEvent = !truth.some((x) => x.incomplete) && i % 3 !== 0 && segs.length > 3; // un historial con un hueco → incompleto
    events.push({ id: uid(), jobId: id, userId: users[2].id, action: 'crear', detail: 'Creó el trabajo.', from: null, to: null, at: iso(created) });
    for (let k = 1; k < segs.length; k++) {
      if (dropEvent && k === 2) continue;
      const to = STAGE_STATUS[segs[k].stage]; const from = STAGE_STATUS[segs[k - 1].stage];
      const viaInstall = segs[k].stage === 'terminado' && install && i % 2 === 0;
      events.push(viaInstall
        ? { id: uid(), jobId: id, userId: users[0].id, action: 'instalacion', detail: 'Registró la instalación como completada.', from: null, to: null, at: iso(segs[k].start) }
        : { id: uid(), jobId: id, userId: users[0].id, action: 'estado', detail: `Cambió el estado a ${to}.`, from: legacy ? null : from, to: legacy ? null : to, at: iso(segs[k].start) });
    }
    jobs.push(base({ id, name: `Trabajo ${i + 1}`, clientId: clients[Math.floor(rnd() * rnd() * clients.length)].id, responsibleUserId: users[i % 2].id, createdAt: iso(created), committedDate: committed, jobTypeId: type, status, finishedAt, requiresInstallation: install, priorityManual: ['CRITICO', 'URGENTE', 'NORMAL', 'PLANIFICADO'][i % 4] }));
    const price = finishedAt && i % 4 !== 0 ? 100000 + i * 1000 : null;
    if (price !== null) prices[id] = { jobId: id, amountNet: price, enteredAmount: price, enteredWithIva: false, ivaRate: 0.21, note: '', updatedBy: users[0].id, updatedAt: finishedAt };
    const resched = i % 5 === 0 ? [iso(created + DAY / 2)] : [];
    resched.forEach((at) => events.push({ id: uid(), jobId: id, userId: users[0].id, action: 'fecha', detail: 'Cambió la fecha de entrega comprometida.', from: null, to: null, at }));
    if (i % 7 === 0) jobs[jobs.length - 1].sampleReview = 'approved';
    truth.push({ id, created, committed, finishedAt, segs, incomplete: dropEvent, price, resched });
  }
  // Cancelado con fecha en el historial, cancelado sin evento, eliminado y uno con estado viejo BLOQUEADO.
  const extra = (o, evs) => { jobs.push(base({ id: o.id, name: o.name, clientId: clients[0].id, responsibleUserId: users[0].id, createdAt: o.createdAt, committedDate: at18(Date.parse(o.createdAt) + 5 * DAY), jobTypeId: 'otro', status: o.status, requiresInstallation: false, deletedAt: o.deletedAt })); events.push(...evs); };
  const c1 = uid(); extra({ id: c1, name: 'Cancelado con fecha', createdAt: iso(now - 20 * DAY), status: 'CANCELADO' }, [{ id: uid(), jobId: c1, userId: users[2].id, action: 'estado', detail: 'Cambió el estado a CANCELADO.', from: 'PENDIENTE', to: 'CANCELADO', at: iso(now - 10 * DAY) }]);
  const c2 = uid(); extra({ id: c2, name: 'Cancelado sin evento', createdAt: iso(now - 30 * DAY), status: 'CANCELADO' }, []);
  const d1 = uid(); extra({ id: d1, name: 'Eliminado', createdAt: iso(now - 5 * DAY), status: 'PENDIENTE', deletedAt: iso(now - 4 * DAY) }, []);
  const b1 = uid(); extra({ id: b1, name: 'Con BLOQUEADO viejo', createdAt: iso(now - 40 * DAY), status: 'EN_PRODUCCION' }, [{ id: uid(), jobId: b1, userId: users[0].id, action: 'estado', detail: 'Cambió el estado a BLOQUEADO.', from: null, to: null, at: iso(now - 35 * DAY) }]);

  // Trabajo con una vuelta para atrás (Control de calidad → Producción) que nació de un presupuesto.
  const r1 = uid(); const q1 = uid(); const rt = (d) => iso(now - d * DAY);
  jobs.push(base({ id: r1, name: 'Con retrabajo', clientId: clients[1].id, responsibleUserId: users[0].id, createdAt: rt(20), committedDate: at18(now - 10 * DAY), jobTypeId: 'acrilico', status: 'TERMINADO', finishedAt: rt(8), requiresInstallation: false, sourceQuoteId: q1 }));
  [['PENDIENTE', 'EN_PRODUCCION', 18], ['EN_PRODUCCION', 'EN_CONTROL_CALIDAD', 15], ['EN_CONTROL_CALIDAD', 'EN_PRODUCCION', 14], ['EN_PRODUCCION', 'LISTO_PARA_ENTREGA', 11], ['LISTO_PARA_ENTREGA', 'TERMINADO', 8]]
    .forEach(([a, b, d]) => events.push({ id: uid(), jobId: r1, userId: users[0].id, action: 'estado', detail: 'Cambió el estado a ' + b + '.', from: a, to: b, at: rt(d) }));
  events.push({ id: uid(), jobId: r1, userId: users[2].id, action: 'crear', detail: 'Creó el trabajo.', from: null, to: null, at: rt(20) });
  prices[r1] = { jobId: r1, amountNet: 110000, enteredAmount: 133100, enteredWithIva: true, ivaRate: 0.21, note: '', updatedBy: users[0].id, updatedAt: rt(8) };
  const quotes = [{ id: q1, code: 'PRE-2026-00099', clientId: clients[1].id, name: 'Con retrabajo', items: [], status: 'CONFIRMADO', price: 121000, priceIncludesIva: true, createdByUserId: users[0].id, createdAt: rt(25), lastActivityAt: rt(20), convertedJobId: r1 }];
  truth.push({ id: r1, created: now - 20 * DAY, committed: at18(now - 10 * DAY), finishedAt: rt(8), segs: [], incomplete: false, price: 110000, resched: [], rework: true });

  useStore.setState({
    jobPrices: prices, jobPricesLoaded: true, jobPricesError: null, loadJobPrices: async () => {},
    setJobPrice: async (jobId, { enteredAmount, withIva, note }) => useStore.setState((s) => ({ jobPrices: { ...s.jobPrices, [jobId]: { jobId, amountNet: withIva ? Math.round(enteredAmount / 1.21 * 100) / 100 : enteredAmount, enteredAmount, enteredWithIva: withIva, ivaRate: 0.21, note, updatedBy: users[0].id, updatedAt: new Date().toISOString() } } })),
    clearJobPrice: async (jobId) => useStore.setState((s) => { const n = { ...s.jobPrices }; delete n[jobId]; return { jobPrices: n }; }),
    currentUser: users[0], users, clients, jobs, quotes, quotesLoaded: true,
    metricsEvents: events, metricsLoadedAt: new Date().toISOString(), goals: [],
    loadMetrics: async () => {}, loadQuotes: async () => {},
    saveGoal: async (g) => useStore.setState((s) => ({ goals: [{ ...g, id: uid(), createdBy: users[0].id, createdAt: new Date().toISOString(), archivedAt: null }, ...s.goals] })),
    archiveGoal: async (id) => useStore.setState((s) => ({ goals: s.goals.map((g) => (g.id === id ? { ...g, archivedAt: new Date().toISOString() } : g)) })),
  });

  // ---------------- verificación independiente ----------------
  const end = new Date(now); end.setHours(0, 0, 0, 0); end.setTime(end.getTime() + DAY);
  const P = { from: new Date(end.getTime() - 90 * DAY), to: end };
  const inP = (ms) => ms !== undefined && ms >= P.from.getTime() && ms < P.to.getTime();
  const med = (xs) => { const s = [...xs].sort((a, b) => a - b); if (!s.length) return null; const m = (s.length - 1) / 2; return (s[Math.floor(m)] + s[Math.ceil(m)]) / 2; };
  const dayDiff = (a, b) => { const x = new Date(a); x.setHours(0, 0, 0, 0); const y = new Date(b); y.setHours(0, 0, 0, 0); return Math.round((x - y) / DAY); };

  const facts = M.buildFacts(useStore.getState().jobs, events, prices);
  const sum = M.summarize(facts, P, 'calendar');
  const delivered = truth.filter((x) => x.finishedAt && inP(Date.parse(x.finishedAt)));
  const exp = {
    factsExcludeDeleted: jobs.length - 1,
    created: truth.filter((x) => inP(x.created)).length + [c1, c2, b1].filter((id) => inP(Date.parse(jobs.find((j) => j.id === id).createdAt))).length,
    delivered: delivered.length,
    cancelled: 1,
    onTime: delivered.filter((x) => dayDiff(x.finishedAt, x.committed) <= 0).length,
    cycleMedian: med(delivered.map((x) => (Date.parse(x.finishedAt) - x.created) / DAY)),
    diseno: med(truth.filter((x) => !x.incomplete).flatMap((x) => x.segs.filter((s) => s.stage === 'diseno' && s.end && inP(s.end)).map((s) => (s.end - s.start) / DAY))),
    incomplete: truth.filter((x) => x.incomplete).length + 2, // + cancelado sin evento + BLOQUEADO viejo
    openNow: truth.filter((x) => !x.finishedAt).length + 1,
  };
  const st = M.stageStats(facts, P, 'calendar').find((s) => s.stage === 'diseno');
  const close = (a, b) => (a === null && b === null) || Math.abs(a - b) < 1e-6;
  const checks = [
    ['eliminados fuera', facts.length, exp.factsExcludeDeleted],
    ['ingresados', sum.created, exp.created],
    ['entregados', sum.delivered, exp.delivered],
    ['cancelados con fecha', sum.cancelled, exp.cancelled],
    ['entregas a tiempo (n)', Math.round((sum.onTimeRate.value ?? 0) * sum.onTimeRate.n / 100), exp.onTime],
    ['mediana ciclo', sum.cycleMedian.value, exp.cycleMedian],
    ['mediana diseño', st.median, exp.diseno],
    ['historial incompleto', facts.filter((f) => !f.historyComplete).length, exp.incomplete],
    ['abiertos hoy', M.snapshot(facts, 'calendar').open, exp.openNow],
    ['explorador = KPI entregados', M.applyFilters(facts, { ...M.EMPTY_FILTERS, dateField: 'delivered', state: 'delivered' }, P, () => '').length, exp.delivered],
    ['explorador = KPI tarde', M.applyFilters(facts, { ...M.EMPTY_FILTERS, dateField: 'delivered', state: 'delivered', deadline: 'late' }, P, () => '').length, exp.delivered - exp.onTime],
    ['días hábiles: lun→lun = 5', M.durationDays('2026-10-12T10:00:00', '2026-10-19T10:00:00', 'business'), 5],
    ['importe entregado', M.revenue(facts, P).total, delivered.reduce((a, x) => a + (x.price ?? 0), 0)],
    ['trabajos con importe', M.revenue(facts, P).withPrice, delivered.filter((x) => x.price !== null).length],
    ['reprogramaciones en el período', M.rescheduleStats(facts, P).events, truth.flatMap((x) => x.resched).filter((at) => inP(Date.parse(at))).length],
    ['vueltas para atrás', M.reworkStats(facts, P).moves, 1],
    ['presupuesto vs final +10%', M.quoteVsFinal(facts, quotes, P).rows[0]?.diffPct, 10],
    ['explorador sin importe', M.applyFilters(facts, { ...M.EMPTY_FILTERS, dateField: 'delivered', state: 'delivered', price: 'without' }, P, () => '').length, delivered.filter((x) => x.price === null).length],
    ['grupos de instalación suman el total', M.factorStats(facts, P, 'calendar').filter((r) => r.factor === 'Instalación').reduce((a, r) => a + r.n, 0), delivered.length],
    ['percentil 85 de 1..10', M.percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 85), 8.65],
  ].map(([name, got, want]) => ({ name, got, want, ok: typeof want === 'number' && typeof got === 'number' ? close(got, want) : got === want }));
  return { ok: checks.every((c) => c.ok), checks };
}
