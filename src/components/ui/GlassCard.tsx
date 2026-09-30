import React from 'react'
import { motion, HTMLMotionProps } from 'framer-motion'

interface GlassCardProps extends HTMLMotionProps<'div'> {
  children: React.ReactNode
  variant?: 'default' | 'elevated' | 'subtle' | 'interactive'
  className?: string
  glowOnHover?: boolean
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  variant = 'default',
  className = '',
  glowOnHover = false,
  ...props
}) => {
  const variantStyles = {
    default: 'bg-theme-surface/70 backdrop-blur-xl border border-white/5 shadow-lg',
    elevated: 'bg-theme-elevated/80 backdrop-blur-2xl border border-white/10 shadow-2xl',
    subtle: 'bg-white/[0.03] backdrop-blur-md border border-white/[0.05]',
    interactive:
      'bg-theme-surface/60 backdrop-blur-xl border border-white/5 hover:border-white/15 hover:bg-white/[0.08] transition-all duration-300 shadow-md hover:shadow-xl cursor-pointer',
  }

  const glowStyles = glowOnHover
    ? 'hover:shadow-[0_0_30px_rgba(212,0,33,0.25)] hover:border-theme-accent/30'
    : ''

  return (
    <motion.div
      className={`rounded-2xl ${variantStyles[variant]} ${glowStyles} ${className}`}
      {...props}
    >
      {children}
    </motion.div>
  )
}
