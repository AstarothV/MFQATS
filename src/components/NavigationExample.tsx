'use client';

import React from 'react';
import NavButton from '@/components/ui/NavButton';
import { useNavigation } from '@/components/navigation';
import { ChevronLeft, ChevronRight, Package, ShoppingBag, ClipboardCheck, Home } from 'lucide-react';

/**
 * Example Navigation Component
 * Demonstrates all navigation features
 * Copy and modify this example for your own use cases
 */
export default function NavigationExample() {
  const { navigate, isActive, isPathActive, currentPath, navigateBack, navigateForward } = useNavigation();

  return (
    <div className="space-y-6 p-6">
      {/* Current Path Display */}
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Current Path</p>
        <p className="text-lg font-semibold text-foreground font-mono">{currentPath}</p>
      </div>

      {/* History Navigation */}
      <div className="flex gap-2">
        <button
          onClick={navigateBack}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors"
        >
          <ChevronLeft size={18} />
          Back
        </button>
        <button
          onClick={navigateForward}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors"
        >
          Forward
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Navigation Buttons - Default Variant */}
      <div>
        <p className="text-sm font-semibold text-foreground mb-3">Default Variant</p>
        <div className="flex flex-wrap gap-2">
          <NavButton
            href="/customer-dashboard"
            label="My Orders"
            icon={Package}
          />
          <NavButton
            href="/customer-dashboard/shop"
            label="Shop"
            icon={ShoppingBag}
          />
          <NavButton
            href="/customer-dashboard/order-status"
            label="Order Queue"
            icon={ClipboardCheck}
          />
        </div>
      </div>

      {/* Navigation Buttons - Primary Variant */}
      <div>
        <p className="text-sm font-semibold text-foreground mb-3">Primary Variant</p>
        <div className="flex flex-wrap gap-2">
          <NavButton
            href="/staff-dashboard"
            label="Workshop"
            icon={Home}
            variant="primary"
            showActiveIndicator={true}
          />
          <NavButton
            href="/staff-dashboard/assigned-tasks"
            label="Tasks"
            variant="primary"
            showActiveIndicator={true}
          />
        </div>
      </div>

      {/* Navigation Buttons - Ghost Variant */}
      <div>
        <p className="text-sm font-semibold text-foreground mb-3">Ghost Variant (Subtle)</p>
        <div className="flex flex-wrap gap-2">
          <NavButton
            href="/admin-dashboard"
            label="Admin"
            variant="ghost"
          />
          <NavButton
            href="/real-time-production-dashboard"
            label="Production"
            variant="ghost"
          />
        </div>
      </div>

      {/* Navigation Buttons - Different Sizes */}
      <div>
        <p className="text-sm font-semibold text-foreground mb-3">Different Sizes</p>
        <div className="flex flex-wrap items-center gap-2">
          <NavButton
            href="/orders"
            label="Small"
            variant="outline"
            size="sm"
          />
          <NavButton
            href="/orders"
            label="Medium"
            variant="outline"
            size="md"
          />
          <NavButton
            href="/orders"
            label="Large"
            variant="outline"
            size="lg"
          />
        </div>
      </div>

      {/* Active State Information */}
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm font-semibold text-foreground mb-4">Active State Detection</p>
        <div className="space-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">Staff Dashboard Active: </span>
            <span className={isActive('/staff-dashboard') ? 'text-success' : 'text-muted-foreground'}>
              {isActive('/staff-dashboard') ? '✓ Yes' : '✗ No'}
            </span>
          </p>
          <p>
            <span className="text-muted-foreground">In Staff Area: </span>
            <span className={isPathActive('/staff-dashboard') ? 'text-success' : 'text-muted-foreground'}>
              {isPathActive('/staff-dashboard') ? '✓ Yes' : '✗ No'}
            </span>
          </p>
          <p>
            <span className="text-muted-foreground">In Admin Area: </span>
            <span className={isPathActive('/admin-dashboard') ? 'text-success' : 'text-muted-foreground'}>
              {isPathActive('/admin-dashboard') ? '✓ Yes' : '✗ No'}
            </span>
          </p>
        </div>
      </div>

      {/* Direct Navigation Example */}
      <div>
        <p className="text-sm font-semibold text-foreground mb-3">Direct Navigation</p>
        <button
          onClick={() => navigate('/support')}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Go to Support Page
        </button>
      </div>
    </div>
  );
}
