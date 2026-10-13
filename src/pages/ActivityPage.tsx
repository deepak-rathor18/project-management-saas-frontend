import { useEffect, useState } from 'react';
import { Activity as ActivityIcon, ArrowLeft, ArrowRight, Clock3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import api, { getErrorMessage } from '../api';
import { useWorkspaceContext } from '../components/Shell';
import { Avatar, EmptyState, LoadingBlock } from '../components/ui';
import { useErrorToast } from '../useErrorToast';
import type { Activity } from '../types';

interface ActivityPagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

const PAGE_SIZE = 20;

export default function ActivityPage() {
  const { organization } = useWorkspaceContext();
  const [activity, setActivity] = useState<Activity[]>([]);
  const [pagination, setPagination] = useState<ActivityPagination | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  useErrorToast(error);

  useEffect(() => {
    setPage(1);
  }, [organization?._id]);

  useEffect(() => {
    if (!organization) {
      setActivity([]);
      setPagination(null);
      setLoading(false);
      setError('');
      return;
    }
    let active = true;
    setLoading(true);
    setError('');
    setActivity([]);
    setPagination(null);
    api.get(`/organizations/${organization._id}/activity`, { params: { page, limit: PAGE_SIZE } })
      .then(({ data }) => {
        if (!active) return;
        setActivity(data.activity as Activity[]);
        setPagination(data.pagination as ActivityPagination);
      })
      .catch((requestError: unknown) => {
        if (active) setError(getErrorMessage(requestError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [organization?._id, page, reload]);

  if (!organization) {
    return <div className="w-full max-w-[1280px] mx-auto"><EmptyState icon={<ActivityIcon size={23} />} title="Create a workspace first" description="Workspace activity will appear here once your team has a home." /></div>;
  }

  return <div className="w-full max-w-[1280px] mx-auto">
    <div className="project-back-row"><Link to="/" className="back-link"><ArrowLeft size={15} /> Overview</Link></div>
    <div className="page-heading activity-page-heading">
      <div><span className="eyebrow">THE LATEST</span><h1>Team activity</h1><p>Recent work and updates across {organization.name}.</p></div>
      {pagination && <span className="activity-total">{pagination.total} {pagination.total === 1 ? 'update' : 'updates'}</span>}
    </div>
    {error && <div className="alert error-alert activity-error" role="alert"><span>{error}</span><button className="button button-secondary" onClick={() => setReload((current) => current + 1)}>Try again</button></div>}
    <section className="panel activity-history-panel" aria-label="Team activity history">
      {loading ? <LoadingBlock label="Loading team activity…" /> : activity.length ? <>
        <div className="activity-history-list">
          {activity.map((item) => <article className="activity-history-item" key={item._id}>
            <Avatar name={item.actor?.name} size="small" />
            <div className="activity-history-content">
              <div className="activity-history-description"><strong>{item.actor?.name || 'A teammate'}</strong> {item.detail}</div>
              {(item.project || item.task) && <div className="activity-related">
                {item.project && <Link to={`/projects/${item.project._id}`}>{item.project.name}</Link>}
                {item.task && <span>{item.task.title}</span>}
              </div>}
              <time className="activity-history-time" dateTime={item.createdAt}><Clock3 size={13} />{new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.createdAt))}</time>
            </div>
          </article>)}
        </div>
        {pagination && pagination.pages > 1 && <nav className="activity-pagination" aria-label="Activity pages">
          <button className="button button-secondary" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}><ArrowLeft size={15} /> Previous</button>
          <span>Page {page} of {pagination.pages}</span>
          <button className="button button-secondary" disabled={page >= pagination.pages} onClick={() => setPage((current) => current + 1)}>Next <ArrowRight size={15} /></button>
        </nav>}
      </> : error ? null : <EmptyState icon={<ActivityIcon size={23} />} title="No activity yet" description="Updates from your team will appear here as work moves forward." />}
    </section>
  </div>;
}
