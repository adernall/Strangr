// Strict email validation
// Checks: format, real TLD, no disposable/fake domains

const BLOCKED_DOMAINS = [
  'mailinator.com','guerrillamail.com','tempmail.com','throwaway.email',
  'sharklasers.com','guerrillamailblock.com','grr.la','guerrillamail.info',
  'spam4.me','trashmail.com','yopmail.com','maildrop.cc','dispostable.com',
  'fakeinbox.com','tempr.email','discard.email','spamgourmet.com',
  'trashmail.me','mailnull.com','spamhereplease.com','10minutemail.com',
  '10minutemail.net','minutemail.com','temp-mail.org','getnada.com',
]

export function validateEmail(email) {
  if (!email || typeof email !== 'string') return 'Email is required.'

  const trimmed = email.trim().toLowerCase()

  // Basic length check
  if (trimmed.length > 254) return 'Email address is too long.'
  if (trimmed.length < 5)   return 'Email address is too short.'

  // Must have exactly one @
  const atCount = (trimmed.match(/@/g) || []).length
  if (atCount !== 1) return 'Enter a valid email address.'

  const [local, domain] = trimmed.split('@')

  // Local part checks
  if (!local || local.length === 0)  return 'Enter a valid email address.'
  if (local.length > 64)             return 'Email address is too long.'
  if (local.startsWith('.') || local.endsWith('.')) return 'Enter a valid email address.'

  // Domain checks
  if (!domain || domain.length === 0) return 'Enter a valid email address.'
  if (!domain.includes('.'))          return 'Enter a real email address with a valid domain.'
  if (domain.startsWith('.') || domain.endsWith('.')) return 'Enter a valid email address.'
  if (domain.startsWith('-') || domain.endsWith('-')) return 'Enter a valid email address.'

  // TLD must be at least 2 chars
  const tld = domain.split('.').pop()
  if (!tld || tld.length < 2) return 'Enter a real email address (e.g. you@gmail.com).'

  // Full regex — RFC 5322 simplified
  const regex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/
  if (!regex.test(trimmed)) return 'Enter a valid email address.'

  // Block disposable email domains
  if (BLOCKED_DOMAINS.includes(domain)) {
    return 'Disposable email addresses are not allowed. Use a real email.'
  }

  return null // null = valid
}
