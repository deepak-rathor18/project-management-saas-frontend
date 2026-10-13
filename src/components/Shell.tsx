import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Check, ChevronDown, CircleHelp, FolderKanban, LayoutDashboard, LogOut, Settings2, Sparkles, UserRound, UsersRound } from 'lucide-react';
import api, { getErrorMessage } from '../api';
import { useAuth } from '../auth';
import { useErrorToast } from '../useErrorToast';
import type { Organization } from '../types';

interface WorkspaceContextValue {
  organization: Organization | null;
  organizations: Organization[];
  refreshOrganizations: () => Promise<void>;
  setOrganization: (organization: Organization) => void;
}

export default function Shell({ children }: { children: ReactNode }) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organization, setCurrentOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const workspacePickerRef = useRef<HTMLDivElement>(null);
  const workspaceTriggerRef = useRef<HTMLButtonElement>(null);
  useErrorToast(error);
  const { user, signOut } = useAuth();
  const location = useLocation();

  const refreshOrganizations = async () => {
    const { data } = await api.get('/organizations');
    const list = data.organizations as Organization[];
    setOrganizations(list);
    const selectedId = localStorage.getItem('taskflow_organization');
    const selected = list.find((item) => item._id === selectedId) || list[0] || null;
    setCurrentOrganization(selected);
    if (selected) localStorage.setItem('taskflow_organization', selected._id);
    else localStorage.removeItem('taskflow_organization');
  };

  useEffect(() => {
    refreshOrganizations()
      .catch((requestError: unknown) => setError(getErrorMessage(requestError)))
      .finally(() => setLoading(false));
  }, []);

  const workspaceValue = useMemo<WorkspaceContextValue>(() => ({
    organization,
    organizations,
    refreshOrganizations,
    setOrganization(next) {
      setCurrentOrganization(next);
      localStorage.setItem('taskflow_organization', next._id);
    }
  }), [organization, organizations]);

  const pageTitle = useMemo(() => {
    if (location.pathname.startsWith('/projects/')) return 'Project workspace';
    return {
      '/': 'Overview',
      '/projects': 'Projects',
      '/organization': 'Organization',
      '/activity': 'Team activity',
      '/account': 'Account settings'
    }[location.pathname] || 'Workspace';
  }, [location.pathname]);

  const initials = (user?.name || 'U').split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase();

  useEffect(() => {
    if (!profileMenuOpen) return;
    function closeOnOutsideClick(event: MouseEvent) {
      if (event.target instanceof Node && !profileMenuRef.current?.contains(event.target)) {
        setProfileMenuOpen(false);
      }
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setProfileMenuOpen(false);
    }
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [profileMenuOpen]);

  useEffect(() => {
    if (!workspaceMenuOpen) return;
    function closeOnOutsideClick(event: MouseEvent) {
      if (event.target instanceof Node && !workspacePickerRef.current?.contains(event.target)) {
        setWorkspaceMenuOpen(false);
      }
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setWorkspaceMenuOpen(false);
        workspaceTriggerRef.current?.focus();
      }
    }
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [workspaceMenuOpen]);

  return (
    <div className="min-h-screen flex">
      <aside className="sidebar">
        <NavLink to="/" className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M6 17.5h3.5v-5h4v-5H18" />
              <path d="m15.5 5 2.5 2.5-2.5 2.5" />
            </svg>
          </span>
          <span>taskflow<span className="brand-period">.</span></span>
        </NavLink>
        <div className={`workspace-picker${workspaceMenuOpen ? ' workspace-picker-open' : ''}`} ref={workspacePickerRef}>
          <button
            className="workspace-trigger"
            type="button"
            ref={workspaceTriggerRef}
            disabled={organizations.length <= 1}
            aria-label={`Switch workspace. Current workspace: ${organization?.name || 'none selected'}`}
            aria-haspopup={organizations.length > 1 ? 'menu' : undefined}
            aria-expanded={workspaceMenuOpen}
            onClick={() => setWorkspaceMenuOpen((open) => !open)}
          >
            <span className="workspace-badge">{organization?.name?.slice(0, 1).toUpperCase() || 'W'}</span>
            <span className="workspace-copy"><small>Workspace</small><strong>{organization?.name || 'Set up your team'}</strong></span>
            {organizations.length > 1 && <ChevronDown size={16} className="workspace-chevron" />}
          </button>
          {workspaceMenuOpen && organizations.length > 0 && (
            <div className="workspace-menu" role="group" aria-label="Switch workspace">
              <div className="workspace-menu-heading">
                <span>YOUR WORKSPACES</span>
                <small>{organizations.length} available</small>
              </div>
              <div className="workspace-menu-options">
                {organizations.map((item) => {
                  const isSelected = item._id === organization?._id;
                  const role = item.members.find((member) =>
                    (member.user?.id || member.user?._id) === user?.id
                  )?.role;
                  return (
                    <button
                      className={`workspace-option${isSelected ? ' workspace-option-selected' : ''}`}
                      type="button"
                      aria-pressed={isSelected}
                      key={item._id}
                      onClick={() => {
                        workspaceValue.setOrganization(item);
                        setWorkspaceMenuOpen(false);
                      }}
                    >
                      <span className="workspace-option-badge">{item.name.slice(0, 1).toUpperCase()}</span>
                      <span className="workspace-option-copy">
                        <strong>{item.name}</strong>
                        <small>{role ? role.toLowerCase() : 'workspace'} workspace</small>
                      </span>
                      {isSelected && <Check size={16} className="workspace-option-check" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <nav className="primary-nav" aria-label="Main navigation">
          <span className="nav-caption">WORKSPACE</span>
          <NavLink to="/" end className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}><LayoutDashboard size={18} /> Overview</NavLink>
          <NavLink to="/projects" className={({ isActive }) => `nav-link${isActive || location.pathname.startsWith('/projects/') ? ' active' : ''}`}><FolderKanban size={18} /> Projects</NavLink>
          <NavLink to="/organization" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}><UsersRound size={18} /> Members <span className="nav-count">{organization?.members?.length || 0}</span></NavLink>
          <span className="nav-caption nav-caption-spaced">YOUR SPACE</span>
          <NavLink to="/account" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}><Settings2 size={18} /> Settings</NavLink>
        </nav>
        <div className="sidebar-bottom">
          <div className="upgrade-card">
            <div className="upgrade-icon"><Sparkles size={16} /></div>
            <strong>Make space for great work.</strong>
            <p>Your team's next big thing starts with a clear plan.</p>
            <NavLink to="/projects" className="upgrade-link">Explore projects <span>↗</span></NavLink>
          </div>
          <button className="help-link" type="button"><CircleHelp size={17} /> Help & support</button>
          <div className="profile-row">
            <Link className="sidebar-profile-button" to="/account" aria-label="Open profile">
              <div className="avatar avatar-small">{initials}</div>
              <div className="profile-copy"><strong>{user?.name}</strong><span>{user?.email}</span></div>
            </Link>
            <button className="logout-button" type="button" onClick={signOut}><LogOut size={16} /><span>Log out</span></button>
          </div>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb"><span>{organization?.name || 'Your workspace'}</span><span className="breadcrumb-slash">/</span><strong>{pageTitle}</strong></div>
          <div className="topbar-actions">
            <div className="online-status"><span /> All changes saved</div>
            <div className="topbar-divider" />
            <div className="profile-menu-wrap" ref={profileMenuRef}>
              <button
                className="icon-button header-avatar"
                type="button"
                title="Account menu"
                aria-label="Open account menu"
                aria-haspopup="menu"
                aria-expanded={profileMenuOpen}
                onClick={() => setProfileMenuOpen((open) => !open)}
              ><span className="avatar avatar-tiny">{initials}</span></button>
              {profileMenuOpen && <div className="profile-menu" role="menu">
                <div className="profile-menu-user"><strong>{user?.name}</strong><span>{user?.email}</span></div>
                <Link className="profile-menu-item" to="/account" role="menuitem" onClick={() => setProfileMenuOpen(false)}><UserRound size={16} /> Profile</Link>
                <button className="profile-menu-item profile-menu-logout" type="button" role="menuitem" onClick={signOut}><LogOut size={16} /> Log out</button>
              </div>}
            </div>
          </div>
        </header>
        <div className="page-content">
          {loading ? <div className="page-loading"><span className="spinner" /> Loading your workspace…</div> : (
            <WorkspaceContext.Provider value={workspaceValue}>{children}</WorkspaceContext.Provider>
          )}
        </div>
      </main>
    </div>
  );
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspaceContext() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error('Workspace context is unavailable');
  return context;
}
