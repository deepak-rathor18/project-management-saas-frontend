import { useState, type FormEvent } from 'react';
import axios from 'axios';
import { ArrowRight, Check, Eye, EyeOff, Layers3, LockKeyhole, Mail, UserRound } from 'lucide-react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth } from '../auth';
import { getErrorMessage } from '../api';

export default function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const isRegister = mode === 'register';
  const { user, isInitializing, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  if (isInitializing) return <div className="page-loading"><span className="spinner" /> Checking your session…</div>;
  if (user) return <Navigate to="/" replace />;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      if (isRegister) await signUp(name, email, password);
      else await signIn(email, password);
      navigate('/');
    } catch (requestError) {
      const message = getErrorMessage(requestError);
      const accountNotFound = !isRegister && axios.isAxiosError(requestError) && requestError.response?.status === 404;
      toast.error(accountNotFound ? <>{message} <Link className="auth-error-link" to="/register">Create an account</Link></> : message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-screen">
      <section className="auth-story">
        <Link to="/" className="brand-lockup auth-brand"><span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M6 17.5h3.5v-5h4v-5H18" /><path d="m15.5 5 2.5 2.5-2.5 2.5" /></svg></span><span>taskflow<span className="brand-period">.</span></span></Link>
        <div className="story-main">
          <div className="story-pill"><span className="story-pill-dot" /> A calmer way to get things done</div>
          <h1>Big ideas.<br /><span>Better together.</span></h1>
          <p>Bring your people, projects and plans into one thoughtful workspace. Less chasing. More making.</p>
          <div className="story-checks">
            <div><span><Check size={14} /></span>Everything your team needs, in one place</div>
            <div><span><Check size={14} /></span>Clear priorities, steady progress</div>
            <div><span><Check size={14} /></span>Built for the work that matters</div>
          </div>
        </div>
        <div className="story-footer"><span>© 2026 Taskflow</span><span>Made for teams who care about the details.</span></div>
        <div className="story-orb orb-one" /><div className="story-orb orb-two" />
      </section>
      <section className="auth-form-side">
        <div className="auth-form-wrap">
          <div className="auth-form-heading"><div className="auth-mobile-mark"><Layers3 size={18} /></div><span className="eyebrow">{isRegister ? 'GET STARTED' : 'WELCOME BACK'}</span><h2>{isRegister ? 'Create your account' : 'Good to see you again'}</h2><p>{isRegister ? 'A more focused workday is just a few details away.' : 'Sign in to pick up right where your team left off.'}</p></div>
          <form onSubmit={submit} className="auth-form">
            {isRegister && <label className="field-label">Your name<div className="input-wrap"><UserRound size={17} /><input autoComplete="name" placeholder="e.g. Aarav Sharma" value={name} onChange={(event) => setName(event.target.value)} required maxLength={80} /></div></label>}
            <label className="field-label">Work email<div className="input-wrap"><Mail size={17} /><input type="email" autoComplete="email" placeholder="you@company.com" value={email} onChange={(event) => setEmail(event.target.value)} required /></div></label>
            <label className="field-label">Password<div className="input-wrap"><LockKeyhole size={17} /><input type={showPassword ? 'text' : 'password'} autoComplete={isRegister ? 'new-password' : 'current-password'} placeholder={isRegister ? 'At least 8 characters' : 'Enter your password'} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={isRegister ? 8 : 1} /><button className="auth-password-toggle" type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>{isRegister && <span className="field-hint">Use 8 characters or more.</span>}</label>
            <button className="button button-primary auth-submit" type="submit" disabled={busy}>{busy ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'} {!busy && <ArrowRight size={17} />}</button>
          </form>
          <div className="auth-switch">{isRegister ? 'Already have an account?' : 'New to Taskflow?'} <Link to={isRegister ? '/login' : '/register'}>{isRegister ? 'Sign in' : 'Create an account'}</Link></div>
          <div className="auth-security"><LockKeyhole size={13} /> Your information is encrypted and secure</div>
        </div>
      </section>
    </main>
  );
}
