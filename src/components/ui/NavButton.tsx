'use client';

import React from 'react';
import Link from 'next/link';
import { useNavigation } from '@/components/navigation';
import { LucideIcon } from 'lucide-react';
import Icon from '@/components/ui/AppIcon';


interface NavButtonProps {
  href: string;
  label: string;
  icon?: LucideIcon;
  onClick?: () => void;
  variant?: 'default' | 'primary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  external?: boolean;
  className?: string;
  showActiveIndicator?: boolean;
  title?: string;
}

/**
 * NavButton Component
 * Renders a navigation button with automatic active state detection
 * Supports internal and external links with proper styling
 */
export default function NavButton({
  href,
  label,
  icon: Icon,
  onClick,
  variant = 'default',
  size = 'md',
  external = false,
  className = '',
  showActiveIndicator = false,
  title,
}: NavButtonProps) {
  const { isActive, navigate } = useNavigation();
  const active = isActive(href);

  const baseStyles = 'flex items-center gap-2 rounded-lg font-medium transition-all duration-150';

  const variantStyles = {
    default: `text-foreground border border-border ${
      active ? 'bg-primary text-primary-foreground shadow-lg' : 'hover:bg-muted'
    }`,
    primary: `text-primary-foreground ${
      active
        ? 'bg-primary shadow-lg shadow-primary/30'
        : 'bg-primary/80 hover:bg-primary'
    }`,
    outline: `border border-primary text-primary ${
      active ? 'bg-primary/10' : 'hover:bg-primary/5'
    }`,
    ghost: `text-muted-foreground ${
      active ? 'text-foreground bg-muted' : 'hover:text-foreground hover:bg-muted/50'
    }`,
  };

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  const buttonClasses = `${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`;

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => {
    onClick?.();
    if (external && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
      e.preventDefault();
      navigate(href, { external: true });
    }
  };

  if (external) {
    return (
      <a href={href} onClick={handleClick} className={buttonClasses} target="_blank" rel="noopener noreferrer" title={title}>
        {Icon && <Icon size={18} />}
        <span>{label}</span>
        {showActiveIndicator && active && <span className="ml-auto w-2 h-2 rounded-full bg-current" />}
      </a>
    );
  }

  return (
    <Link href={href} onClick={handleClick} className={buttonClasses} title={title}>
      {Icon && <Icon size={18} />}
      <span>{label}</span>
      {showActiveIndicator && active && <span className="ml-auto w-2 h-2 rounded-full bg-current" />}
    </Link>
  );
}
