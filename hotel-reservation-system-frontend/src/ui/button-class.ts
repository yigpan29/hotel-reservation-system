/**
 * Las clases del botón, aparte del componente: así un <Link> de react-router luce
 * exactamente igual que un <button> sin duplicar la receta.
 */
export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'subtle' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'

const base =
  'inline-flex items-center justify-center gap-2 rounded-xl font-semibold whitespace-nowrap select-none'
  + ' transition-[transform,background-color,border-color,box-shadow,color] duration-160 ease-out-strong'
  + ' active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100'
  + ' focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2'

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-brand-600 text-white shadow-card hover:bg-brand-700',
  secondary: 'bg-white text-ink-800 border border-ink-300 shadow-card hover:bg-ink-50 hover:border-ink-400',
  outline: 'bg-transparent text-brand-700 border border-brand-300 hover:bg-brand-50 hover:border-brand-400',
  ghost: 'bg-transparent text-ink-700 hover:bg-ink-100',
  subtle: 'bg-brand-50 text-brand-700 hover:bg-brand-100',
  danger: 'bg-white text-danger-700 border border-danger-200 hover:bg-danger-50',
}

const sizes: Record<ButtonSize, string> = {
  sm: 'text-sm px-3.5 py-2',
  md: 'text-sm px-5 py-2.5',
  lg: 'text-base px-6 py-3',
  icon: 'h-10 w-10 p-0',
}

export function buttonClass(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', extra = '') {
  return [base, variants[variant], sizes[size], extra].filter(Boolean).join(' ')
}
