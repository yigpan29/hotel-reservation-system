import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth-context'
import { api, message } from '../api'
export default function Auth({ register = false }: { register?: boolean }) {
  const { login } = useAuth(), navigate = useNavigate(), location = useLocation()
  const [error, setError] = useState(''), [busy, setBusy] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget), username = String(data.get('username')), password = String(data.get('password'))
    setBusy(true); setError('')
    try { if (register) await api('/auth/register', { method: 'POST', body: JSON.stringify({ username, password, email: data.get('email') }) }); await login(username, password); const from: unknown = location.state?.from; navigate(typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') ? from : '/my-reservations') } catch (error) { setError(message(error)) } finally { setBusy(false) }
  }
  return <section className="page max-w-lg"><h1 className="title">{register ? 'Crear cuenta' : 'Iniciar sesión'}</h1><form className="panel space-y-4" onSubmit={submit}>
    <label className="block">Usuario<input autoComplete="username" name="username" required minLength={register ? 3 : 1} maxLength={40} pattern={register ? '[a-zA-Z0-9._-]+' : undefined} className="field" /></label>
    {register && <label className="block">Email<input type="email" name="email" autoComplete="email" required maxLength={255} className="field" /></label>}
    <label className="block">Contraseña<input type="password" name="password" autoComplete={register ? 'new-password' : 'current-password'} required minLength={register ? 8 : 1} maxLength={72} className="field" /></label>
    {error && <p role="alert" className="notice-error">{error}</p>}<button disabled={busy} className="action">{busy ? 'Procesando…' : register ? 'Registrarme' : 'Entrar'}</button>
    <p>{register ? '¿Ya tienes cuenta? ' : '¿Aún no tienes cuenta? '}<Link className="text-orange-700 underline" to={register ? '/login' : '/register'} state={location.state}>{register ? 'Iniciar sesión' : 'Registrarse'}</Link></p>
  </form></section>
}
