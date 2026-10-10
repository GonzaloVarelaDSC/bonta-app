// Corre DENTRO de la página (page.evaluate). Llena el store de Zustand con datos
// ficticios y reemplaza las acciones que tocan Supabase por versiones locales,
// así el video muestra la app real sin leer ni escribir nada en la base.
async () => {
  const { useStore } = await import('/src/store/useStore.ts');
  const { QC_TEMPLATE } = await import('/src/data/catalog.ts');

  const DAY = 86400000;
  const now = Date.now();
  const iso = (ms) => new Date(ms).toISOString();
  const atSix = (days) => { const d = new Date(now + days * DAY); d.setHours(18, 0, 0, 0); return d.toISOString(); };
  let seq = 1;
  const uid = () => `00000000-0000-4000-8000-${String(seq++).padStart(12, '0')}`;

  const U = {
    gonzalo: { id: uid(), name: 'Gonzalo Varela', email: 'gonzalo@demo', role: 'admin', sector: 'Diseño / Producción', avatarColor: '#a06f24', active: true, isProducer: true, creditsAsAssigner: true },
    gaston: { id: uid(), name: 'Gastón Benítez', email: 'gaston@demo', role: 'coordinador', sector: 'Diseño', avatarColor: '#2563eb', active: true, isProducer: true, creditsAsAssigner: true },
    pancho: { id: uid(), name: 'Pancho Bonta', email: 'pancho@demo', role: 'admin', sector: 'Dirección', avatarColor: '#7c3aed', active: true, isProducer: false, creditsAsAssigner: true },
    martin: { id: uid(), name: 'Martín Bonta', email: 'martin@demo', role: 'admin', sector: 'Dirección', avatarColor: '#0f766e', active: true, isProducer: false, creditsAsAssigner: true },
    alejandra: { id: uid(), name: 'Alejandra', email: 'alejandra@demo', role: 'coordinador', sector: 'Coordinación', avatarColor: '#db2777', active: true, isProducer: false, creditsAsAssigner: true },
    richard: { id: uid(), name: 'Richard', email: 'richard@demo', role: 'coordinador', sector: 'Coordinación', avatarColor: '#ea580c', active: true, isProducer: false, creditsAsAssigner: true },
    nancy: { id: uid(), name: 'Nancy', email: 'nancy@demo', role: 'coordinador', sector: 'Coordinación', avatarColor: '#4f46e5', active: true, isProducer: false, creditsAsAssigner: true },
  };
  const users = Object.values(U);

  const client = (name, contact, phone) => ({ id: uid(), name, company: name, contacts: [{ name: contact, phone, email: '' }], address: '', notes: '', tier: 'estandar' });
  const C = {
    molinari: client('Café Molinari', 'Laura', '11 5555-0101'),
    atlas: client('Librería Atlas', 'Diego', '11 5555-0102'),
    plata: client('Constructora del Plata', 'Sofía', '11 5555-0103'),
    vision: client('Óptica Visión', 'Marcelo', '11 5555-0104'),
    soho: client('Hotel Palermo Soho', 'Valeria', '11 5555-0105'),
    norte: client('Farmacias del Norte', 'Julián', '11 5555-0106'),
    verde: client('Vivero La Huerta', 'Carla', '11 5555-0107'),
    estudio: client('Estudio Contable Ríos', 'Andrés', '11 5555-0108'),
  };
  const clients = Object.values(C);

  const qc = (n) => QC_TEMPLATE.map((q, i) => ({ ...q, checked: i < n }));
  const prod = (label, materialIds, q, w, h, notes = '', checked = false, outsourced = false) =>
    ({ id: uid(), label, materialIds, sizeItems: [{ quantity: q, width: w, height: h }], notes, checked, outsourced });

  const job = (o) => ({
    id: uid(), code: null, contactName: '', contactPhone: '', createdByUserId: U.alejandra.id,
    responsibleUserId: U.gonzalo.id, assignedUserIds: [], assignedNames: [],
    createdAt: iso(now - 2 * DAY), requestedDate: atSix(5), committedDate: atSix(5),
    jobTypeId: 'impresion_v7000', description: '', quantity: '', measurements: '', sizeItems: [], materialIds: [],
    products: [], technique: '', finish: '', color: '', observations: '', specialRequirements: '',
    status: 'PENDIENTE', priorityAuto: 'NORMAL', priorityManual: 'NORMAL', requiresInstallation: false,
    sampleReview: 'none', qualityChecks: qc(0), files: [], blockRecords: [],
    lastActivityAt: iso(now - 3 * 3600000), clientImportant: false, ...o,
  });

  const J = {
    vidriera: job({
      code: 'TRB-2026-01482', name: 'Vidriera de primavera', clientId: C.molinari.id, contactName: 'Laura', contactPhone: '1155550101',
      jobTypeId: 'vidrieras_stands', status: 'EN_DISENO', priorityManual: 'URGENTE', committedDate: atSix(2),
      description: 'Vinilos de corte para la vidriera principal + cartel colgante en acrílico.',
      createdByUserId: U.pancho.id, assignedNames: ['Ares'],
      products: [
        prod('Vinilo de corte vidriera', ['vinilo'], '1', '240', '180', 'Vinilo blanco mate, aplicado del lado de adentro', true),
        prod('Cartel colgante', ['acrilico'], '1', '80', '40', 'Acrílico 5mm cristal, impresión bajo acrílico'),
      ],
      qualityChecks: qc(3), sampleReview: 'awaiting', sampleReviewAt: iso(now - DAY),
      files: [{ id: uid(), logicalName: 'Diseño vidriera', kind: 'diseno', versions: [
        { id: uid(), version: 1, fileName: 'vidriera_v1.pdf', sizeKb: 2350, uploadedBy: U.gonzalo.id, uploadedAt: iso(now - DAY), approved: false },
        { id: uid(), version: 2, fileName: 'vidriera_v2.pdf', sizeKb: 2410, uploadedBy: U.gonzalo.id, uploadedAt: iso(now - 4 * 3600000), approved: true },
      ] }],
    }),
    corporeo: job({
      code: 'TRB-2026-01475', name: 'Letras corpóreas fachada', clientId: C.vision.id, contactName: 'Marcelo', contactPhone: '1155550104',
      jobTypeId: 'corporeo', status: 'EN_PRODUCCION', priorityManual: 'CRITICO', committedDate: atSix(1),
      description: 'Logo corpóreo para la fachada, con iluminación LED.', createdByUserId: U.richard.id,
      requiresInstallation: true,
      installation: { address: 'Av. Cabildo 2150, CABA', contactName: 'Marcelo', contactPhone: '1155550104', assignedUserIds: [], notes: '', completed: false },
      products: [prod('Corpóreo 3D', ['acrilico', 'pvc'], '1', '180', '45', 'PVC 19mm + frente acrílico opal'), prod('Plantilla de vinilo de corte', ['vinilo'], '1', '180', '45')],
      qualityChecks: qc(5),
    }),
    catalogo: job({
      code: 'TRB-2026-01490', name: 'Exhibidores de mostrador', clientId: C.atlas.id, contactName: 'Diego',
      jobTypeId: 'corte_laser', status: 'PENDIENTE', priorityManual: 'NORMAL', committedDate: atSix(6),
      description: '12 exhibidores de mostrador en MDF cortado a láser.', createdByUserId: U.nancy.id, responsibleUserId: U.gaston.id,
      products: [prod('Exhibidor', ['mdf'], '12', '30', '20', 'MDF 5mm, encastre')], createdAt: iso(now - 3 * 3600000),
    }),
    lona: job({
      code: 'TRB-2026-01466', name: 'Lona para obra', clientId: C.plata.id, contactName: 'Sofía', contactPhone: '1155550103',
      jobTypeId: 'impresion_s40', status: 'LISTO_PARA_ENTREGA', priorityManual: 'NORMAL', committedDate: atSix(1),
      description: 'Lona frontlight con ojales para cerco de obra.', createdByUserId: U.alejandra.id,
      products: [prod('Lona frontlight', ['tela'], '2', '600', '200', 'Con ojales cada 50 cm', true)], qualityChecks: qc(10), readyAt: iso(now - 5 * 3600000),
    }),
    hotel: job({
      code: 'TRB-2026-01458', name: 'Señalética de habitaciones', clientId: C.soho.id, contactName: 'Valeria',
      jobTypeId: 'acrilico', status: 'EN_PRODUCCION', priorityManual: 'URGENTE', committedDate: atSix(3),
      description: '40 placas de número de habitación.', createdByUserId: U.martin.id, responsibleUserId: U.gaston.id,
      products: [prod('Placa de habitación', ['acrilico'], '40', '15', '15', 'Acrílico 3mm negro + vinilo dorado', false, true)],
      blockRecords: [{ id: uid(), reason: 'falta_material', description: 'Esperando acrílico negro 3mm del proveedor', openedBy: U.gaston.id, openedAt: iso(now - 20 * 3600000) }],
    }),
    farmacia: job({
      code: 'TRB-2026-01471', name: 'Cartel luminoso cruz verde', clientId: C.norte.id, contactName: 'Julián',
      jobTypeId: 'corte_cnc', status: 'EN_CONTROL_CALIDAD', priorityManual: 'URGENTE', committedDate: atSix(2),
      description: 'Cruz de farmacia en acrílico verde con LED.', createdByUserId: U.richard.id,
      products: [prod('Cruz luminosa', ['acrilico'], '2', '60', '60', 'Acrílico verde 5mm', true)], qualityChecks: qc(7),
    }),
    vivero: job({
      code: null, name: 'Carteles de precios', clientId: C.verde.id, contactName: 'Carla',
      jobTypeId: 'impresion_p9000', status: 'PENDIENTE', priorityManual: 'PLANIFICADO', committedDate: atSix(12),
      description: '50 carteles de precio para plantas.', createdByUserId: U.alejandra.id,
      products: [prod('Cartel de precio', ['pvc'], '50', '10', '7', 'PVC 1mm impreso')], sampleReview: 'in_production', sampleReviewAt: iso(now - 3 * 3600000),
    }),
    contable: job({
      code: 'TRB-2026-01440', name: 'Placa de bronce recepción', clientId: C.estudio.id, contactName: 'Andrés',
      jobTypeId: 'otro', status: 'EN_INSTALACION', priorityManual: 'NORMAL', committedDate: atSix(0),
      description: 'Placa institucional para la recepción.', createdByUserId: U.pancho.id, responsibleUserId: U.gaston.id,
      requiresInstallation: true,
      installation: { address: 'Florida 520, piso 4', contactName: 'Andrés', contactPhone: '1155550108', assignedUserIds: [], notes: '', completed: false },
      products: [prod('Placa', ['metal'], '1', '40', '30', '', true)], qualityChecks: qc(10),
    }),
    entregado: job({
      code: 'TRB-2026-01421', name: 'Menú retroiluminado', clientId: C.molinari.id, contactName: 'Laura',
      jobTypeId: 'impresion_v7000', status: 'TERMINADO', priorityManual: 'NORMAL', committedDate: atSix(-1),
      finishedAt: iso(now - DAY), description: 'Menú backlight para la barra.', products: [prod('Menú backlight', ['papel'], '1', '100', '70', '', true)], qualityChecks: qc(10),
    }),
    viejo: job({
      code: 'TRB-2026-01380', name: 'Banners para evento', clientId: C.norte.id, status: 'TERMINADO', committedDate: atSix(-12),
      finishedAt: iso(now - 10 * DAY), description: 'Roll-ups para congreso.',
    }),
    borrado: job({
      code: null, name: 'Folletería (duplicado)', clientId: C.atlas.id, status: 'PENDIENTE', committedDate: atSix(4),
      deletedAt: iso(now - 2 * DAY), deletedBy: U.alejandra.id, description: 'Cargado dos veces por error.',
    }),
  };
  const jobs = Object.values(J);

  const comments = [
    { id: uid(), jobId: J.vidriera.id, userId: U.pancho.id, text: 'Laura pidió que el cartel colgante tenga el logo más grande.', mentions: [], createdAt: iso(now - 5 * 3600000) },
    { id: uid(), jobId: J.vidriera.id, userId: U.gonzalo.id, text: 'Listo, ya está en la v2 del diseño. Falta que apruebe la muestra.', mentions: [], createdAt: iso(now - 4 * 3600000) },
  ];
  const activityLog = [
    { id: uid(), jobId: J.vidriera.id, userId: U.pancho.id, action: 'crear', detail: 'Creó el trabajo — Vidriera de primavera.', createdAt: iso(now - 2 * DAY) },
    { id: uid(), jobId: J.vidriera.id, userId: U.gonzalo.id, action: 'estado', detail: 'Cambió el estado a EN_DISENO.', createdAt: iso(now - DAY) },
    { id: uid(), jobId: J.vidriera.id, userId: U.gonzalo.id, action: 'archivo', detail: 'Subió vidriera_v2.pdf.', createdAt: iso(now - 4 * 3600000) },
    { id: uid(), jobId: J.vidriera.id, userId: U.gonzalo.id, action: 'muestra', detail: 'Marcó la muestra: enviada, falta OK.', createdAt: iso(now - DAY) },
  ];
  const notifications = [
    { id: uid(), userId: U.gonzalo.id, jobId: J.corporeo.id, text: 'Te asignaron el trabajo "Letras corpóreas fachada".', read: false, createdAt: iso(now - 40 * 60000) },
    { id: uid(), userId: U.gonzalo.id, jobId: J.vidriera.id, text: 'Te mencionaron en un comentario — Vidriera de primavera.', read: false, createdAt: iso(now - 2 * 3600000) },
    { id: uid(), userId: U.gonzalo.id, jobId: J.lona.id, text: 'Lona para obra pasó a LISTO_PARA_ENTREGA.', read: true, createdAt: iso(now - 5 * 3600000) },
  ];

  const quote = (o) => ({ id: uid(), createdByUserId: U.alejandra.id, createdAt: iso(now - DAY), lastActivityAt: iso(now - DAY), convertedJobId: null, priceIncludesIva: null, price: null, ...o });
  const Q = {
    stand: quote({ code: 'PRE-2026-00031', clientId: C.soho.id, name: 'Stand para feria de turismo', status: 'ENVIADO', price: 1850000, priceIncludesIva: false,
      items: [
        { id: uid(), label: 'Estructura de stand 3x3', unit: 'unidad', materialIds: ['madera', 'mdf'], sizeItems: [{ quantity: '1', width: '300', height: '250' }], notes: 'Con mostrador y depósito' },
        { id: uid(), label: 'Gráfica de fondo', unit: 'm²', materialIds: ['tela'], sizeItems: [{ quantity: '1', width: '300', height: '250' }], notes: 'Tela sublimada con tensado' },
      ] }),
    menues: quote({ code: 'PRE-2026-00034', clientId: C.molinari.id, name: 'Menúes de mesa', status: 'BORRADOR',
      items: [{ id: uid(), label: 'Menú de mesa', unit: 'unidad', materialIds: ['acrilico'], sizeItems: [{ quantity: '30', width: '15', height: '21' }], notes: 'Acrílico 3mm con base' }] }),
    rechazado: quote({ code: 'PRE-2026-00027', clientId: C.norte.id, name: 'Ploteo de vehículo', status: 'RECHAZADO', price: 420000, priceIncludesIva: true, items: [] }),
  };
  const quotes = Object.values(Q);

  const set = useStore.setState;
  const get = useStore.getState;
  const patchJob = (id, fn) => set((s) => ({ jobs: s.jobs.map((j) => (j.id === id ? { ...j, ...fn(j), lastActivityAt: new Date().toISOString() } : j)) }));
  const log = (jobId, action, detail) => set((s) => ({ activityLog: [{ id: uid(), jobId, userId: get().currentUser.id, action, detail, createdAt: new Date().toISOString() }, ...s.activityLog] }));
  const pause = (ms) => new Promise((r) => setTimeout(r, ms));

  set({
    authReady: true, dataLoading: false, loadError: null,
    currentUser: U.gonzalo, users, clients, jobs, comments, activityLog, notifications, quotes, quotesLoaded: true,
    toast: null, statusFlags: [],

    refreshAll: async () => {},
    loadJobComments: async () => {},
    loadJobActivity: async () => {},
    loadQuotes: async () => {},
    markNotificationRead: async (id) => set((s) => ({ notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) })),
    markAllNotificationsRead: async () => set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),
    findOrCreateClient: async (name) => {
      const found = get().clients.find((c) => c.name.toLowerCase() === name.trim().toLowerCase());
      if (found) return found.id;
      const c = client(name.trim(), '', '');
      set((s) => ({ clients: [...s.clients, c] }));
      return c.id;
    },
    createJob: async (input) => {
      await pause(400);
      const j = job({
        name: input.name, clientId: input.clientId, contactName: input.contactName, contactPhone: input.contactPhone,
        createdByUserId: input.createdByUserId, responsibleUserId: input.responsibleUserId, assignedNames: input.assignedNames,
        committedDate: input.committedDate, requestedDate: input.committedDate, jobTypeId: input.jobTypeId, description: input.description,
        products: input.products, specialRequirements: input.specialRequirements, priorityManual: input.priorityManual,
        requiresInstallation: input.requiresInstallation, createdAt: new Date().toISOString(), qualityChecks: qc(0),
      });
      set((s) => ({ jobs: [j, ...s.jobs] }));
      log(j.id, 'crear', `Creó el trabajo — ${j.name}.`);
      return j;
    },
    setStatus: async (jobId, status) => {
      patchJob(jobId, () => ({ status, ...(['LISTO_PARA_ENTREGA', 'LISTO_PARA_INSTALACION'].includes(status) ? { readyAt: new Date().toISOString() } : {}), ...(status === 'TERMINADO' ? { finishedAt: new Date().toISOString() } : {}) }));
      log(jobId, 'estado', `Cambió el estado a ${status}.`);
    },
    setPriority: async (jobId, priority) => { patchJob(jobId, () => ({ priorityManual: priority })); log(jobId, 'prioridad', `Cambió la prioridad a ${priority}.`); },
    setSampleReview: async (jobId, state) => { patchJob(jobId, () => ({ sampleReview: state, sampleReviewAt: new Date().toISOString() })); log(jobId, 'muestra', 'Actualizó la muestra al cliente.'); },
    setJobCode: async (jobId, code) => patchJob(jobId, () => ({ code })),
    updateCommittedDate: async (jobId, committedDate) => patchJob(jobId, () => ({ committedDate })),
    updateJobSpecs: async (jobId, specs) => { patchJob(jobId, () => specs); log(jobId, 'detalle', 'Actualizó el detalle del trabajo.'); },
    toggleProductChecked: async (jobId, productId) => patchJob(jobId, (j) => ({ products: j.products.map((p) => (p.id === productId ? { ...p, checked: !p.checked } : p)) })),
    toggleQualityCheck: async (jobId, key) => patchJob(jobId, (j) => ({ qualityChecks: j.qualityChecks.map((q) => (q.key === key ? { ...q, checked: !q.checked } : q)) })),
    addComment: async (jobId, userId, text, mentions) => {
      set((s) => ({ comments: [...s.comments, { id: uid(), jobId, userId, text, mentions, createdAt: new Date().toISOString() }] }));
      log(jobId, 'comentario', 'Comentó.');
    },
    blockJob: async (jobId, reason, description) => {
      patchJob(jobId, (j) => ({ blockRecords: [...j.blockRecords, { id: uid(), reason, description, openedBy: get().currentUser.id, openedAt: new Date().toISOString() }] }));
      log(jobId, 'bloqueo', `Bloqueó el trabajo: ${description}`);
    },
    unblockJob: async (jobId) => patchJob(jobId, (j) => ({ blockRecords: j.blockRecords.map((b) => (b.closedAt ? b : { ...b, closedAt: new Date().toISOString() })) })),
    completeInstallation: async (jobId, notes) => patchJob(jobId, (j) => ({ status: 'TERMINADO', finishedAt: new Date().toISOString(), installation: { ...j.installation, completed: true, completedNotes: notes } })),
    deleteJob: async (jobId) => patchJob(jobId, () => ({ deletedAt: new Date().toISOString(), deletedBy: get().currentUser.id })),
    restoreJob: async (jobId) => patchJob(jobId, () => ({ deletedAt: undefined, deletedBy: null })),
    setQuoteStatus: async (id, status) => set((s) => ({ quotes: s.quotes.map((q) => (q.id === id ? { ...q, status } : q)) })),
    setQuoteValue: async (id, price, priceIncludesIva) => set((s) => ({ quotes: s.quotes.map((q) => (q.id === id ? { ...q, price, priceIncludesIva } : q)) })),
    updateQuote: async (id, patch) => set((s) => ({ quotes: s.quotes.map((q) => (q.id === id ? { ...q, ...patch } : q)) })),
    confirmQuote: async (quoteId, extra) => {
      await pause(400);
      const q = get().quotes.find((x) => x.id === quoteId);
      const j = job({
        name: q.name, clientId: q.clientId, jobTypeId: extra.jobTypeId, committedDate: `${extra.committedDate}T18:00:00`,
        responsibleUserId: extra.responsibleUserId, createdByUserId: get().currentUser.id, createdAt: new Date().toISOString(),
        description: q.items.map((i) => i.label).join(' + '), sourceQuoteId: q.id,
        products: q.items.map((i) => ({ id: uid(), label: i.label, materialIds: i.materialIds, sizeItems: i.sizeItems, notes: `Unidad: ${i.unit}\n${i.notes}`, checked: false })),
      });
      set((s) => ({ jobs: [j, ...s.jobs], quotes: s.quotes.map((x) => (x.id === quoteId ? { ...x, status: 'CONFIRMADO', convertedJobId: j.id } : x)) }));
      return j;
    },
  });

  // Ayudas para el guion (las usa record.mjs).
  window.__demo = {
    ids: { jobs: Object.fromEntries(Object.entries(J).map(([k, v]) => [k, v.id])), quotes: Object.fromEntries(Object.entries(Q).map(([k, v]) => [k, v.id])) },
    flag: (jobKey, from, to, userName) => set((s) => ({ statusFlags: [{ id: uid(), jobId: J[jobKey].id, jobName: J[jobKey].name, from, to, userName, at: new Date().toISOString() }, ...s.statusFlags] })),
    notify: (jobKey, text) => set((s) => ({ notifications: [{ id: uid(), userId: U.gonzalo.id, jobId: J[jobKey].id, text, read: false, createdAt: new Date().toISOString() }, ...s.notifications], toast: text })),
    clear: () => set({ toast: null, statusFlags: [] }),
  };
  return true;
}
