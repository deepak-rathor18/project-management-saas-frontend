import { useEffect, useState } from 'react';
import { ArrowRight, ArrowUpRight, CheckCircle2, CircleAlert, FolderKanban, ListTodo, Plus, Sparkles, Target, UsersRound } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import api, { getErrorMessage } from '../api';
import { useAuth } from '../auth';
import { useWorkspaceContext } from '../components/Shell';
import { Avatar, EmptyState, LoadingBlock, titleCase } from '../components/ui';
import { useErrorToast } from '../useErrorToast';
import type { Activity, Dashboard, Project } from '../types';

const statusColors: Record<string, string> = { TODO: 'slate', IN_PROGRESS: 'blue', IN_REVIEW: 'amber', COMPLETED: 'green' };

export default function DashboardPage() {
  const { organization } = useWorkspaceContext();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState('');
  useErrorToast(error);
  const [loading, setLoading] = useState(false);
  const canCreateProject = Boolean(organization?.members.some((member) =>
    (member.user?.id === user?.id || member.user?._id === user?.id) &&
    ['OWNER', 'ADMIN'].includes(member.role)
  ));

  useEffect(() => {
    if (!organization) {
      setDashboard(null);
      setProjects([]);
      return;
    }
    let active = true;
    setLoading(true);
    Promise.all([
      api.get(`/organizations/${organization._id}/dashboard`),
      api.get('/projects')
    ]).then(([dashboardResult, projectResult]) => {
      if (!active) return;
      setDashboard(dashboardResult.data.dashboard as Dashboard);
      setProjects((projectResult.data.projects as Project[]).filter((project) => project.organization === organization._id).slice(0, 4));
      setError('');
    }).catch((requestError: unknown) => {
      if (active) setError(getErrorMessage(requestError));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [organization]);

  const dateLabel = new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());
  if (!organization) {
    return <div className="welcome-empty">
      <div className="welcome-sparkle"><Sparkles size={20} /></div>
      <span className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</span>
      <h1>Make good work<br /><span>happen together.</span></h1>
      <p>Create your first workspace to bring your team, projects and plans into one clear view.</p>
      <button className="button button-primary" onClick={() => navigate('/organization')}><Plus size={17} /> Create a workspace</button>
      <div className="welcome-art"><div className="welcome-art-card card-back" /><div className="welcome-art-card card-front"><div className="art-card-header"><span /><span /><span /></div><div className="art-line long" /><div className="art-line medium" /><div className="art-progress"><span /></div><div className="art-avatars"><i /><i /><i /></div></div><div className="art-sun" /></div>
    </div>;
  }

  const metrics = [
    { label: 'Total projects', value: dashboard?.projectCount || 0, icon: FolderKanban, tint: 'tint-violet', note: `${dashboard?.activeProjects || 0} active right now` },
    { label: 'Tasks in workspace', value: dashboard?.taskCount || 0, icon: ListTodo, tint: 'tint-blue', note: `${dashboard?.completedProjects || 0} projects completed` },
    { label: 'Assigned to you', value: dashboard?.assignedTasks || 0, icon: Target, tint: 'tint-green', note: 'Open tasks to focus on' },
    { label: 'Past due', value: dashboard?.overdueTasks || 0, icon: CircleAlert, tint: 'tint-amber', note: 'Across your projects' }
  ];

  return (
    <div className="w-full max-w-[1280px] mx-auto">
      <div className="page-heading dashboard-heading">
        <div><span className="eyebrow">{dateLabel.toUpperCase()}</span><h1>Good {getGreeting()}, {user?.name.split(' ')[0]} <span className="wave">✳</span></h1><p>Here's what's happening across your workspace.</p></div>
        {canCreateProject && <Link to="/projects" className="button button-primary"><Plus size={17} /> New project</Link>}
      </div>
      {loading ? <LoadingBlock label="Gathering your workspace activity…" /> : <>
        <section className="metric-grid">
          {metrics.map(({ label, value, icon: Icon, tint, note }) => <article className="metric-card" key={label}>
            <div className={`metric-icon ${tint}`}><Icon size={18} /></div><span className="metric-label">{label}</span><strong className="metric-value">{value}</strong><span className="metric-note">{note}</span>
          </article>)}
        </section>
        <section className="dashboard-columns">
          <div className="panel projects-panel">
            <div className="panel-heading"><div><span className="eyebrow">IN MOTION</span><h2>Projects</h2></div><Link className="text-link" to="/projects">All projects <ArrowRight size={14} /></Link></div>
            {!projects.length ? <EmptyState icon={<FolderKanban size={22} />} title={canCreateProject ? 'Your first project is waiting' : 'No projects are assigned to you yet'} description={canCreateProject ? 'Start small, add your team, and give your next big idea a home.' : 'Ask your workspace owner or admin to add you to a project.'} action={canCreateProject ? <Link to="/projects" className="button button-secondary"><Plus size={15} /> Create project</Link> : undefined} /> :
              <div className="project-list">
                {projects.map((project, index) => <Link className="project-list-row" to={`/projects/${project._id}`} key={project._id}>
                  <div className={`project-color project-color-${index % 4}`}><FolderKanban size={17} /></div>
                  <div className="project-list-main"><strong>{project.name}</strong><span>{project.taskCount || 0} tasks · {titleCase(project.status)}</span></div>
                  <div className="project-progress"><div className="progress-track"><span style={{ width: `${project.progress || 0}%` }} /></div><small>{project.progress || 0}%</small></div>
                  <ArrowUpRight size={16} className="row-arrow" />
                </Link>)}
              </div>}
          </div>
          <div className="panel activity-panel">
            <div className="panel-heading"><div><span className="eyebrow">THE LATEST</span><h2>Team activity</h2></div><Link className="text-link" to="/activity">See all activity <ArrowRight size={14} /></Link></div>
            {dashboard?.recentActivity?.length ? <ActivityList activity={dashboard.recentActivity.slice(0, 5)} /> : <EmptyState icon={<UsersRound size={22} />} title="A little quiet in here" description="Updates from your team will show up here as work moves forward." />}
          </div>
        </section>
        <section className="dashboard-columns lower-columns">
          <div className="panel status-panel">
            <div className="panel-heading"><div><span className="eyebrow">PROJECT HEALTH</span><h2>Tasks by status</h2></div><span className="panel-total">{dashboard?.taskCount || 0} total</span></div>
            <div className="status-bars">{['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED'].map((status) => {
              const count = dashboard?.tasksByStatus[status] || 0;
              const percent = dashboard?.taskCount ? Math.round(count * 100 / dashboard.taskCount) : 0;
              return <div className="status-bar-row" key={status}><div className="status-bar-label"><span className={`status-dot ${statusColors[status]}`} />{titleCase(status)}<strong>{count}</strong></div><div className="wide-track"><span className={`bar-${statusColors[status]}`} style={{ width: `${percent}%` }} /></div></div>;
            })}</div>
          </div>
          <div className="focus-card"><div className="focus-orbit orbit-a" /><div className="focus-orbit orbit-b" /><div className="focus-copy"><span className="eyebrow">A SMALL REMINDER</span><h2>Progress is a team sport.</h2><p>Celebrate the little wins. They add up to the big ones.</p><Link to="/organization">Meet your team <ArrowRight size={14} /></Link></div><div className="focus-avatar-stack"><Avatar name={user?.name} size="small" /><Avatar name={organization.members[1]?.user?.name || 'Team'} size="small" /><span className="avatar avatar-small more-avatar">+</span></div><CheckCircle2 size={22} className="focus-check" /></div>
        </section>
      </>}
    </div>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  return hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
}

function ActivityList({ activity }: { activity: Activity[] }) {
  return <div className="activity-list">{activity.map((item) => <div className="activity-item" key={item._id}>
    <Avatar name={item.actor?.name} size="small" />
    <div className="activity-text"><strong>{item.actor?.name || 'A teammate'}</strong><span>{item.detail}</span><small>{timeAgo(item.createdAt)}</small></div>
  </div>)}</div>;
}

function timeAgo(date: string) {
  const minutes = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
}
