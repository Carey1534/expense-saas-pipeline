/**
 * Rule-based expense auto-categorization engine.
 * Matches vendor names and amounts to construction-industry expense categories.
 * No backend required — deterministic, instant, runs client-side.
 */

export interface Category {
  key: string;
  label: string;
  color: string;       // Tailwind bg color class
  textColor: string;   // Tailwind text color class
  borderColor: string; // Tailwind border color class
  emoji: string;
}

const CATEGORIES: Category[] = [
  { key: 'fuel',       label: 'Fuel',       color: 'bg-orange-100', textColor: 'text-orange-700', borderColor: 'border-orange-200', emoji: '⛽' },
  { key: 'materials',  label: 'Materials',  color: 'bg-yellow-100', textColor: 'text-yellow-700', borderColor: 'border-yellow-200', emoji: '🏗️' },
  { key: 'labor',      label: 'Labor',      color: 'bg-blue-100',   textColor: 'text-blue-700',   borderColor: 'border-blue-200',   emoji: '👷' },
  { key: 'tools',      label: 'Tools',      color: 'bg-purple-100', textColor: 'text-purple-700', borderColor: 'border-purple-200', emoji: '🔧' },
  { key: 'food',       label: 'Meals',      color: 'bg-pink-100',   textColor: 'text-pink-700',   borderColor: 'border-pink-200',   emoji: '🍔' },
  { key: 'travel',     label: 'Travel',     color: 'bg-sky-100',    textColor: 'text-sky-700',    borderColor: 'border-sky-200',    emoji: '✈️' },
  { key: 'lodging',    label: 'Lodging',    color: 'bg-teal-100',   textColor: 'text-teal-700',   borderColor: 'border-teal-200',   emoji: '🏨' },
  { key: 'safety',     label: 'Safety',     color: 'bg-red-100',    textColor: 'text-red-700',    borderColor: 'border-red-200',    emoji: '🦺' },
  { key: 'equipment',  label: 'Equipment',  color: 'bg-amber-100',  textColor: 'text-amber-700',  borderColor: 'border-amber-200',  emoji: '🚜' },
  { key: 'electrical', label: 'Electrical', color: 'bg-lime-100',   textColor: 'text-lime-700',   borderColor: 'border-lime-200',   emoji: '⚡' },
  { key: 'plumbing',   label: 'Plumbing',   color: 'bg-cyan-100',   textColor: 'text-cyan-700',   borderColor: 'border-cyan-200',   emoji: '🚿' },
  { key: 'office',     label: 'Office',     color: 'bg-gray-100',   textColor: 'text-gray-600',   borderColor: 'border-gray-200',   emoji: '📎' },
  { key: 'other',      label: 'Other',      color: 'bg-gray-100',   textColor: 'text-gray-500',   borderColor: 'border-gray-200',   emoji: '📦' },
];

// Category key → regex patterns for vendor names (case-insensitive)
const CATEGORY_RULES: Array<{ key: string; patterns: RegExp[] }> = [
  { key: 'fuel', patterns: [
    /\bshell\b/i, /\bchevron\b/i, /\bsinclair\b/i, /\bphillips\s*66\b/i, /\bvalero\b/i,
    /\bexxon\b/i, /\bmobil\b/i, /\bkwik\s*trip\b/i, /\bpilot\b/i, /\bflying\s*j\b/i,
    /\bcaseys\b/i, /\bcasey['']s\b/i, /\bta\s+truck\b/i, /\bampm\b/i, /\bcircle\s*k\b/i,
    /\bspeedway\b/i, /\bgas\s*(station|mart|stop)/i, /\bfuel\b/i, /diesel/i,
    /\bsunoco\b/i, /\bmarathon\b/i, /\bgetgo\b/i, /\bwawa\b/i,
  ]},
  { key: 'materials', patterns: [
    /home\s*depot/i, /\blowe['']?s\b/i, /\bmenards\b/i, /\bace\s*hardware\b/i,
    /\btrue\s*value\b/i, /\bfastenal\b/i, /\bgrainger\b/i, /84\s*lumber/i,
    /\blumber\b/i, /\bplywood\b/i, /\bconcrete\b/i, /\bcement\b/i, /\bdrywall\b/i,
    /\binsulation\b/i, /\broofing\b/i, /\bsiding\b/i, /\bpaint\b/i, /\bsherwin\b/i,
    /\bbenjamin\s*moore\b/i, /\bbuilding\s*(supply|materials|center)/i, /\bsupply\s*co\b/i,
    /\bsteel\b/i, /\biron\b/i, /\bpipe\b/i, /\btubing\b/i, /\bwire\b/i,
  ]},
  { key: 'labor', patterns: [
    /\bpayroll\b/i, /\bsubcontract/i, /\bcontract\s*labor\b/i, /\bstaffing\b/i,
    /\bmanpower\b/i, /\btemp\s*(agency|work)/i, /\bladder\b/i,
  ]},
  { key: 'tools', patterns: [
    /\bmilwaukee\b/i, /\bdewalt\b/i, /\bbosch\b/i, /\bmakita\b/i, /\bsnap.on\b/i,
    /\bstanley\b/i, /\bmatco\b/i, /\bknaack\b/i, /\bstihl\b/i, /\bhusqvarna\b/i,
    /\bkatom\b/i, /\btool\s*(king|barn|source|depot)/i, /\bequip\s*rental\b/i,
    /\brunner\b/i, /\bsunbelt\b/i, /\bunited\s*rentals\b/i,
  ]},
  { key: 'food', patterns: [
    /\bmcdonald['']?s\b/i, /\bsubway\b/i, /\bchipotle\b/i, /\btaco\s*bell\b/i,
    /\bburger\s*king\b/i, /\bpizza\b/i, /\bdomino['']?s\b/i, /\bjimmy\s*john['']?s\b/i,
    /\bpanera\b/i, /\bstarbucks\b/i, /\bdunkin\b/i, /\bchick.fil.a\b/i,
    /\bwhataburger\b/i, /\bwendy['']?s\b/i, /\bdenny['']?s\b/i, /\bihop\b/i,
    /\bwaffle\s*house\b/i, /\bcracker\s*barrel\b/i, /\bgolden\s*corral\b/i,
    /\bgrub\s*hub\b/i, /\bdoor\s*dash\b/i, /\brestaurant\b/i, /\bcafe\b/i,
    /\bdiner\b/i, /\bgrill\b/i, /\bbbq\b/i, /\bsteakhouse\b/i, /\bmeal/i,
    /\bsam['']?s\s*club\b/i, /\bcostco\b/i, /\bwal.?mart\b/i, /\btarget\b/i,
  ]},
  { key: 'travel', patterns: [
    /\bairlines\b/i, /\bairport\b/i, /\bflight\b/i, /\bdelta\b/i, /\bunited\s*air\b/i,
    /\bamerican\s*air\b/i, /\bsouthwest\b/i, /\bubcr?\b/i, /\blyft\b/i,
    /\bhertz\b/i, /\bavis\b/i, /\bbudget\s*rent/i, /\benterprise\s*rent/i,
    /\bnational\s*car\b/i, /\bmileage\b/i, /\btravel\b/i, /\bexpedia\b/i,
  ]},
  { key: 'lodging', patterns: [
    /\bhotel\b/i, /\binn\b/i, /\bmotel\s*6\b/i, /\bsuper\s*8\b/i, /\bdays\s*inn\b/i,
    /\bmarriott\b/i, /\bhilton\b/i, /\bhampton\s*inn\b/i, /\bcomfort\s*inn\b/i,
    /\bholiday\s*inn\b/i, /\bbest\s*western\b/i, /\bhyatt\b/i, /\bairbnb\b/i,
    /\bvacation\s*rental\b/i, /\blodg(e|ing)\b/i,
  ]},
  { key: 'safety', patterns: [
    /\bppe\b/i, /\bhard\s*hat\b/i, /\bsafety\b/i, /\bgloves\b/i, /\bboots\b/i,
    /\bvest\b/i, /\bgoggle\b/i, /\brespir/i, /\bhighviz\b/i, /\bgrainger\b/i,
    /\buline\b/i, /\bprotect/i, /\bfire\s*extinguish/i,
  ]},
  { key: 'equipment', patterns: [
    /\bcaterpillar\b/i, /\bcat\s*(machine|equip|rental)/i, /\bjohn\s*deere\b/i,
    /\bkomatsu\b/i, /\bkubota\b/i, /\bvolvo\s*(ce|equip)/i, /\bcase\s*(equip|ce)\b/i,
    /\bsunbelt\s*rental/i, /\bequip.*rent/i, /\bcrane\b/i, /\bforklift\b/i,
    /\bscaffold/i, /\blift\s*(rental|equip)/i, /\bexcavat/i, /\bbulldoz/i,
  ]},
  { key: 'electrical', patterns: [
    /\belectrical\b/i, /\belectric\s*(supply|co)\b/i, /\bwire\s*(less|man|co)\b/i,
    /\bbreaker\b/i, /\bpanel\b/i, /\bconduit\b/i, /\bsquare\s*d\b/i,
    /\bleviton\b/i, /\bhubbell\b/i, /\bsiemens\b/i, /\bgrey\s*bar\b/i,
    /\beplumbing\b/i, /\barlington\s*ind/i,
  ]},
  { key: 'plumbing', patterns: [
    /\bplumbing\b/i, /\bferguson\b/i, /\bwatts\b/i, /\bniagara\b/i,
    /\brheem\b/i, /\braypak\b/i, /\bwater\s*heater\b/i, /\bpvc\b/i,
    /\bcopper\s*(pip|tub)/i, /\bfitting\b/i, /\bsupply\s*(house|plumb)/i,
  ]},
  { key: 'office', patterns: [
    /\bstaples\b/i, /\boffice\s*(depot|max)\b/i, /\bamazon\b/i, /\bups\b/i,
    /\bfedex\b/i, /\busps\b/i, /\bpostage\b/i, /\bprinting\b/i, /\bpaper\b/i,
    /\bquickbooks\b/i, /\badobe\b/i, /\bmicrosoft\b/i, /\bgoogle\s*(pay|workspace)/i,
    /\bteleph/i, /\bcell\s*phone\b/i, /\bverizon\b/i, /\bat&t\b/i, /\bt.mobile\b/i,
    /\binternet\b/i, /\bwifi\b/i, /\binsuranc\b/i, /\bbond\b/i,
  ]},
];

const CATEGORY_MAP = new Map(CATEGORIES.map(c => [c.key, c]));

export function inferCategory(vendorName?: string | null, _amount?: number | null): Category {
  if (!vendorName) return CATEGORY_MAP.get('other')!;

  for (const rule of CATEGORY_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(vendorName)) {
        return CATEGORY_MAP.get(rule.key) || CATEGORY_MAP.get('other')!;
      }
    }
  }

  return CATEGORY_MAP.get('other')!;
}

export function getCategoryByKey(key: string): Category {
  return CATEGORY_MAP.get(key) || CATEGORY_MAP.get('other')!;
}

export { CATEGORIES };
