import { createContext, useContext } from 'react'
export interface NotificationCounter { count: number | null; error: string }
export const NotificationContext = createContext<NotificationCounter>({ count: null, error: '' })
export function useNotificationCounter() { return useContext(NotificationContext) }
