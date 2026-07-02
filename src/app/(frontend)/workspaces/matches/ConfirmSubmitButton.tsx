'use client'

import type { MouseEvent, ReactNode } from 'react'

export const ConfirmSubmitButton = ({
  children,
  confirmMessage,
  className,
}: {
  children: ReactNode
  confirmMessage: string
  className?: string
}) => {
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (!window.confirm(confirmMessage)) {
      event.preventDefault()
    }
  }

  return (
    <button type="submit" className={className} onClick={handleClick}>
      {children}
    </button>
  )
}
