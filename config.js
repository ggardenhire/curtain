import { isValidHttpUrl } from './links.js'   // reuse the exact same check

function getConfig() {
  const contactUrl = process.env.CONTACT_URL
  return {
    serverName: process.env.SERVER_NAME || 'curtain',
    contactUrl: isValidHttpUrl(contactUrl) ? contactUrl : null,   // null if unset/invalid
  }
}

export default getConfig
