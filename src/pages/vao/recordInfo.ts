export type InfoTab = 'transaction' | 'property' | 'buyer' | 'survey'

export const INFO_TABS: [InfoTab, string][] = [
  ['transaction', 'Transaction Details'],
  ['property', 'Property Details'],
  ['buyer', 'Buyer Details'],
  ['survey', 'Survey Details'],
]

export const isInfoTab = (tab: string): tab is InfoTab => INFO_TABS.some(([key]) => key === tab)
