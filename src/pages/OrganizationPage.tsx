import { useEffect, useState, type FormEvent } from 'react';
import { Building2, Check, Crown, MailPlus, Plus, ShieldCheck, Trash2, UsersRound } from 'lucide-react';
import api, { getErrorMessage } from '../api';
import { useAuth } from '../auth';
import { useWorkspaceContext } from '../components/Shell';
import { Avatar, LoadingBlock } from '../components/ui';
import { useErrorToast } from '../useErrorToast';

export default function OrganizationPage() {
  const { user } = useAuth();
  const { organization, refreshOrganizations } = useWorkspaceContext();
  const [name, setName] = useState(organization?.name || '');
  const [description, setDescription] = useState(organization?.description || '');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('MEMBER');
  const [error, setError] = useState('');
  useErrorToast(error);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(organization?.name || '');
    setDescription(organization?.description || '');
  }, [organization?._id, organization?.name, organization?.description]);

  const myMembership = organization?.members.find((member) => member.user?.id === user?.id || member.user?._id === user?.id);
  const canManage = myMembership?.role === 'OWNER' || myMembership?.role === 'ADMIN';
  const isOwner = myMembership?.role === 'OWNER';

  if (!organization) {
    return <CreateOrganization onCreated={refreshOrganizations} />;
  }

  async function saveOrganization(event: FormEvent) {
    event.preventDefault();
    if (!organization) return;
    setSaving(true); setError(''); setNotice('');
    try {
      await api.put(`/organizations/${organization._id}`, { name, description });
      await refreshOrganizations();
      setNotice('Workspace details saved.');
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  async function addMember(event: FormEvent) {
    event.preventDefault();
    if (!organization) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await api.post(`/organizations/${organization._id}/members`, { email, role });
      setEmail('');
      await refreshOrganizations();
      setNotice('Your teammate has been added to the workspace.');
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(memberId: string, nextRole: string) {
    if (!organization) return;
    try {
      await api.patch(`/organizations/${organization._id}/members/${memberId}`, { role: nextRole });
      await refreshOrganizations();
      setNotice('Member role updated.');
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  }

  async function removeMember(memberId: string, memberName: string) {
    if (!organization) return;
    if (!window.confirm(`Remove ${memberName} from this workspace? Their project assignments will be cleared.`)) return;
    try {
      await api.delete(`/organizations/${organization._id}/members/${memberId}`);
      await refreshOrganizations();
      setNotice(`${memberName} was removed from the workspace.`);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  }

  return <div className="w-full max-w-[1280px] mx-auto">
    <div className="page-heading"><div><span className="eyebrow">PEOPLE & PERMISSIONS</span><h1>Your organization</h1><p>Give your team a home and make sure everyone has the right access.</p></div><div className="member-total"><UsersRound size={16} /> {organization.members.length} {organization.members.length === 1 ? 'member' : 'members'}</div></div>
    {notice && <div className="alert success-alert"><Check size={16} />{notice}</div>}
    <div className="organization-grid">
      <section className="panel organization-settings-panel">
        <div className="panel-heading"><div><span className="eyebrow">THE BIG PICTURE</span><h2>Workspace details</h2></div><div className="settings-heading-icon"><Building2 size={17} /></div></div>
        {canManage ? <form className="dialog-form settings-form" onSubmit={saveOrganization}>
          <label className="field-label">Workspace name<input className="text-input" value={name} onChange={(event) => setName(event.target.value)} required maxLength={100} /></label>
          <label className="field-label">What are you working on?<span className="optional-label">OPTIONAL</span><textarea className="text-input textarea" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="A few words about your team…" maxLength={500} /></label>
          <div className="settings-footnote"><ShieldCheck size={15} /> Only workspace admins can change these details.</div>
          <button className="button button-primary" disabled={saving}>{saving ? 'Saving…' : 'Save changes'} <Check size={15} /></button>
        </form> : <div className="org-read-only"><h3>{organization.name}</h3><p>{organization.description || 'No description yet.'}</p><span><ShieldCheck size={15} /> Workspace details are managed by an admin.</span></div>}
      </section>
      <section className="panel invite-panel">
        <div className="panel-heading"><div><span className="eyebrow">GROW TOGETHER</span><h2>Invite a teammate</h2></div><div className="invite-icon"><MailPlus size={18} /></div></div>
        {canManage ? <form onSubmit={addMember} className="invite-form">
          <p>They'll need an account before you can add them to this workspace.</p>
          <label className="field-label">Their work email<div className="input-with-action"><input type="email" className="text-input" placeholder="teammate@company.com" value={email} onChange={(event) => setEmail(event.target.value)} required /><button className="button button-primary" disabled={busy}>{busy ? 'Adding…' : <><Plus size={16} /> Add</>}</button></div></label>
          {isOwner && <label className="field-label">Workspace role<select className="text-input" value={role} onChange={(event) => setRole(event.target.value)}><option value="MEMBER">Member</option><option value="ADMIN">Admin</option></select></label>}
        </form> : <p className="org-read-only">Ask a workspace admin to invite new teammates.</p>}
        <div className="invite-note"><span>✦</span> Good things happen when we make room for more perspectives.</div>
      </section>
    </div>
    <section className="panel members-panel">
      <div className="panel-heading"><div><span className="eyebrow">THE PEOPLE BEHIND THE WORK</span><h2>Workspace members</h2></div><span className="member-total">{organization.members.length} total</span></div>
      {!organization.members.length ? <LoadingBlock label="Loading workspace members…" /> : <div className="members-table">
        <div className="members-table-head"><span>PERSON</span><span>ROLE</span><span>JOINED</span><span /></div>
        {organization.members.map((member) => {
          const memberUser = member.user;
          const memberId = memberUser?.id || memberUser?._id || '';
          const isSelf = memberId === user?.id;
          return <div className="members-table-row" key={memberId}>
            <div className="member-person"><Avatar name={memberUser?.name} /><div className="member-copy"><strong>{memberUser?.name || 'Workspace member'}{isSelf && <small>YOU</small>}</strong><span>{memberUser?.email}</span></div></div>
            <div className="member-role-cell">{isOwner && member.role !== 'OWNER' ? <select className="role-select" aria-label={`Role for ${memberUser?.name}`} value={member.role} onChange={(event) => changeRole(memberId, event.target.value)}><option value="ADMIN">Admin</option><option value="MEMBER">Member</option></select> : <span className={`role-badge role-${member.role.toLowerCase()}`}>{member.role === 'OWNER' && <Crown size={13} />}{member.role === 'ADMIN' && <ShieldCheck size={13} />}{member.role === 'MEMBER' && <UsersRound size={13} />}{member.role.toLowerCase()}</span>}</div>
            <span className="member-joined">{organization.createdAt ? new Date(organization.createdAt).toLocaleDateString('en', { month: 'short', year: 'numeric' }) : 'Recently'}</span>
            <div className="member-actions">{canManage && member.role !== 'OWNER' && <button className="icon-button remove-member" aria-label={`Remove ${memberUser?.name}`} title="Remove member" onClick={() => removeMember(memberId, memberUser?.name || 'this member')}><Trash2 size={15} /></button>}</div>
          </div>;
        })}
      </div>}
    </section>
  </div>;
}

function CreateOrganization({ onCreated }: { onCreated: () => Promise<void> }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  useErrorToast(error);
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await api.post('/organizations', { name, description });
      await onCreated();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  }
  return <div className="w-full max-w-[1280px] mx-auto org-create-wrap"><div className="org-create-card">
    <div className="org-create-icon"><Building2 size={21} /></div><span className="eyebrow">YOUR TEAM, YOUR SPACE</span><h1>Every good thing<br />starts somewhere.</h1><p>Set up a workspace to gather your people, plans and projects in one place.</p>
    <form onSubmit={submit} className="dialog-form">
      <label className="field-label">Workspace name<input autoFocus className="text-input" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Studio North" required maxLength={100} /></label>
      <label className="field-label">What does your team do? <span className="optional-label">OPTIONAL</span><textarea className="text-input textarea" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Give your workspace a little context…" maxLength={500} /></label>
      <button className="button button-primary button-full" disabled={busy}>{busy ? 'Creating workspace…' : 'Create workspace'} <Plus size={16} /></button>
    </form>
  </div></div>;
}
