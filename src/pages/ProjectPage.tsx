import { useEffect, useMemo, useRef, useState, type DragEvent, type FormEvent } from 'react';
import { Activity, Archive, ArrowLeft, ArrowRight, CalendarDays, Check, Circle, Clock3, Filter, GripVertical, ListTodo, MessageCircle, MoreHorizontal, Plus, Search, Send, Settings2, SlidersHorizontal, Trash2, UsersRound, X } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api, { getErrorMessage } from '../api';
import { useAuth } from '../auth';
import { useWorkspaceContext } from '../components/Shell';
import { Avatar, EmptyState, LoadingBlock, Modal, formatDate, titleCase } from '../components/ui';
import { useErrorToast } from '../useErrorToast';
import type { Activity as ActivityItem, Comment, Project, Task } from '../types';

const columns: { status: Task['status']; title: string; tint: string }[] = [
  { status: 'TODO', title: 'To do', tint: 'slate' },
  { status: 'IN_PROGRESS', title: 'In progress', tint: 'blue' },
  { status: 'IN_REVIEW', title: 'In review', tint: 'amber' },
  { status: 'COMPLETED', title: 'Completed', tint: 'green' }
];

interface TaskPagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

const TASK_PAGE_SIZE = 50;

export default function ProjectPage() {
  const { projectId = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { organization } = useWorkspaceContext();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskPagination, setTaskPagination] = useState<TaskPagination | null>(null);
  const [taskPage, setTaskPage] = useState(1);
  const [taskLoading, setTaskLoading] = useState(false);
  const [taskReload, setTaskReload] = useState(0);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useErrorToast(error);
  const [tab, setTab] = useState<'board' | 'activity'>('board');
  const [query, setQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('ALL');
  const [assigneeFilter, setAssigneeFilter] = useState('ALL');
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<Task['status'] | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [memberOpen, setMemberOpen] = useState(false);
  const [editProjectOpen, setEditProjectOpen] = useState(false);
  const taskFetchSequence = useRef(0);

  async function loadProject() {
    setLoading(true);
    setProject(null);
    try {
      const [projectResult, activityResult] = await Promise.all([
        api.get(`/projects/${projectId}`),
        api.get(`/projects/${projectId}/activity`)
      ]);
      setProject(projectResult.data.project as Project);
      setActivity(activityResult.data.activity as ActivityItem[]);
      setError('');
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setTaskPage(1);
    setTasks([]);
    setTaskPagination(null);
    loadProject();
  }, [projectId]);
  useEffect(() => {
    if (!project) return;
    const requestSequence = ++taskFetchSequence.current;
    const timeout = window.setTimeout(() => {
      setTaskLoading(true);
      api.get(`/projects/${projectId}/tasks`, { params: {
        page: taskPage,
        limit: TASK_PAGE_SIZE,
        search: query,
        priority: priorityFilter === 'ALL' ? undefined : priorityFilter,
        assignee: assigneeFilter === 'ALL' ? undefined : assigneeFilter
      } })
        .then(({ data }) => {
          if (requestSequence !== taskFetchSequence.current) return;
          setTasks(data.tasks as Task[]);
          setTaskPagination(data.pagination as TaskPagination);
          setError('');
        })
        .catch((requestError: unknown) => {
          if (requestSequence === taskFetchSequence.current) setError(getErrorMessage(requestError));
        })
        .finally(() => {
          if (requestSequence === taskFetchSequence.current) setTaskLoading(false);
        });
    }, query ? 250 : 0);
    return () => window.clearTimeout(timeout);
  }, [query, priorityFilter, assigneeFilter, projectId, project, taskPage, taskReload]);

  const isManager = Boolean(project && organization && (
    project.owner === user?.id || (typeof project.owner === 'object' && (project.owner.id === user?.id || project.owner._id === user?.id)) ||
    project.managers?.includes(user?.id || '') ||
    organization.members.some((member) => (member.user?.id === user?.id || member.user?._id === user?.id) && ['OWNER', 'ADMIN'].includes(member.role))
  ));

  const memberIds = useMemo(() => new Set(
    project?.members?.map((member) => member.id || member._id).filter((id): id is string => Boolean(id)) || []
  ), [project]);
  async function changeStatus(task: Task, status: Task['status']) {
    if (taskLoading) return false;
    if (task.status === status) return true;
    const previousStatus = task.status;
    taskFetchSequence.current += 1;
    setTaskLoading(false);
    setTasks((current) => current.map((item) => item._id === task._id ? { ...item, status } : item));
    setSelectedTask((current) => current?._id === task._id ? { ...current, status } : current);
    setUpdatingTaskId(task._id);
    try {
      const { data } = await api.patch(`/tasks/${task._id}/status`, { status });
      setTasks((current) => current.map((item) => item._id === task._id ? data.task as Task : item));
      setSelectedTask((current) => current?._id === task._id ? data.task as Task : current);
      api.get(`/projects/${projectId}/activity`)
        .then(({ data: activityResult }) => setActivity(activityResult.activity as ActivityItem[]))
        .catch((requestError: unknown) => setError(getErrorMessage(requestError)));
      return true;
    } catch (requestError) {
      setTasks((current) => current.map((item) => item._id === task._id ? { ...item, status: previousStatus } : item));
      setSelectedTask((current) => current?._id === task._id ? { ...current, status: previousStatus } : current);
      setError(getErrorMessage(requestError));
      return false;
    } finally {
      setUpdatingTaskId(null);
    }
  }

  function canChangeTaskStatus(task: Task) {
    const isAssignedToUser = task.assignee?.id === user?.id || task.assignee?._id === user?.id;
    return isManager || isAssignedToUser;
  }

  function startTaskDrag(event: DragEvent<HTMLElement>, task: Task) {
    if (!canChangeTaskStatus(task) || updatingTaskId || taskLoading) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', task._id);
    setDraggedTaskId(task._id);
  }

  function allowTaskDrop(event: DragEvent<HTMLElement>, status: Task['status']) {
    if (!draggedTaskId || updatingTaskId || taskLoading) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDragOverStatus(status);
  }

  function dropTask(event: DragEvent<HTMLElement>, status: Task['status']) {
    event.preventDefault();
    const taskId = event.dataTransfer.getData('text/plain') || draggedTaskId;
    const task = tasks.find((item) => item._id === taskId);
    setDraggedTaskId(null);
    setDragOverStatus(null);
    if (task && task.status !== status && canChangeTaskStatus(task) && !updatingTaskId && !taskLoading) {
      void changeStatus(task, status);
    }
  }

  async function archiveProject() {
    if (!window.confirm(`Archive "${project?.name}"? Its history will be kept, but it will no longer appear as an active project.`)) return;
    try {
      await api.delete(`/projects/${projectId}`);
      navigate('/projects');
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  }

  if (loading) return <div className="w-full max-w-[1280px] mx-auto"><LoadingBlock label="Opening project…" /></div>;
  if (!project) return <div className="w-full max-w-[1280px] mx-auto"><EmptyState icon={<Circle size={22} />} title="Project not found" description="This project may have been archived or you may not have access." action={<Link to="/projects" className="button button-secondary"><ArrowLeft size={15} /> Back to projects</Link>} /></div>;

  return <div className="w-full max-w-[1280px] mx-auto project-page">
    <div className="project-back-row"><Link to="/projects" className="back-link"><ArrowLeft size={15} /> Projects</Link><span className="breadcrumb-slash">/</span><span>{project.name}</span></div>
    <div className="project-detail-heading">
      <div className="project-detail-title"><div className="project-detail-icon"><ListTodo size={20} /></div><div><div className="project-title-line"><h1>{project.name}</h1><span className={`project-status status-pill status-${project.status.toLowerCase()}`}>{titleCase(project.status)}</span></div><p>{project.description || 'A shared space for your next great piece of work.'}</p></div></div>
      <div className="project-detail-actions">{project.members?.length > 0 && <div className="avatar-stack project-people">{project.members.slice(0, 4).map((member) => <Avatar name={member.name} size="small" key={member._id || member.id} />)}</div>}{isManager && <><button className="button button-secondary" onClick={() => setMemberOpen(true)}><UsersRound size={16} /> Members</button><button className="button button-secondary project-edit-button" onClick={() => setEditProjectOpen(true)}><Settings2 size={15} /> Edit</button><button className="icon-button archive-button" aria-label="Archive project" title="Archive project" onClick={archiveProject}><Archive size={16} /></button><button className="button button-primary" onClick={() => setCreateOpen(true)}><Plus size={16} /> Add task</button></>}</div>
    </div>
    <div className="project-meta-row"><span><ListTodo size={15} /> {tasks.length} tasks in view</span><span><CalendarDays size={15} /> Due {formatDate(project.dueDate)}</span><span><Clock3 size={15} /> {titleCase(project.priority)} priority</span></div>
    <div className="project-tabs"><button onClick={() => setTab('board')} className={tab === 'board' ? 'selected' : ''}><LayoutBoardIcon /> Board <span>{taskPagination?.total ?? tasks.length}</span></button><button onClick={() => setTab('activity')} className={tab === 'activity' ? 'selected' : ''}><Activity size={16} /> Activity</button><div className="project-tabs-spacer" /><div className="board-filter"><Search size={15} /><input aria-label="Search tasks" placeholder="Find a task…" value={query} onChange={(event) => { setQuery(event.target.value); setTaskPage(1); }} /></div><div className="board-filter-select"><Filter size={14} /><select aria-label="Filter task priority" value={priorityFilter} onChange={(event) => { setPriorityFilter(event.target.value); setTaskPage(1); }}><option value="ALL">All priorities</option>{['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((item) => <option value={item} key={item}>{titleCase(item)}</option>)}</select></div><div className="board-filter-select"><UsersRound size={14} /><select aria-label="Filter task assignee" value={assigneeFilter} onChange={(event) => { setAssigneeFilter(event.target.value); setTaskPage(1); }}><option value="ALL">Anyone</option><option value="me">Assigned to me</option></select></div></div>
    {tab === 'board' && taskPagination && taskPagination.pages > 1 && <nav className="task-pagination" aria-label="Task pages">
      <span aria-live="polite">Showing {(taskPage - 1) * taskPagination.limit + 1}–{Math.min(taskPage * taskPagination.limit, taskPagination.total)} of {taskPagination.total} tasks</span>
      <div>
        <button className="button button-secondary" disabled={taskPage <= 1 || taskLoading} onClick={() => setTaskPage((current) => current - 1)}><ArrowLeft size={14} /> Previous</button>
        <span>Page {taskPage} of {taskPagination.pages}</span>
        <button className="button button-secondary" disabled={taskPage >= taskPagination.pages || taskLoading} onClick={() => setTaskPage((current) => current + 1)}>Next <ArrowRight size={14} /></button>
      </div>
    </nav>}
    {tab === 'board' && taskLoading && <div className="task-loading" role="status"><span className="spinner" /> Loading tasks…</div>}
    {tab === 'board' ? <div className="kanban-board" aria-busy={taskLoading}>{columns.map((column) => {
      const items = tasks.filter((task) => task.status === column.status);
      return <section
        className={`kanban-column${dragOverStatus === column.status ? ' kanban-column-drop-target' : ''}`}
        key={column.status}
        onDragOver={(event) => allowTaskDrop(event, column.status)}
        onDragLeave={(event) => {
          if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) {
            setDragOverStatus((current) => current === column.status ? null : current);
          }
        }}
        onDrop={(event) => dropTask(event, column.status)}
      >
        <header className="kanban-column-header"><span className={`status-dot ${column.tint}`} /><h2>{column.title}</h2><span className="column-count">{items.length}</span>{isManager && column.status === 'TODO' && <button className="icon-button column-add" aria-label="Add task" onClick={() => setCreateOpen(true)}><Plus size={16} /></button>}</header>
        <div className="kanban-cards">{items.map((task) => {
          const isAssignedToUser = task.assignee?.id === user?.id || task.assignee?._id === user?.id;
          return <TaskCard
            task={task}
            key={task._id}
            canChangeStatus={isManager || isAssignedToUser}
            changingStatus={Boolean(updatingTaskId) || taskLoading}
            onStatusChange={(status) => changeStatus(task, status)}
            onClick={() => setSelectedTask(task)}
            draggable={canChangeTaskStatus(task) && !updatingTaskId && !taskLoading}
            dragging={draggedTaskId === task._id}
            onDragStart={(event) => startTaskDrag(event, task)}
            onDragEnd={() => {
              setDraggedTaskId(null);
              setDragOverStatus(null);
            }}
          />;
        })}
          {isManager && column.status === 'TODO' && <button className="add-task-inline" onClick={() => setCreateOpen(true)}><Plus size={15} /> Add task</button>}
          {!items.length && column.status !== 'TODO' && <div className="column-empty">Nothing here yet</div>}
        </div>
      </section>;
    })}</div> : <div className="panel project-activity-panel"><div className="panel-heading"><div><span className="eyebrow">PROJECT HISTORY</span><h2>Recent activity</h2></div></div>{activity.length ? <div className="activity-list">{activity.map((item) => <div className="activity-item" key={item._id}><Avatar name={item.actor?.name} size="small" /><div className="activity-text"><strong>{item.actor?.name || 'A teammate'}</strong><span>{item.detail}</span><small>{new Date(item.createdAt).toLocaleString()}</small></div></div>)}</div> : <EmptyState icon={<Activity size={22} />} title="The story starts here" description="Project updates will appear here as your team works." />}</div>}
    {createOpen && isManager && <CreateTaskDialog projectId={projectId} members={project.members || []} onClose={() => setCreateOpen(false)} onCreated={() => { setTaskReload((current) => current + 1); setCreateOpen(false); }} />}
    {editProjectOpen && <EditProjectDialog project={project} onClose={() => setEditProjectOpen(false)} onUpdated={(updated) => { setProject(updated); setEditProjectOpen(false); }} />}
    {selectedTask && <TaskDetailsDialog task={selectedTask} members={project.members || []} isManager={isManager} onClose={() => setSelectedTask(null)} onStatus={changeStatus} onUpdate={(next) => { setTasks((current) => current.map((task) => task._id === next._id ? next : task)); setSelectedTask(next); }} onDelete={(id) => { setTasks((current) => current.filter((task) => task._id !== id)); setTaskPagination((current) => current ? { ...current, total: Math.max(0, current.total - 1), pages: Math.ceil(Math.max(0, current.total - 1) / current.limit) } : current); if (tasks.length === 1 && taskPage > 1) setTaskPage((current) => current - 1); setSelectedTask(null); }} />}
    {memberOpen && organization && <ProjectMembersDialog project={project} members={organization.members} currentMemberIds={memberIds} onClose={() => setMemberOpen(false)} onUpdated={(updated, close = true) => { setProject(updated); if (close) setMemberOpen(false); }} />}
  </div>;
}

function LayoutBoardIcon() {
  return <SlidersHorizontal size={15} className="board-layout-icon" />;
}

function EditProjectDialog({ project, onClose, onUpdated }: { project: Project; onClose: () => void; onUpdated: (project: Project) => void }) {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description || '');
  const [status, setStatus] = useState(project.status);
  const [priority, setPriority] = useState(project.priority);
  const [dueDate, setDueDate] = useState(project.dueDate?.slice(0, 10) || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useErrorToast(error);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.put(`/projects/${project._id}`, { name, description, status, priority, dueDate: dueDate || null });
      onUpdated(data.project as Project);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  }
  return <Modal title="Project settings" eyebrow="KEEP THINGS ON TRACK" onClose={onClose}>
    <form className="dialog-form" onSubmit={submit}>
      <label className="field-label">Project name<input className="text-input" value={name} onChange={(event) => setName(event.target.value)} required maxLength={120} /></label>
      <label className="field-label">Description<textarea className="text-input textarea" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} /></label>
      <div className="form-two-columns"><label className="field-label">Status<select className="text-input" value={status} onChange={(event) => setStatus(event.target.value)}>{['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED'].map((value) => <option key={value}>{value}</option>)}</select></label><label className="field-label">Priority<select className="text-input" value={priority} onChange={(event) => setPriority(event.target.value)}>{['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((value) => <option key={value}>{value}</option>)}</select></label></div>
      <label className="field-label">Due date<input className="text-input" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label>
      <div className="dialog-actions"><button type="button" className="button button-quiet" onClick={onClose}>Cancel</button><button className="button button-primary" disabled={busy}>{busy ? 'Saving…' : 'Save project'} <Check size={15} /></button></div>
    </form>
  </Modal>;
}

function TaskCard({ task, canChangeStatus, changingStatus, onStatusChange, onClick, draggable, dragging, onDragStart, onDragEnd }: {
  task: Task;
  canChangeStatus: boolean;
  changingStatus: boolean;
  onStatusChange: (status: Task['status']) => Promise<boolean>;
  onClick: () => void;
  draggable: boolean;
  dragging: boolean;
  onDragStart: (event: DragEvent<HTMLElement>) => void;
  onDragEnd: () => void;
}) {
  return <article
    className={`task-card${draggable ? ' task-card-draggable' : ''}${dragging ? ' task-card-dragging' : ''}`}
    draggable={draggable}
    onDragStart={onDragStart}
    onDragEnd={onDragEnd}
  >
    <button className="task-card-main" type="button" disabled={changingStatus} onClick={onClick} aria-label={`Open task: ${task.title}`}>
      <div className="task-card-top"><GripVertical size={14} className="task-drag-grip" aria-hidden="true" /><span className={`priority-mark priority-${task.priority.toLowerCase()}`} /> <span className="task-priority">{titleCase(task.priority)}</span><MoreHorizontal size={16} className="task-more" /></div>
      <h3>{task.title}</h3>{task.description && <p className="task-description">{task.description}</p>}
      {!!task.labels?.length && <div className="task-labels">{task.labels.slice(0, 2).map((label) => <span key={label}>{label}</span>)}</div>}
    </button>
    <div className="task-card-footer">
      <span className={task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'COMPLETED' ? 'task-due overdue' : 'task-due'}><CalendarDays size={13} />{formatDate(task.dueDate)}</span>
      <span className="task-card-social"><MessageCircle size={14} /></span>
      {task.assignee && <Avatar name={task.assignee.name} size="small" />}
      <label className="task-card-status-label">
        <span className="sr-only">Move {task.title} to another status</span>
        <select
          className="task-card-status"
          aria-label={`Move ${task.title} to another status`}
          value={task.status}
          disabled={!canChangeStatus || changingStatus}
          onChange={(event) => { void onStatusChange(event.target.value as Task['status']); }}
        >
          {columns.map((column) => <option value={column.status} key={column.status}>{column.title}</option>)}
        </select>
      </label>
    </div>
  </article>;
}

function CreateTaskDialog({ projectId, members, onClose, onCreated }: { projectId: string; members: Project['members']; onClose: () => void; onCreated: (task: Task) => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [assignee, setAssignee] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [labels, setLabels] = useState('');
  const [error, setError] = useState('');
  useErrorToast(error);
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post(`/projects/${projectId}/tasks`, { title, description, priority, assignee: assignee || undefined, dueDate: dueDate || undefined, labels: labels.split(',').map((label) => label.trim()).filter(Boolean) });
      onCreated(data.task as Task);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  }
  return <Modal title="Add a task" eyebrow="KEEP THE MOMENTUM" onClose={onClose}>
    <form className="dialog-form" onSubmit={submit}>
      <label className="field-label">Task title<input className="text-input" autoFocus placeholder="What needs to get done?" value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={160} /></label>
      <label className="field-label">Description <span className="optional-label">OPTIONAL</span><textarea className="text-input textarea" placeholder="Add a little more context…" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={4000} /></label>
      <div className="form-two-columns"><label className="field-label">Priority<select className="text-input" value={priority} onChange={(event) => setPriority(event.target.value)}>{['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((item) => <option key={item}>{item}</option>)}</select></label><label className="field-label">Assignee<select className="text-input" value={assignee} onChange={(event) => setAssignee(event.target.value)}><option value="">Unassigned</option>{members.map((member) => <option value={member._id || member.id} key={member._id || member.id}>{member.name}</option>)}</select></label></div>
      <div className="form-two-columns"><label className="field-label">Due date <span className="optional-label">OPTIONAL</span><input className="text-input" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label><label className="field-label">Labels <span className="optional-label">OPTIONAL</span><input className="text-input" placeholder="design, launch" value={labels} onChange={(event) => setLabels(event.target.value)} /></label></div>
      <div className="dialog-actions"><button type="button" className="button button-quiet" onClick={onClose}>Cancel</button><button className="button button-primary" disabled={busy}>{busy ? 'Adding…' : 'Add task'} <Plus size={15} /></button></div>
    </form>
  </Modal>;
}

function TaskDetailsDialog({ task, members, isManager, onClose, onStatus, onUpdate, onDelete }: {
  task: Task; members: Project['members']; isManager: boolean; onClose: () => void;
  onStatus: (task: Task, status: Task['status']) => Promise<boolean>;
  onUpdate: (task: Task) => void; onDelete: (id: string) => void;
}) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [status, setStatus] = useState(task.status);
  const [assignee, setAssignee] = useState(task.assignee?.id || task.assignee?._id || '');
  const [priority, setPriority] = useState(task.priority);
  const [dueDate, setDueDate] = useState(task.dueDate?.slice(0, 10) || '');
  const [labels, setLabels] = useState(task.labels?.join(', ') || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useErrorToast(error);
  const [editMode, setEditMode] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState('');
  const [editingCommentText, setEditingCommentText] = useState('');
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    api.get(`/tasks/${task._id}/comments`).then(({ data }) => setComments(data.comments as Comment[])).catch((requestError: unknown) => setError(getErrorMessage(requestError)));
  }, [task._id]);

  async function postComment(event: FormEvent) {
    event.preventDefault();
    if (!commentText.trim()) return;
    try {
      const { data } = await api.post(`/tasks/${task._id}/comments`, { text: commentText });
      setComments((current) => [...current, data.comment as Comment]);
      setCommentText('');
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  }

  async function saveTask() {
    setSaving(true);
    try {
      const { data } = await api.put(`/tasks/${task._id}`, {
        title, description, priority, dueDate: dueDate || null,
        labels: labels.split(',').map((label) => label.trim()).filter(Boolean),
        assignee: assignee || null
      });
      onUpdate(data.task as Task);
      setEditMode(false);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  async function deleteTask() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    try {
      await api.delete(`/tasks/${task._id}`);
      onDelete(task._id);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  }

  async function deleteComment(comment: Comment) {
    try {
      await api.delete(`/comments/${comment._id}`);
      setComments((current) => current.filter((item) => item._id !== comment._id));
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  }

  async function saveComment(commentId: string) {
    try {
      const { data } = await api.put(`/comments/${commentId}`, { text: editingCommentText });
      setComments((current) => current.map((item) => item._id === commentId ? data.comment as Comment : item));
      setEditingCommentId('');
      setEditingCommentText('');
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  }

  return <Modal title={editMode ? 'Edit task' : 'Task details'} eyebrow={editMode ? 'MAKE A CHANGE' : 'A CLOSER LOOK'} wide onClose={onClose}>
    <div className="task-detail-layout">
      <div className="task-detail-main">
        {editMode ? <><input className="task-edit-title" value={title} onChange={(event) => setTitle(event.target.value)} /><textarea className="text-input textarea task-edit-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Add a description" /></> : <><h3 className="task-detail-title">{task.title}</h3><p className="task-detail-description">{task.description || 'No description has been added yet.'}</p></>}
        {!!task.labels?.length && !editMode && <div className="task-labels detail-labels">{task.labels.map((label) => <span key={label}>{label}</span>)}</div>}
        {editMode && <label className="field-label task-edit-labels">Labels <span className="optional-label">OPTIONAL · COMMA SEPARATED</span><input className="text-input" value={labels} onChange={(event) => setLabels(event.target.value)} placeholder="design, launch" /></label>}
        <section className="comments-section"><div className="comments-heading"><h3>Conversation</h3><span>{comments.length}</span></div>
          <div className="comments-list">{comments.length ? comments.map((comment) => {
            const canEdit = comment.author?.id === user?.id || comment.author?._id === user?.id;
            return <div className="comment-item" key={comment._id}><Avatar name={comment.author?.name} size="small" /><div className="comment-content"><div className="comment-author"><strong>{comment.author?.name}</strong><time>{new Date(comment.createdAt).toLocaleDateString()}</time>{canEdit && editingCommentId !== comment._id && <button className="comment-edit" onClick={() => { setEditingCommentId(comment._id); setEditingCommentText(comment.text); }}>Edit</button>}{(canEdit || isManager) && <button className="comment-delete" onClick={() => deleteComment(comment)} aria-label="Delete comment"><X size={13} /></button>}</div>{editingCommentId === comment._id ? <div className="comment-edit-form"><textarea className="text-input" value={editingCommentText} onChange={(event) => setEditingCommentText(event.target.value)} maxLength={2000} /><button className="button button-primary" disabled={!editingCommentText.trim()} onClick={() => saveComment(comment._id)}>Save</button><button className="button button-quiet" onClick={() => setEditingCommentId('')}>Cancel</button></div> : <p>{comment.text}</p>}</div></div>;
          }) : <div className="comments-empty">No comments yet. Start the conversation.</div>}</div>
          <form className="comment-form" onSubmit={postComment}><Avatar name={user?.name} size="small" /><input value={commentText} onChange={(event) => setCommentText(event.target.value)} placeholder="Write a thoughtful comment…" maxLength={2000} /><button className="send-comment" aria-label="Send comment" disabled={!commentText.trim()}><Send size={16} /></button></form>
        </section>
      </div>
      <aside className="task-detail-sidebar">
        <label className="field-label">Status<select className="text-input" value={status} disabled={!isManager && task.assignee?.id !== user?.id && task.assignee?._id !== user?.id} onChange={async (event) => { const next = event.target.value as Task['status']; const saved = await onStatus(task, next); setStatus(saved ? next : task.status); }}>{columns.map((column) => <option value={column.status} key={column.status}>{column.title}</option>)}</select></label>
        <div className="detail-info-row"><span>Priority</span>{editMode ? <select className="detail-assignee" value={priority} onChange={(event) => setPriority(event.target.value as Task['priority'])}>{['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((item) => <option value={item} key={item}>{titleCase(item)}</option>)}</select> : <span className={`detail-priority priority-${task.priority.toLowerCase()}`}><i />{titleCase(task.priority)}</span>}</div>
        <div className="detail-info-row"><span>Assignee</span>{isManager ? <select className="detail-assignee" value={assignee} onChange={async (event) => {
          setAssignee(event.target.value);
          try { const { data } = await api.patch(`/tasks/${task._id}/assignee`, { assignee: event.target.value || null }); onUpdate(data.task as Task); }
          catch (requestError) { setError(getErrorMessage(requestError)); }
        }}><option value="">Unassigned</option>{members.map((member) => <option value={member.id || member._id} key={member.id || member._id}>{member.name}</option>)}</select> : <span className="detail-value">{task.assignee?.name || 'Unassigned'}</span>}</div>
        <div className="detail-info-row"><span>Due date</span>{editMode ? <input className="detail-date-input" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /> : <span className="detail-value">{formatDate(task.dueDate)}</span>}</div>
        <div className="detail-info-row"><span>Created by</span><span className="detail-value">{task.reporter?.name || 'A teammate'}</span></div>
        <div className="detail-side-actions">{editMode ? <><button className="button button-primary button-full" onClick={saveTask} disabled={saving}>{saving ? 'Saving…' : 'Save changes'} <Check size={15} /></button><button className="button button-quiet button-full" onClick={() => setEditMode(false)}>Cancel</button></> : isManager && <button className="button button-secondary button-full" onClick={() => setEditMode(true)}><Settings2 size={15} /> Edit task</button>}
          {isManager && <button className={`button ${confirmDelete ? 'button-danger' : 'button-quiet'} button-full`} onClick={deleteTask}>{confirmDelete ? 'Confirm delete task' : 'Delete task'}</button>}
        </div>
      </aside>
    </div>
  </Modal>;
}

function ProjectMembersDialog({ project, members, currentMemberIds, onClose, onUpdated }: {
  project: Project; members: { user: { _id?: string; id?: string; name: string; email: string }; role: string }[];
  currentMemberIds: Set<string>; onClose: () => void; onUpdated: (project: Project, close?: boolean) => void;
}) {
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedRole, setSelectedRole] = useState<'MANAGER' | 'MEMBER'>('MEMBER');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useErrorToast(error);
  const available = members.filter((member) => !currentMemberIds.has(member.user?.id || member.user?._id || ''));
  async function addMember() {
    setBusy(true);
    try {
      const { data } = await api.post(`/projects/${project._id}/members`, { userId: selectedUser, role: selectedRole });
      onUpdated(data.project as Project);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  }
  return <Modal title="Project members" eyebrow="BETTER TOGETHER" onClose={onClose}>
    <div className="dialog-form"><p className="dialog-intro">Choose from people already in your organization and assign their project access.</p>{project.members.map((member) => {
      const memberId = member.id || member._id || '';
      const isOwner = typeof project.owner === 'object' ? (project.owner.id || project.owner._id) === memberId : project.owner === memberId;
      const role = project.managers?.includes(memberId) || isOwner ? 'MANAGER' : 'MEMBER';
      return <div className="member-row" key={memberId}><Avatar name={member.name} size="small" /><div className="member-copy"><strong>{member.name}</strong><span>{member.email}</span></div>{isOwner ? <span className="member-role-pill">Project owner</span> : <select aria-label={`Project role for ${member.name}`} className="role-select" value={role} onChange={async (event) => {
        try {
          const { data } = await api.patch(`/projects/${project._id}/members/${memberId}`, { role: event.target.value });
          onUpdated(data.project as Project, false);
        } catch (requestError) { setError(getErrorMessage(requestError)); }
      }}><option value="MANAGER">Manager</option><option value="MEMBER">Member</option></select>}{!isOwner && <button className="icon-button remove-member" aria-label={`Remove ${member.name}`} title="Remove member" onClick={async () => {
        if (!window.confirm(`Remove ${member.name} from this project? Their assigned tasks will be unassigned.`)) return;
        try {
          await api.delete(`/projects/${project._id}/members/${memberId}`);
          onUpdated({ ...project, members: project.members.filter((person) => (person.id || person._id) !== memberId), managers: project.managers?.filter((managerId) => managerId !== memberId) }, false);
        } catch (requestError) { setError(getErrorMessage(requestError)); }
      }}><Trash2 size={14} /></button>}</div>;
    })}
      {available.length ? <div className="member-add-row"><select className="text-input" value={selectedUser} onChange={(event) => setSelectedUser(event.target.value)}><option value="">Choose a teammate…</option>{available.map(({ user }) => <option value={user.id || user._id} key={user.id || user._id}>{user.name}</option>)}</select><select className="text-input role-select" value={selectedRole} onChange={(event) => setSelectedRole(event.target.value as 'MANAGER' | 'MEMBER')} aria-label="New project member role"><option value="MEMBER">Member</option><option value="MANAGER">Manager</option></select><button className="button button-primary" disabled={!selectedUser || busy} onClick={addMember}>{busy ? 'Adding…' : 'Add'}</button></div> : <p className="field-hint">Everyone in this organization is already on the project.</p>}
    </div>
  </Modal>;
}
