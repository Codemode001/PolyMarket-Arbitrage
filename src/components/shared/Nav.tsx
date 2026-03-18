'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LINKS = [
  { href: '/', label: 'Scanner' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/tracker', label: 'Tracker' },
  { href: '/analytics', label: 'Analytics' },
]

export function Nav({ subtitle }: { subtitle?: string }) {
  const pathname = usePathname()

  return (
    <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
      <div>
        <h1 className="text-xl font-bold text-white tracking-tight">POLYMARKET ARB</h1>
        {subtitle && <p className="text-zinc-500 text-xs mt-0.5">{subtitle}</p>}
      </div>
      <nav className="flex items-center gap-1">
        {LINKS.map((link) => {
          const active = pathname === link.href
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`px-3 py-1.5 rounded text-xs transition-colors ${
                active
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-200'
              }`}
            >
              {link.label}
            </Link>
          )
        })}
      </nav>
    </header>
  )
}
