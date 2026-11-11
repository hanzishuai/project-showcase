export interface Materials {
  projectFolders: number
  docx: number
  screenshots: number
}

export interface Meta {
  title: string
  subtitle: string
  source: string
  sourceNote: string
  materials: Materials
  stageFramework: string[]
  stageNote: string
  missingValue: string
}

export interface Developer {
  name: string
  role: string
}

export interface ProjectSummary {
  id: string
  name: string
  summary: string
  stage_label: string
  stage_note: string
  status: string | null
  progress: number | null
  updated_at: string | null
  docx_count: number
  docx_name: string | null
  shot_count: number
  cover: string | null
  stage_done: number
  developers: Developer[]
  advisor: string | null
}

export interface StageItem {
  seq: number
  name: string
  state: 'missing' | 'active' | 'done'
  note: string
}

export interface Shot {
  id: number
  file_name: string
  caption: string
  note: string
  width: number | null
  height: number | null
  url: string
}

export interface SourceFile {
  id: number
  path: string
  kind: string
  file_name: string
}

export interface ProjectDetail extends ProjectSummary {
  content: string
  data_note: string
  source_files: SourceFile[]
  screenshots: Shot[]
  stages: StageItem[]
}

export interface Stats {
  total: number
  docx: number
  screenshots: number
  developers: number
  advisors: number
  stage_done: number
  stage_total: number
  per_project: ProjectSummary[]
}

const BASE = import.meta.env.VITE_API_BASE ?? ''

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(BASE + path)
  if (!response.ok) throw new Error(path + ' -> ' + response.status)
  return (await response.json()) as T
}


export async function updateStage(
  projectId: string,
  seq: number,
  state: 'missing' | 'active' | 'done',
  note = ''
): Promise<ProjectDetail> {
  const response = await fetch(
    BASE + '/api/projects/' + encodeURIComponent(projectId) + '/stages/' + seq,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state, note })
    }
  )
  if (!response.ok) throw new Error('PUT stage ' + seq + ' -> ' + response.status)
  return (await response.json()) as ProjectDetail
}

export const api = {
  meta: () => getJson<Meta>('/api/meta'),
  stats: () => getJson<Stats>('/api/stats'),
  projects: () => getJson<ProjectSummary[]>('/api/projects'),
  project: (id: string) => getJson<ProjectDetail>('/api/projects/' + encodeURIComponent(id))
}