'use client'

import type { ButtonHTMLAttributes, MouseEvent, ReactNode } from 'react'

export interface ConfirmSubmitButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  confirmMessage: string
}

export const ConfirmSubmitButton = ({
  children,
  confirmMessage,
  onClick,
  ...props
}: ConfirmSubmitButtonProps) => {
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (!window.confirm(confirmMessage)) {
      event.preventDefault()
      return
    }
    onClick?.(event)
  }

  return (
    <button type="submit" onClick={handleClick} {...props}>
      {children}
    </button>
  )
}
