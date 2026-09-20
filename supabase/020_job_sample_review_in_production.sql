-- Suma un estado intermedio a Job.sampleReview, entre "Sin muestra" y "Enviada,
-- falta OK": 'in_production' — ya se emitió la OT para hacer la muestra, se está
-- fabricando, todavía no se le avisó al cliente. Ver CLAUDE.md §48.
alter table jobs drop constraint if exists jobs_sample_review_check;
alter table jobs add constraint jobs_sample_review_check
  check (sample_review in ('none', 'in_production', 'awaiting', 'approved'));
