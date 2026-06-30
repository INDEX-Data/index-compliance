// Neutral-token sweep: remap warm-stone arbitrary Tailwind classes to the cool
// design-system tokens. Conservative — only neutral stones; semantic status
// colors (greens/reds/ambers) are left untouched. Run:
//   node scripts/token-sweep.mjs <file> [<file> ...]
import { readFileSync, writeFileSync } from 'fs'

const MAP = [
  // text — near-black warm → cool ink
  ['text-[#1c1917]', 'text-ink'],
  ['text-[#1c1d1f]', 'text-ink'],
  ['text-[#0c0a09]', 'text-ink'],
  ['text-[#1a1714]', 'text-ink'],
  // text — body / secondary → muted
  ['text-[#44403c]', 'text-muted'],
  ['text-[#57534e]', 'text-muted'],
  ['text-[#505967]', 'text-muted'],
  // text — faint / placeholder → faint
  ['text-[#78716c]', 'text-faint'],
  ['text-[#a8a29e]', 'text-faint'],
  ['text-[#9c938a]', 'text-faint'],
  // surfaces
  ['bg-[#fafaf9]', 'bg-canvas'],
  ['bg-[#f9fafb]', 'bg-surface-sunken'],
  ['bg-[#f5f5f4]', 'bg-surface-sunken'],
  ['bg-[#f3f4f6]', 'bg-surface-sunken'],
  ['bg-[#1c1917]', 'bg-ink'],
  ['bg-[#1c1d1f]', 'bg-ink'],
  // hovers
  ['hover:bg-[#0c0a09]', 'hover:bg-ink'],
  ['hover:bg-[#fafaf9]', 'hover:bg-canvas'],
  ['hover:bg-[#f5f5f4]', 'hover:bg-surface-sunken'],
  ['hover:bg-[#f3f4f6]', 'hover:bg-surface-sunken'],
  ['hover:text-[#1c1917]', 'hover:text-ink'],
  ['hover:text-[#1c1d1f]', 'hover:text-ink'],
  // borders
  ['border-[#e7e5e4]', 'border-border'],
  ['border-[#f5f5f4]', 'border-border-subtle'],
  ['border-[#d6d3d1]', 'border-border-strong'],
  ['border-[#a8a29e]/20', 'border-border'],
  ['border-[#a8a29e]/30', 'border-border'],
  // focus rings on the old near-black
  ['ring-[#1c1917]/20', 'ring-[color:var(--text-ink)]/15'],
  ['focus:border-[#1c1917]', 'focus:border-border-strong'],
  // white / light literals → dark surfaces (these would be bright blocks on dark)
  ['bg-white', 'bg-surface'],
  ['bg-[#ffffff]', 'bg-surface'],
  ['bg-[#fff]', 'bg-surface'],
  ['bg-[#fafafa]', 'bg-canvas'],
  ['hover:bg-white', 'hover:bg-surface'],
  ['hover:bg-[#fafafa]', 'hover:bg-surface-sunken'],
  // inverse buttons: dark-on-light became near-white bg → white text would vanish
  ['bg-ink text-white', 'bg-ink text-on-accent'],
  ['text-white text-xs font-semibold\n                         bg-[#1c1917]', 'text-on-accent text-xs font-semibold\n                         bg-ink'],
]

let total = 0
for (const file of process.argv.slice(2)) {
  let src = readFileSync(file, 'utf8')
  let n = 0
  for (const [from, to] of MAP) {
    const parts = src.split(from)
    if (parts.length > 1) {
      n += parts.length - 1
      src = parts.join(to)
    }
  }
  writeFileSync(file, src)
  total += n
  console.log(`${n.toString().padStart(4)} replacements  ${file}`)
}
console.log(`\n${total} total`)
