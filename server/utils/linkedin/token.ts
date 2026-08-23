import type { LinkedinCompany } from '@prisma/client'

import prisma from '../prisma'
import { refreshAccessToken } from './api'

const EXPIRY_BUFFER_MS = 5 * 60 * 1000

type TokenBearingCompany = Pick<LinkedinCompany, 'id' | 'type' | 'accessToken' | 'refreshToken' | 'tokenExpiresAt'>

function getCredentials(type: string) {
  if (type === 'pages') {
    return {
      clientId: process.env.LINKEDIN_CLIENT_ID_COMPANY,
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET_COMPANY,
    }
  }
  return {
    clientId: process.env.LINKEDIN_CLIENT_ID_PERSONAL,
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET_PERSONAL,
  }
}

export async function getValidAccessToken(company: TokenBearingCompany): Promise<string> {
  if (!company.accessToken) throw new Error('No LinkedIn access token for company.')

  const stillValid = company.tokenExpiresAt && company.tokenExpiresAt.getTime() - EXPIRY_BUFFER_MS > Date.now()
  if (stillValid) return company.accessToken

  if (!company.refreshToken) {
    throw new Error('LinkedIn access token expired; reconnect the LinkedIn account')
  }

  const { clientId, clientSecret } = getCredentials(company.type)
  if (!clientId || !clientSecret) throw new Error('LinkedIn credentials not configured')

  const refreshed = await refreshAccessToken(company.refreshToken, clientId, clientSecret)

  await prisma.linkedinCompany.update({
    where: { id: company.id },
    data: {
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token ?? company.refreshToken,
      tokenExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
    },
  })

  return refreshed.access_token
}
