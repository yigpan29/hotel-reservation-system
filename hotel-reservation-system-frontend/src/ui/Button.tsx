import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { buttonClass, type ButtonSize, type ButtonVariant } from './button-class'

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Muestra un indicador de progreso y bloquea el botón sin cambiar su nombre accesible. */
  loading?: boolean
  full?: boolean
  className?: string
  children?: ReactNode
}

/**
 * El botón del sistema. La respuesta al pulsar —una escala al 97% en 160 ms— hace
 * que la interfaz se sienta atenta sin llamar la atención.
 */
export default function Button({ variant = 'primary', size = 'md', loading = false, full = false, className = '', disabled, children, type = 'button', ...rest }: ButtonProps) {
  return <button type={type} disabled={disabled || loading} {...rest}
    className={buttonClass(variant, size, (full ? 'w-full ' : '') + className)}>
    {loading && <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent opacity-70" style={{ animationDuration: '900ms' }} />}
    {children}
  </button>
}
