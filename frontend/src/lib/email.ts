// The address is stored reversed and only assembled when a person asks for it
// (a click or real user input), so it never appears in the page source, the
// built bundle, or the DOM for scrapers that just fetch or render the page.
const USER = '1oulyrrek'
const DOMAIN = 'moc.liamg'

const reverse = (s: string) => [...s].reverse().join('')

export const getEmail = () => `${reverse(USER)}@${reverse(DOMAIN)}`

// Safe to show before the address is revealed.
export const maskedEmail = () => `${reverse(USER)} [at] ${reverse(DOMAIN)}`
