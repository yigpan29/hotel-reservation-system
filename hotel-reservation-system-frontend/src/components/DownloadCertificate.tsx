import { useState } from 'react'
import { message } from '../api'
import Button from '../ui/Button'
import { DownloadIcon } from '../ui/Icons'

/** Constancia de la reserva en PDF. El nombre accesible lleva el número; el botón, solo la acción. */
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
  return <>
    <Button variant="secondary" size="sm" className="flex-1 sm:flex-none" aria-label={'Descargar constancia #' + id}
      disabled={busy} loading={busy} onClick={download}>
      {!busy && <DownloadIcon className="h-4 w-4" />}{busy ? 'Preparando PDF…' : 'Descargar constancia'}
    </Button>
    {error && <p role="alert" className="basis-full text-sm text-danger-700">{error}</p>}
  </>
}
