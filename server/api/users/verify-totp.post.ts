import { authenticator } from 'otplib'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const isValid = authenticator.verify({
    token: body.token,
    secret: body.secret,
  })
  return { isValid }
})
