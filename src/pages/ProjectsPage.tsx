import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowUpRight, CalendarDays, FolderKanban, Plus, Search, SlidersHorizontal } from 'lucide-react';
import { Link } from 'react-router-dom';
import api, { getErrorMessage } from '../api';
import { useAuth } from '../auth';
import { useWorkspaceContext } from '../components/Shell';
import { Avatar, EmptyState, LoadingBlock, Modal, formatDate, titleCase } from '../components/ui';
import { useErrorToast } from '../useErrorToast';
import type { Project } from '../types';

export default function ProjectsPage() {
  const { organization, organizations, setOrganization } = useWorkspaceContext();
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useErrorToast(error);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');

  async function loadProjects() {
    if (!organization) return;
    setLoading(true);
    try {
      const { data } = await api.get('/projects');
      setProjects(data.projects as Project[]);
      setError('');
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadProjects(); }, [organization]);

  const selectedOrganizationId = organization?._id.toString();
  const getOrganizationId = (project: Project) =>
    typeof project.organization === 'string' ? project.organization : project.organization?._id;
  const visibleProjects = useMemo(() => projects.filter((project) =>
    getOrganizationId(project) === selectedOrganizationId &&
    (statusFilter === 'ALL' || project.status === statusFilter) &&
    `${project.name} ${project.description}`.toLowerCase().includes(search.toLowerCase())
  ), [projects, search, selectedOrganizationId, statusFilter]);
  const canCreateProject = Boolean(organization?.members.some((member) =>
    (member.user?.id === user?.id || member.user?._id === user?.id) &&
    ['OWNER', 'ADMIN'].includes(member.role)
  ));
  const projectInOtherOrganization = !visibleProjects.length && !search && statusFilter === 'ALL'
    ? projects.find((project) => getOrganizationId(project) !== selectedOrganizationId)
    : undefined;
  const otherOrganization = projectInOtherOrganization
    ? organizations.find((item) => item._id.toString() === getOrganizationId(projectInOtherOrganization))
    : undefined;

  if (!organization) return <div className="w-full max-w-[1280px] mx-auto"><EmptyState icon={<FolderKanban size={24} />} title="Create a workspace first" description="Projects are organized inside a workspace. Create one to get started." /></div>;

  return <div className="w-full max-w-[1280px] mx-auto">
    <div className="page-heading">
      <div><span className="eyebrow">MAKE IT HAPPEN</span><h1>Projects</h1><p>Keep your team moving in the same direction.</p></div>
      {canCreateProject && <button className="button button-primary" onClick={() => setShowCreate(true)}><Plus size={17} /> New project</button>}
    </div>
    <div className="project-toolbar">
      <div className="search-field"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search projects…" /></div>
      <div className="filter-select-wrap"><SlidersHorizontal size={15} /><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by project status"><option value="ALL">All statuses</option>{['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED'].map((status) => <option key={status} value={status}>{titleCase(status)}</option>)}</select></div>
      <span className="result-count">{visibleProjects.length} {visibleProjects.length === 1 ? 'project' : 'projects'}</span>
    </div>
    {loading ? <LoadingBlock label="Loading projects…" /> : visibleProjects.length ? <div className="project-card-grid">
      {visibleProjects.map((project, index) => <Link to={`/projects/${project._id}`} className="project-card" key={project._id}>
        <div className="project-card-top"><span className={`project-card-icon project-color-${index % 4}`}><FolderKanban size={18} /></span><span className={`project-status status-pill status-${project.status.toLowerCase()}`}>{titleCase(project.status)}</span><ArrowUpRight size={17} className="project-card-arrow" /></div>
        <h2>{project.name}</h2><p>{project.description || 'A new chapter for your team.'}</p>
        <div className="project-card-progress"><div className="project-progress-label"><span>Progress</span><strong>{project.progress || 0}%</strong></div><div className="progress-track"><span style={{ width: `${project.progress || 0}%` }} /></div></div>
        <div className="project-card-footer"><div className="avatar-stack">{project.members?.slice(0, 4).map((member) => <Avatar key={member._id || member.id} name={member.name} size="small" />)}{project.members?.length > 4 && <span className="avatar avatar-small more-avatar">+{project.members.length - 4}</span>}</div><span className="project-task-count">{project.taskCount || 0} tasks</span></div>
        <div className="project-card-due"><CalendarDays size={14} /> Due {formatDate(project.dueDate)}</div>
      </Link>)}
    </div> : <EmptyState
      icon={<FolderKanban size={23} />}
      title={search ? 'No projects match that search' : otherOrganization ? `Your project is in ${otherOrganization.name}` : canCreateProject ? 'A blank canvas, full of possibility' : 'No projects are assigned to you yet'}
      description={search ? 'Try another name or change the status filter.' : otherOrganization ? 'Switch to the workspace that contains your assigned project.' : canCreateProject ? 'Create your first project and bring your team along.' : 'Ask your workspace owner or admin to add you to a project.'}
      action={otherOrganization
        ? <button className="button button-primary" onClick={() => setOrganization(otherOrganization)}>Switch workspace</button>
        : !search && canCreateProject
          ? <button className="button button-primary" onClick={() => setShowCreate(true)}><Plus size={16} /> Create project</button>
          : undefined}
    />}
    {showCreate && canCreateProject && <CreateProjectDialog organizationId={organization._id} onClose={() => setShowCreate(false)} onCreated={(project) => { setProjects((current) => [project, ...current]); setShowCreate(false); }} />}
  </div>;
}

function CreateProjectDialog({ organizationId, onClose, onCreated }: { organizationId: string; onClose: () => void; onCreated: (project: Project) => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [dueDate, setDueDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useErrorToast(error);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { data } = await api.post('/projects', { organizationId, name, description, priority, dueDate: dueDate || undefined });
      onCreated({ ...data.project, organization: organizationId, members: [], taskCount: 0, progress: 0 });
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  }

  return <Modal title="Start a new project" eyebrow="A FRESH START" onClose={onClose}>
    <form className="dialog-form" onSubmit={submit}>
      <label className="field-label">Project name<input className="text-input" autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Website refresh" required maxLength={120} /></label>
      <label className="field-label">A little context <span className="optional-label">OPTIONAL</span><textarea className="text-input textarea" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What are you hoping to make happen?" maxLength={2000} /></label>
      <div className="form-two-columns"><label className="field-label">Priority<select className="text-input" value={priority} onChange={(event) => setPriority(event.target.value)}>{['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((item) => <option value={item} key={item}>{titleCase(item)}</option>)}</select></label><label className="field-label">Due date<span className="optional-label">OPTIONAL</span><input type="date" className="text-input" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label></div>
      <div className="dialog-actions"><button type="button" className="button button-quiet" onClick={onClose}>Cancel</button><button disabled={busy} className="button button-primary">{busy ? 'Creating…' : 'Create project'} <Plus size={15} /></button></div>
    </form>
  </Modal>;
}
