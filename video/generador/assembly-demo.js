// Caso de prueba de "Composición y armado" (19/10, CLAUDE.md §75) — datos 100%
// ficticios, no toca Supabase. Desde la consola de la página del dev server:
//   eval(await (await import('/video/generador/assembly-demo.js?raw')).default)()
// Arma una OT con 3 corpóreos de polifan (2 piezas de polifan + 1 frente de PAI
// cada uno) y una OT vieja sin composición, reemplaza las acciones del store que
// guardan por versiones locales y corre comprobaciones de los cálculos.
async () => {
  const { useStore } = await import('/src/store/useStore.ts');
  const A = await import('/src/lib/assembly.ts');
  const P = await import('/src/lib/production.ts');
  const now = Date.now();
  const iso = (ms) => new Date(ms).toISOString();
  const me = { id: 'aaaaaaaa-0000-4000-8000-000000000001', name: 'Gonzalo Varela', email: 'g@demo', role: 'admin', sector: '', avatarColor: '#a06f24', active: true, isProducer: true, creditsAsAssigner: true };
  const client = { id: 'aaaaaaaa-0000-4000-8000-000000000002', name: 'Café Molinari', company: '', contacts: [], address: '', notes: '', tier: 'estandar' };
  const base = (o) => ({
    code: 'TRB-2026-01999', contactName: '', contactPhone: '', createdByUserId: me.id, responsibleUserId: me.id, assignedUserIds: [], assignedNames: [],
    clientId: client.id, createdAt: iso(now - 86400000), requestedDate: iso(now + 5 * 86400000), committedDate: iso(now + 5 * 86400000),
    jobTypeId: 'corporeo', description: '', quantity: '', measurements: '', sizeItems: [], materialIds: [], technique: '', finish: '', color: '',
    observations: '', specialRequirements: '', status: 'EN_PRODUCCION', priorityAuto: 'NORMAL', priorityManual: 'NORMAL', requiresInstallation: false,
    sampleReview: 'none', qualityChecks: [], files: [], blockRecords: [], lastActivityAt: iso(now), clientImportant: false, ...o,
  });
  const polifan = { id: 'p-polifan', label: 'Polifan 20 mm', materialIds: [], sizeItems: [{ quantity: '3', width: '34', height: '120' }, { quantity: '3', width: '45', height: '67' }], notes: 'Polifan 20 mm', checked: false };
  const pai = { id: 'p-pai', label: 'Frente PAI', materialIds: ['pai'], sizeItems: [{ quantity: '3', width: '45', height: '120' }], notes: 'PAI 1 mm', checked: true };
  const job = base({ id: 'aaaaaaaa-0000-4000-8000-0000000000j1', name: 'Corpóreos de polifan', products: [polifan, pai],
    productionConfig: { items: [{ id: 'job-p-polifan', source: 'job', productId: 'p-polifan', processes: ['aoke'], note: '' }, { id: 'job-p-pai', source: 'job', productId: 'p-pai', processes: ['impresion', 'corte_filo'], note: '' }], assemblies: [] } });
  const old = base({ id: 'aaaaaaaa-0000-4000-8000-0000000000j2', name: 'OT vieja sin composición', code: 'TRB-2026-01000', products: [{ ...polifan, id: 'p-old' }], productionConfig: { items: [] } });

  const patchJob = (id, fn) => useStore.setState((s) => ({ jobs: s.jobs.map((j) => (j.id === id ? { ...j, ...fn(j) } : j)) }));
  const log = [];
  useStore.setState({
    currentUser: me, users: [me], clients: [client], jobs: [job, old], quotes: [], quotesLoaded: true,
    loadJobComments: async () => {}, loadJobActivity: async () => {},
    saveProductionConfig: async (jobId, config) => { patchJob(jobId, () => ({ productionConfig: config })); log.push(['config', config]); },
    saveAssemblyProgress: async (jobId, assemblyId, progress, _by, detail) => {
      patchJob(jobId, (j) => ({ productionConfig: { ...j.productionConfig, assemblies: j.productionConfig.assemblies.map((a) => (a.id !== assemblyId ? a : { ...a, assembled: progress.assembled, components: a.components.map((c) => ({ ...c, ready: progress.ready[c.pieceKey] ?? c.ready })) })) } }));
      log.push(['progreso', detail]);
    },
  });
  window.__assemblyLog = log;

  // ------------- comprobaciones de cálculo -------------
  const rows = P.productionRows(job, job.productionConfig, []);
  const pieces = A.piecesFromRows(rows, new Set(['p-pai']));
  const [pA, pB, pC] = pieces;
  const asm = (ready, assembled, units = 3, perUnit = [1, 1, 1]) => ({ id: 'x', label: 'Corpóreo de polifan', units, assembled,
    components: [pA, pB, pC].map((p, i) => ({ pieceKey: p.key, perUnit: perUnit[i], ready: ready[i] })) });
  const s1 = A.assemblyStatus(asm([0, 0, 0], 0), pieces);
  const s2 = A.assemblyStatus(asm([3, 2, 3], 5), pieces);
  const s3 = A.assemblyStatus(asm([9, 9, 9], 9), pieces);
  const s4 = A.assemblyStatus({ ...asm([3, 3, 3], 0), components: [...asm([3, 3, 3], 0).components, { pieceKey: 'borrada#0', perUnit: 1, ready: 3 }] }, pieces);
  const mism = A.quantityMismatches([asm([0, 0, 0], 0, 3, [2, 1, 1])], pieces);
  const oldPieces = A.piecesFromRows(P.productionRows(old, old.productionConfig, []));
  const checks = [
    ['3 piezas con letras A, B, C', pieces.map((p) => p.ref).join(''), 'ABC'],
    ['A y B son el mismo producto con medidas distintas', [pA.size, pB.size].join(' | '), '34 × 120 | 45 × 67'],
    ['totales = por unidad × 3', s1.components.map((c) => c.total).join(','), '3,3,3'],
    ['sin piezas hechas no se puede armar ninguna', s1.buildable, 0],
    ['con A=3, B=2, C=3 alcanza para 2', s2.buildable, 2],
    ['armadas no pasa de lo que alcanza (pidió 5)', s2.assembled, 2],
    ['falta B para la unidad 3', s2.limitingRefs.join(','), 'B'],
    ['faltan 1 de B', s2.components[1].missing, 1],
    ['nunca más de las unidades pedidas', s3.assembled, 3],
    ['pieza borrada de la OT bloquea el armado', s4.buildable, 0],
    ['aviso si la composición no coincide con la OT', mism.map((m) => `${m.piece.ref}:${m.loaded}→${m.required}`).join(','), 'A:3→6'],
    ['tilde "procesado" de Detalle se ve como info', [pA.processedInOt, pC.processedInOt].join(','), 'false,true'],
    ['OT vieja: sin composición inventada', (old.productionConfig.assemblies ?? []).length + oldPieces.length * 0, 0],
  ].map(([name, got, want]) => ({ name, got, want, ok: got === want }));
  return { ok: checks.every((c) => c.ok), checks, jobId: job.id, oldId: old.id };
}
