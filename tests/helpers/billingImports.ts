import { stubNitroImports } from './nitroImports'

/** The account-lock helpers every ledger function reaches through Nitro auto-imports. */
export const stubBillingAccountImports = () =>
  stubNitroImports(
    import('../../server/utils/billingAccount'),
    'lockBlog',
    'lockBillingAccount',
    'lockBlogAccount',
    'spendingAccountId',
    'updateAccountTerms',
    'poolWalletSelect',
    'poolOf',
    'rejectAgencyBilled',
  )
