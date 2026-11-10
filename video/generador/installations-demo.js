// Datos ficticios para probar el módulo Instalaciones sin tocar Supabase.
// Uso, desde la consola de la página (dev server):
//   await (eval(await (await import('/video/generador/demo-setup.js?raw')).default))();
//   await (eval(await (await import('/video/generador/installations-demo.js?raw')).default))();
// Programa 7 instalaciones alrededor de hoy (varias el mismo día, una de 3 días,
// una de 6, una reprogramada, una completada) y deja 2 OT "sin fecha".
// saveInstallation queda reemplazada por una versión local.
async () => {
  const { useStore } = await import('/src/store/useStore.ts');
  const s = useStore.getState();
  const pad = (n) => String(n).padStart(2, '0');
  const key = (offset) => { const d = new Date(); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const base = { contactName: 'Encargado', contactPhone: '1155550000', assignedUserIds: [], notes: 'Entrar por carga y descarga.', completed: false, locality: 'CABA', papersOk: false, rescheduled: false, installerNames: [] };
  const plans = [
    { date: key(0), endDate: key(0), time: '09:00', installerNames: ['Alejandro'], address: 'Av. Cabildo 2150' },
    { date: key(0), endDate: key(0), time: '14:00', installerNames: ['Martín'], address: 'Florida 520' },
    { date: key(0), endDate: key(2), time: '08:30', installerNames: ['Alejandro', 'Pancho'], address: 'Paraná 3745, Unicenter', papersOk: true },
    { date: key(1), endDate: key(1), time: '10:00', installerNames: ['Pancho'], address: 'Santa Fe 1860', rescheduled: true, rescheduledFrom: key(-2), rescheduledBy: s.currentUser.id, rescheduledAt: new Date().toISOString() },
    { date: key(-3), endDate: key(-3), time: '09:00', installerNames: ['Alejandro'], address: 'Corrientes 900', completed: true },
    { date: key(4), endDate: key(9), time: '07:00', installerNames: ['Martín'], address: 'La Rural, Palermo' },
    { date: key(0), endDate: key(0), time: '18:00', address: 'Libertador 4000' },
  ];
  const jobs = s.jobs.map((j, i) => {
    if (i < plans.length) return { ...j, requiresInstallation: true, status: 'EN_PRODUCCION', deletedAt: null, installation: { ...base, ...plans[i] } };
    if (i < plans.length + 2) return { ...j, requiresInstallation: true, installation: undefined, status: 'EN_PRODUCCION', deletedAt: null };
    return j;
  });
  const patch = (id, inst) => useStore.setState((st) => ({ jobs: st.jobs.map((j) => j.id === id ? { ...j, requiresInstallation: true, installation: inst } : j) }));
  useStore.setState({
    jobs,
    saveInstallation: async (id, input) => {
      const prev = useStore.getState().jobs.find((x) => x.id === id).installation;
      const re = !!prev?.date && !!input.date && (prev.date !== input.date || (prev.endDate ?? prev.date) !== input.endDate);
      patch(id, {
        ...(prev ?? base), ...input,
        date: input.date ?? undefined, endDate: input.endDate ?? undefined, time: input.time ?? undefined,
        ...(re ? { rescheduled: true, rescheduledFrom: prev.date, rescheduledBy: useStore.getState().currentUser.id, rescheduledAt: new Date().toISOString() } : {}),
      });
    },
    loadJobActivity: async () => {},
  });
  return jobs.slice(0, plans.length + 2).map((j) => j.code);
}
