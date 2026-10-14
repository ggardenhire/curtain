import { isValidHttpUrl } from './links.js'   // reuse the exact same check

function getConfig() {
  const adminUrl = process.env.ADMIN_URL
  return {
    serverName: process.env.SERVER_NAME || 'curtain',
    adminUrl: isValidHttpUrl(adminUrl) ? adminUrl : null,   // null if unset/invalid
  }
}

export default getConfig
