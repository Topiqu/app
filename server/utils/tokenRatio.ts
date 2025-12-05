export const TOKEN_RATIO = Number(process.env.TOKEN_RATIO || 1)
if (isNaN(TOKEN_RATIO) || TOKEN_RATIO <= 0) {
  throw new Error('TOKEN_RATIO must be a positive number')
}
