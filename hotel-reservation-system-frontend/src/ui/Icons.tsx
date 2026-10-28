import type { SVGProps } from 'react'

/**
 * Iconos del sistema, dibujados a trazo con el color del texto que los rodea.
 * Son decorativos (aria-hidden) porque la etiqueta accesible siempre vive en el
 * control que los contiene: así nunca duplican lo que lee un lector de pantalla.
 */
type IconProps = SVGProps<SVGSVGElement>

function Icon({ children, ...props }: IconProps) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true" focusable="false" className="h-[1.15em] w-[1.15em] shrink-0" {...props}>{children}</svg>
}

export const MapPinIcon = (props: IconProps) => <Icon {...props}><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.75" /></Icon>
export const CalendarIcon = (props: IconProps) => <Icon {...props}><rect x="3.25" y="5" width="17.5" height="16" rx="3" /><path d="M8 3v4M16 3v4M3.25 10h17.5" /></Icon>
export const UsersIcon = (props: IconProps) => <Icon {...props}><path d="M16.5 20v-1.5a4 4 0 0 0-4-4h-5a4 4 0 0 0-4 4V20" /><circle cx="10" cy="7.5" r="3.5" /><path d="M21 20v-1.5a4 4 0 0 0-3-3.87M16.5 4.2a3.5 3.5 0 0 1 0 6.6" /></Icon>
export const BedIcon = (props: IconProps) => <Icon {...props}><path d="M3 19v-9m0 4h18v5m0-5v-1.5a2.5 2.5 0 0 0-2.5-2.5H11v4" /><circle cx="7" cy="11" r="2" /></Icon>
export const StarIcon = (props: IconProps) => <Icon {...props}><path d="m12 3.75 2.55 5.17 5.7.83-4.12 4.02.97 5.68L12 16.77l-5.1 2.68.97-5.68L3.75 9.75l5.7-.83z" /></Icon>
export const CheckIcon = (props: IconProps) => <Icon {...props} strokeWidth={2.25}><path d="m4.5 12.5 5 5 10-11" /></Icon>
export const CheckCircleIcon = (props: IconProps) => <Icon {...props}><circle cx="12" cy="12" r="9" /><path d="m8 12.25 2.75 2.75L16 9.5" /></Icon>
export const AlertIcon = (props: IconProps) => <Icon {...props}><circle cx="12" cy="12" r="9" /><path d="M12 7.75v5M12 16.1h.01" /></Icon>
export const InfoIcon = (props: IconProps) => <Icon {...props}><circle cx="12" cy="12" r="9" /><path d="M12 11v5.25M12 7.9h.01" /></Icon>
export const SearchIcon = (props: IconProps) => <Icon {...props}><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 4.5 4.5" /></Icon>
export const ChevronLeftIcon = (props: IconProps) => <Icon {...props} strokeWidth={2}><path d="m14.5 5-7 7 7 7" /></Icon>
export const ChevronRightIcon = (props: IconProps) => <Icon {...props} strokeWidth={2}><path d="m9.5 5 7 7-7 7" /></Icon>
export const ArrowRightIcon = (props: IconProps) => <Icon {...props}><path d="M4.5 12h15m0 0-5.5-5.5M19.5 12 14 17.5" /></Icon>
export const PlusIcon = (props: IconProps) => <Icon {...props} strokeWidth={2.25}><path d="M12 5.5v13M5.5 12h13" /></Icon>
export const MinusIcon = (props: IconProps) => <Icon {...props} strokeWidth={2.25}><path d="M5.5 12h13" /></Icon>
export const CloseIcon = (props: IconProps) => <Icon {...props} strokeWidth={2}><path d="M6 6l12 12M18 6 6 18" /></Icon>
export const MenuIcon = (props: IconProps) => <Icon {...props} strokeWidth={2}><path d="M4 7h16M4 12h16M4 17h16" /></Icon>
export const LogOutIcon = (props: IconProps) => <Icon {...props}><path d="M15 4.5h3.5A1.5 1.5 0 0 1 20 6v12a1.5 1.5 0 0 1-1.5 1.5H15M11 8.5 7.5 12l3.5 3.5M16 12H7.5" /></Icon>
export const TrashIcon = (props: IconProps) => <Icon {...props}><path d="M4.5 7h15M9.5 7V4.75h5V7M6.5 7l.8 12.1a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4L17.5 7" /></Icon>
export const PencilIcon = (props: IconProps) => <Icon {...props}><path d="M4 20h4L19.5 8.5a2.12 2.12 0 0 0-3-3L5 17v3Z" /></Icon>
export const BuildingIcon = (props: IconProps) => <Icon {...props}><path d="M4 20V5.5A1.5 1.5 0 0 1 5.5 4h7A1.5 1.5 0 0 1 14 5.5V20M14 9.5h4.5A1.5 1.5 0 0 1 20 11v9M3 20h18M7.5 8h3M7.5 12h3M7.5 16h3M17 13.5h.01M17 17h.01" /></Icon>
export const SparkleIcon = (props: IconProps) => <Icon {...props}><path d="M12 3.5l1.6 4.4 4.4 1.6-4.4 1.6L12 15.5l-1.6-4.4L6 9.5l4.4-1.6zM18.5 15l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" /></Icon>
export const ShieldIcon = (props: IconProps) => <Icon {...props}><path d="M12 3.5 5 6v6c0 4.2 2.9 7.4 7 8.5 4.1-1.1 7-4.3 7-8.5V6l-7-2.5Z" /><path d="m9 12 2.25 2.25L15.5 10" /></Icon>
export const ClockIcon = (props: IconProps) => <Icon {...props}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></Icon>
export const ChartIcon = (props: IconProps) => <Icon {...props}><path d="M4 19.5h16M7 16V9.5M12 16V5.5M17 16v-4" /></Icon>
export const TicketIcon = (props: IconProps) => <Icon {...props}><path d="M4 8.5V6.5A1.5 1.5 0 0 1 5.5 5h13A1.5 1.5 0 0 1 20 6.5v2a2.5 2.5 0 0 0 0 7v2a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5v-2a2.5 2.5 0 0 0 0-7Z" /><path d="M12 8.75v6.5" strokeDasharray="2 2.5" /></Icon>
export const DownloadIcon = (props: IconProps) => <Icon {...props}><path d="M12 4v10.5m0 0 3.75-3.75M12 14.5 8.25 10.75M4.5 16.5V18a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-1.5" /></Icon>
export const CreditCardIcon = (props: IconProps) => <Icon {...props}><rect x="3" y="5.5" width="18" height="13" rx="2.5" /><path d="M3 10h18M6.5 14.75h3" /></Icon>
export const ReceiptIcon = (props: IconProps) => <Icon {...props}><path d="M6 3.5h12v17l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4-2 1.4z" /><path d="M9.5 8.5h5M9.5 12.5h5" /></Icon>
