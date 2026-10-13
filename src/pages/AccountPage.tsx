import { useState } from 'react';
import { ArrowUpRight, Check, KeyRound, LogOut, Mail, ShieldCheck, UserRound } from 'lucide-react';
import { useAuth } from '../auth';
import { Avatar } from '../components/ui';

export default function AccountPage() {
  const { user, signOut } = useAuth();
  const [signedOut, setSignedOut] = useState(false);
  if (signedOut) return null;
  return <div className="w-full max-w-[1280px] mx-auto">
    <div className="page-heading"><div><span className="eyebrow">YOUR CORNER OF THE WORLD</span><h1>Account settings</h1><p>Take care of the person behind the projects.</p></div></div>
    <section className="panel account-panel">
      <div className="account-profile-banner"><div className="account-profile-art"><div /><div /><div /></div><Avatar name={user?.name} /></div>
      <div className="account-profile-content"><div><span className="eyebrow">YOUR PROFILE</span><h2>{user?.name}</h2><p>Keeping good work moving since today.</p></div><span className="account-active-badge"><i /> Active account</span></div>
      <div className="account-detail-grid"><div className="account-detail"><div className="account-detail-icon"><UserRound size={17} /></div><div><small>FULL NAME</small><strong>{user?.name}</strong></div></div><div className="account-detail"><div className="account-detail-icon"><Mail size={17} /></div><div><small>EMAIL ADDRESS</small><strong>{user?.email}</strong></div></div><div className="account-detail"><div className="account-detail-icon"><KeyRound size={17} /></div><div><small>LOGIN METHOD</small><strong>Email and password</strong></div></div><div className="account-detail"><div className="account-detail-icon"><ShieldCheck size={17} /></div><div><small>ACCOUNT SECURITY</small><strong>Protected with encrypted password</strong></div></div></div>
      <div className="account-security-note"><ShieldCheck size={17} /><span><strong>Your account is in good hands.</strong><br />Passwords are securely hashed before they're stored. Your session is protected with an expiring token.</span><Check size={17} /></div>
      <div className="account-logout-row"><div><strong>Ready to call it a day?</strong><span>Sign out of this device. You can come back anytime.</span></div><button className="button button-secondary" onClick={() => { signOut(); setSignedOut(true); }}><LogOut size={16} /> Sign out <ArrowUpRight size={14} /></button></div>
    </section>
    <p className="account-footnote">Taskflow is a project workspace built to make collaboration feel a little more human.</p>
  </div>;
}
