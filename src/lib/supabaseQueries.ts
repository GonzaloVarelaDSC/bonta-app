import { supabase } from './supabaseClient';
import { mapJob } from './dbMappers';
import type { Job } from '../types';

// Un solo embed reutilizado para traer un trabajo completo (o todos) en una sola ida y vuelta.
export const JOB_SELECT = `
  *,
  job_assigned_users(user_id),
  job_stages(*),
  job_files(*, file_versions(*)),
  block_records(*),
  quality_checks(*),
  installations(*, installation_assigned_users(user_id))
`;

export async function fetchAllJobs(): Promise<Job[]> {
  const { data, error } = await supabase.from('jobs').select(JOB_SELECT).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapJob);
}

export async function fetchJobById(jobId: string): Promise<Job | null> {
  const { data, error } = await supabase.from('jobs').select(JOB_SELECT).eq('id', jobId).maybeSingle();
  if (error) throw error;
  return data ? mapJob(data) : null;
}
