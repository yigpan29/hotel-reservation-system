import { useState } from 'react'
import { message } from '../api'

export default function DownloadCertificate({ id }: { id: number }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  async function download() {
    setBusy(true); setError('')
    try {
      const response = await fetch((import.meta.env.VITE_API_BASE || '/api') + '/reservations/' + id + '/certificate', { credentials: 'include' })
      if (!response.ok) throw new Error(response.status === 401 ? 'Inicia sesión para descargar la constancia.' : 'No se pudo descargar la constancia (HTTP ' + response.status + ').')
      const url = URL.createObjectURL(await response.blob())
      const link = document.createElement('a'); link.href = url; link.download = 'constancia-reserva-' + id + '.pdf'
      document.body.appendChild(link); link.click(); link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (failure) { setError(message(failure)) } finally { setBusy(false) }
  }
  return <><button className="mt-3 ml-3 border rounded px-4 py-2" disabled={busy} onClick={download}>{busy ? 'Preparando PDF…' : 'Descargar constancia #' + id}</button>{error && <p role="alert" className="notice-error">{error}</p>}</>
}
