import { ApiError, createApiClient, type PagedResult } from './api'

function getToken() {
  return localStorage.getItem('vndc_access_token') || sessionStorage.getItem('vndc_access_token')
}

export const api = createApiClient({
  baseUrl: (import.meta as unknown as { env: Record<string, string> }).env?.VITE_API_BASE_URL || 'http://localhost:8080/v1',
  getToken,
})

/** Convert amount in VNDC to wei (1 VNDC = 10^18 wei) */
export function toWei(amount: string | number): string {
  const numStr = String(amount).trim()
  
  // Split into integer and decimal parts
  const [intPart = '0', decPart = ''] = numStr.split('.')
  
  // Pad or truncate decimal part to 18 digits
  const paddedDec = (decPart + '0'.repeat(18)).slice(0, 18)
  
  // Combine: intPart + paddedDec
  const wei = intPart + paddedDec
  
  // Remove leading zeros and ensure it's a valid number
  const result = wei.replace(/^0+/, '') || '0'
  
  if (!/^\d+$/.test(result)) {
    throw new Error(`Invalid amount: ${amount}`)
  }
  
  console.log(`💱 toWei conversion: ${amount} VNDC → ${result} wei`)
  return result
}

// ─── Token ───────────────────────────────────────────────────────
export interface BalanceResponse {
  wallet: string
  on_chain: string
  pending: string
  available: string
  synced_at: string
}

export interface Transaction {
  id: string
  type: string
  from_wallet: string
  to_wallet: string
  amount: string
  status: string
  created_at: string
  updated_at: string
  nonce: string
  deadline: number
  signature: string
  tx_hash?: string
  batch_id?: string
  block_number?: number
  retry_count: number
  settled_at?: string
}

export async function getBalance(wallet: string): Promise<BalanceResponse> {
  if (!wallet) {
    return { wallet: '', on_chain: '0', pending: '0', available: '0', synced_at: new Date().toISOString() }
  }
  return api.request({ method: 'GET', path: `/tokens/balance/${wallet}`, auth: true })
}

/** GET /tokens/nonce/:wallet — Get the current on-chain EIP-712 nonce for a wallet */
export async function getNonce(wallet: string): Promise<{ wallet: string; nonce: number }> {
  if (!wallet) {
    throw new Error('Wallet address required')
  }
  const response = await api.request<{ wallet: string; nonce: number }>({ 
    method: 'GET', 
    path: `/tokens/nonce/${wallet}`, 
    auth: true 
  })
  
  // Ensure we have the correct response structure
  if (!response || typeof response !== 'object' || !('nonce' in response)) {
    console.error('❌ Invalid nonce response:', response)
    throw new Error('Invalid nonce response from server')
  }
  
  console.log(`🔢 getNonce for ${wallet}:`, response)
  return response
}

export async function getTransactions(page = 1, limit = 20): Promise<{ transactions: Transaction[]; total: number }> {
  console.log(`📋 Fetching transactions: page=${page}, limit=${limit}`)
  const result = await api.pagedRequest<Transaction>({ 
    method: 'GET', 
    path: '/transactions', 
    query: { page, page_size: limit },
    auth: true 
  })
  console.log('✓ Transactions fetched:', result)
  return {
    transactions: result.items,
    total: result.total
  }
}

/** GET /transactions?wallet=0x... — Get paginated transactions filtered by wallet */
export async function getTransactionsByWallet(
  wallet: string,
  page = 1,
  limit = 50,
): Promise<{ transactions: Transaction[]; total: number }> {
  const result = await api.pagedRequest<Transaction>({
    method: 'GET',
    path: '/transactions',
    query: { wallet, page, page_size: limit },
    auth: true,
  })
  return {
    transactions: result.items,
    total: result.total,
  }
}

export async function transferToken(
  from: string,
  to: string,
  amount: string,
  signature: string,
  typedData: Record<string, unknown>
) {
  const message = (typedData as Record<string, unknown>).message as Record<string, unknown>
  
  // Extract nonce and deadline from typed data message
  const nonce = String(message?.nonce ?? '0')
  const deadline = parseInt(String(message?.deadline ?? Math.floor(Date.now() / 1000) + 3600), 10)
  
  const body = {
    from_wallet: from,
    to_wallet: to,
    amount,
    nonce,
    deadline,
    signature,
  }
  
  console.log('📨 Calling API /tokens/transfer with body:', JSON.stringify(body, null, 2))
  
  const response = await api.request({
    method: 'POST',
    path: '/tokens/transfer',
    auth: true,
    body,
  })
  
  console.log('✅ Transfer response:', response)
  return response
}

// ─── User Lookup ──────────────────────────────────────────────────────────────

export interface PublicUserInfo {
  wallet_address: string
  username?: string
  full_name?: string
  avatar_uri?: string
  kyc_level: number
  kyc_verified: boolean
}

/** GET /users/lookup?username=xxx — find user by username (student ID) */
export async function lookupUserByUsername(username: string): Promise<PublicUserInfo> {
  return api.request({ method: 'GET', path: '/users/lookup', query: { username }, auth: true })
}

/** GET /users/lookup?wallet=0x... — find user by wallet address (check KYC) */
export async function lookupUserByWallet(wallet: string): Promise<PublicUserInfo | null> {
  try {
    return await api.request({ method: 'GET', path: '/users/lookup', query: { wallet }, auth: true })
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.code === 'NOT_FOUND')) return null
    const msg = String(err instanceof Error ? err.message : err)
    // 404 = wallet address not linked to any user — not an error, just return null
    if (/404|not found|kh[oô]ng t[iì]m th[aấ]y/i.test(msg)) return null
    // Re-throw other errors (network error, 500, etc.) so the caller can handle them
    throw err
  }
}

export interface DAOOrg {
  id: string
  name: string
  description: string
  founder_wallet: string
  governance_token: string
  quorum_bps: number
  voting_delay_sec: number
  voting_period_sec: number
  status: string
  created_at: string
}

export interface Proposal {
  id: string
  dao_id: string
  title: string
  description: string
  proposer_wallet: string
  for_votes: string
  against_votes: string
  abstain_votes: string
  status: 'PENDING' | 'ACTIVE' | 'SUCCEEDED' | 'DEFEATED' | 'QUEUED' | 'EXECUTED' | 'CANCELLED' | 'EXPIRED'
  start_time?: string
  end_time?: string
  eta?: string
  created_at: string
  user_vote?: 0 | 1 | 2  // 0=against, 1=for, 2=abstain
}

export interface CreateDAORequest {
  name: string
  description: string
  metadata_uri?: string
  governance_token: string
  quorum_bps?: number
  voting_delay_sec?: number
  voting_period_sec?: number
  timelock_sec?: number
}

export async function getDAOs(): Promise<{ daos: DAOOrg[] }> {
  const res = await api.request<DAOOrg[]>({ method: 'GET', path: '/dao', auth: true })
  return { daos: Array.isArray(res) ? res : [] }
}

export async function createDAO(body: CreateDAORequest) {
  return api.request<DAOOrg>({ method: 'POST', path: '/dao', auth: true, body })
}

export async function getProposals(daoId: string): Promise<{ proposals: Proposal[] }> {
  const res = await api.request<Proposal[]>({ method: 'GET', path: `/dao/${daoId}/proposals`, auth: true })
  return { proposals: Array.isArray(res) ? res : [] }
}

export async function createProposal(daoId: string, body: { title: string; description: string; voting_period_hours: number }) {
  return api.request({ method: 'POST', path: `/dao/${daoId}/proposals`, auth: true, body })
}

export async function setDAOStatus(daoId: string, active: boolean) {
  return api.request({ method: 'POST', path: `/dao/${daoId}/status`, auth: true, body: { active } })
}

/** support: 0=against, 1=for, 2=abstain */
export async function castVote(proposalId: string, vote: 'FOR' | 'AGAINST' | 'ABSTAIN') {
  const support = vote === 'FOR' ? 1 : vote === 'AGAINST' ? 0 : 2
  return api.request({ method: 'POST', path: `/dao/proposals/${proposalId}/vote`, auth: true, body: { support } })
}

export async function queueProposal(proposalId: string, totalVotingPower: string) {
  return api.request({
    method: 'POST',
    path: `/dao/proposals/${proposalId}/queue`,
    auth: true,
    body: { total_voting_power: totalVotingPower },
  })
}

export async function executeProposal(proposalId: string) {
  return api.request({ method: 'POST', path: `/dao/proposals/${proposalId}/execute`, auth: true, body: {} })
}

export async function cancelProposal(proposalId: string, reason?: string) {
  return api.request({
    method: 'POST',
    path: `/dao/proposals/${proposalId}/cancel`,
    auth: true,
    body: { reason: reason ?? '' },
  })
}

// ─── Task Manager (admin) ───────────────────────────────────────
export interface TaskAdminItem {
  id: string
  title: string
  description: string
  cluster: string
  task_type: string
  reward_amount: string
  max_slots: number
  current_slots: number
  remaining_slots: number
  status: string
  onchain_task_id: string
  contract_address: string
  created_at: string
  updated_at: string
}

export async function getTaskAdminList(page = 1, pageSize = 100): Promise<{ tasks: TaskAdminItem[]; total: number }> {
  const res = await api.request<{ tasks?: TaskAdminItem[]; pagination?: { total?: number } }>({
    method: 'GET',
    path: '/tasks',
    auth: true,
    query: { page, page_size: pageSize },
  })
  return {
    tasks: res?.tasks ?? [],
    total: res?.pagination?.total ?? 0,
  }
}

export async function createTaskAdmin(body: {
  title: string
  description: string
  cluster: 'LEARNING' | 'ACTIVITY'
  task_type: 'READING' | 'VIDEO' | 'QUIZ' | 'PHYSICAL'
  reward_amount: string
  max_slots: number
  onchain_task_id?: string
  contract_addr?: string
}) {
  return api.request<{ task: TaskAdminItem }>({ method: 'POST', path: '/tasks/admin', auth: true, body })
}

export async function pauseTaskAdmin(taskId: string) {
  return api.request<TaskAdminItem>({ method: 'POST', path: `/tasks/admin/${taskId}/pause`, auth: true, body: {} })
}

export async function resumeTaskAdmin(taskId: string) {
  return api.request<TaskAdminItem>({ method: 'POST', path: `/tasks/admin/${taskId}/resume`, auth: true, body: {} })
}

// ─── Marketplace ─────────────────────────────────────────────────
export interface NFTListing {
  id: string
  token_id: string
  seller_wallet: string
  buyer_wallet?: string
  nft_contract_address: string
  payment_token_address: string
  marketplace_contract_address: string
  amount: string
  price: string // wei string
  royalty_percentage: number
  status: 'ACTIVE' | 'SOLD' | 'CANCELLED'
  title: string
  description?: string
  image_uri?: string
  metadata_uri?: string
  category?: string
  onchain_listing_id?: string
  escrow_tx_hash?: string
  created_at: string
  updated_at: string
  sold_at?: string
}

export interface OwnedNFT {
  id: string
  token_id: string
  type: string
  tier?: string
  owner: string
  creator: string
  name: string
  description?: string
  image_uri?: string
  metadata_uri?: string
  supply: string
  tx_hash: string
  block_number: number
  created_at: string
  updated_at: string
}

export interface MarketplacePurchase {
  id: string
  listing_id: string
  buyer_wallet: string
  seller_wallet: string
  payment_token: string
  amount: string
  price: string // wei string
  status: 'PENDING_PAYMENT' | 'PENDING_COD' | 'CANCELLED' | 'RECEIVED' | 'PACKED' | 'SHIPPING' | 'DELIVERED' | 'COMPLETED' | 'FAILED'
  payment_method?: 'TOKEN' | 'COD'
  payment_tx_id?: string
  payment_tx_hash?: string
  finalize_tx_hash?: string
  failure_reason?: string
  onchain_purchase_id: string
  listing_title?: string
  listing_image_uri?: string
  listing_category?: string
  recipient_name?: string
  recipient_phone?: string
  shipping_address?: string
  delivery_note?: string
  expected_delivery?: string
  packed_at?: string
  shipping_at?: string
  delivered_at?: string
  created_at: string
  updated_at: string
}

export interface SellerProfile {
  wallet: string
  display_name: string
  avatar_uri?: string
  bio?: string
  total_listings: number
  active_listings: number
  delivered_orders: number
  total_revenue_wei: string
  average_rating_text: string
}

export async function getListings(page = 1, limit = 12, status: NFTListing['status'] | '' = 'ACTIVE'): Promise<{ items: NFTListing[]; total: number }> {
  const result = await api.pagedRequest<NFTListing>({
    method: 'GET', path: '/marketplace/listings', query: { page, limit, status }, auth: true,
  })
  return { items: result.items, total: result.total }
}

export async function getMyListings(wallet: string, page = 1, limit = 20, status: NFTListing['status'] | '' = ''): Promise<{ items: NFTListing[]; total: number }> {
  const result = await api.pagedRequest<NFTListing>({
    method: 'GET', path: '/marketplace/listings', query: { seller_wallet: wallet, page, limit, status }, auth: true,
  })
  return { items: result.items, total: result.total }
}

export async function getMyNFTs(wallet: string, page = 1, limit = 20): Promise<{ items: OwnedNFT[]; total: number }> {
  if (!wallet) {
    return { items: [], total: 0 }
  }
  const result = await api.pagedRequest<OwnedNFT>({
    method: 'GET', path: `/marketplace/nfts/${wallet}`, query: { page, limit }, auth: true,
  })
  return { items: result.items, total: result.total }
}

export async function getListing(listingId: string): Promise<NFTListing> {
  return api.request({ method: 'GET', path: `/marketplace/listings/${listingId}`, auth: true })
}

export async function listNFT(params: {
  title: string
  token_id?: string
  amount: string
  price: string // wei
  royalty_percentage?: number
  description?: string
  image_uri?: string
  metadata_uri?: string
  category?: string
  nft_contract_address?: string
  payment_token_address?: string
  approval_deadline?: number
  approval_signature?: string
}) {
  return api.request({ method: 'POST', path: '/marketplace/listings', auth: true, body: params })
}

export async function mintAndListNFT(params: {
  title: string
  description?: string
  image_uri: string
  metadata_uri?: string
  payment_token_address?: string
  nft_contract_address?: string
  royalty_percentage?: number
}) {
  return api.request({ method: 'POST', path: '/marketplace/nft-shop/mint-and-list', auth: true, body: params })
}

export async function adminMintCollectionToken(to: string, tokenURI: string): Promise<{ token_id: string; tx_hash: string }> {
  return api.request({
    method: 'POST',
    path: '/marketplace/admin/collection/mint',
    auth: true,
    body: { to, token_uri: tokenURI },
  })
}

export async function adminApproveCollectionToken(spender: string, tokenId: string): Promise<{ token_id: string; tx_hash: string }> {
  return api.request({
    method: 'POST',
    path: '/marketplace/admin/collection/approve',
    auth: true,
    body: { spender, token_id: tokenId },
  })
}

export async function updateListingPrice(listingId: string, price: string) {
  return api.request({ method: 'POST', path: `/marketplace/listings/${listingId}/price`, auth: true, body: { price } })
}

export async function cancelListing(listingId: string) {
  return api.request({ method: 'POST', path: `/marketplace/listings/${listingId}/cancel`, auth: true })
}

export async function buyNFT(listingId: string, body: {
  from_wallet: string
  payment_method?: 'TOKEN' | 'COD'
  nonce?: string
  deadline?: number
  signature?: string
  recipient_name?: string
  recipient_phone?: string
  shipping_address?: string
  delivery_note?: string
}) {
  return api.request({ method: 'POST', path: `/marketplace/listings/${listingId}/buy`, auth: true, body })
}

export async function getMyPurchases(page = 1, limit = 20): Promise<{ items: MarketplacePurchase[]; total: number }> {
  const result = await api.pagedRequest<MarketplacePurchase>({
    method: 'GET', path: '/marketplace/purchases', query: { page, limit }, auth: true,
  })
  return { items: result.items, total: result.total }
}

export async function cancelMyPurchase(orderId: string) {
  return api.request({ method: 'POST', path: `/marketplace/purchases/${orderId}/cancel`, auth: true })
}

export async function getShopProfile(wallet: string): Promise<SellerProfile> {
  return api.request({ method: 'GET', path: `/marketplace/shops/${wallet}`, auth: true })
}

export async function getSellerOrders(page = 1, limit = 20): Promise<{ items: MarketplacePurchase[]; total: number }> {
  const result = await api.pagedRequest<MarketplacePurchase>({
    method: 'GET', path: '/marketplace/seller/orders', query: { page, limit }, auth: true,
  })
  return { items: result.items, total: result.total }
}

export async function updateSellerOrderStatus(orderId: string, status: 'RECEIVED' | 'PACKED' | 'SHIPPING' | 'DELIVERED', expected_delivery_hours?: number) {
  return api.request({
    method: 'POST',
    path: `/marketplace/seller/orders/${orderId}/status`,
    auth: true,
    body: { status, expected_delivery_hours },
  })
}

export async function cancelSellerOrder(orderId: string, body?: {
  from_wallet?: string
  nonce?: string
  deadline?: number
  signature?: string
}) {
  return api.request({
    method: 'POST',
    path: `/marketplace/seller/orders/${orderId}/cancel`,
    auth: true,
    body: body ?? {},
  })
}

// ─── Fundraising ─────────────────────────────────────────────────
export interface FundActivity {
  id: string
  title: string
  description: string
  image_uri?: string
  image_url?: string
  category: string
  owner_wallet: string
  deputy_wallets: string[]
  status: 'DRAFT' | 'ACTIVE' | 'CLOSED' | 'CANCELLED'
  currency: string
  onchain_pot_id: string
  contract_address: string
  onchain_init_tx_hash: string
  target_amount: string
  total_raised: string
  total_spent: string
  available_balance: string
  starts_at?: string
  ends_at?: string
  created_at: string
  updated_at: string
}

export interface FundLedgerEntry {
  id: string
  activity_id: string
  entry_type: 'CONTRIBUTION' | 'EXPENSE' | 'ADJUSTMENT'
  status: 'PENDING' | 'COMPLETED' | 'VOIDED'
  amount: string
  actor_wallet: string
  counterparty_wallet: string
  note: string
  reference: string
  balance_after: string
  created_at: string
  updated_at: string
}

export interface FundSummary {
  activity_id: string
  status: string
  category: string
  target_amount: string
  currency: string
  total_raised: string
  total_spent: string
  available_balance: string
  contribution_count: number
  expense_count: number
}

export interface FundContractActionResponse {
  action: 'CREATE_POT' | 'SET_STATUS' | 'RECORD_CONTRIBUTION' | 'SPEND'
  tx_hash: string
  activity: FundActivity
  ledger?: FundLedgerEntry
}

export async function getFunds(
  page = 1, limit = 20,
  status?: string, category?: string, search?: string,
): Promise<{ items: FundActivity[]; total: number }> {
  const result = await api.pagedRequest<FundActivity>({
    method: 'GET', path: '/funds',
    query: { page, page_size: limit, ...(status ? { status } : {}), ...(category ? { category } : {}), ...(search ? { search } : {}) },
    auth: false,
  })
  return { items: result.items, total: result.total }
}

export async function getMyFunds(ownerWallet: string, page = 1, limit = 50): Promise<{ items: FundActivity[]; total: number }> {
  const result = await api.pagedRequest<FundActivity>({
    method: 'GET', path: '/funds',
    query: { page, page_size: limit, owner_wallet: ownerWallet },
    auth: false,
  })
  return { items: result.items, total: result.total }
}

export async function getFund(id: string): Promise<FundActivity> {
  return api.request({ method: 'GET', path: `/funds/${id}`, auth: false })
}

export async function getFundSummary(id: string): Promise<FundSummary> {
  return api.request({ method: 'GET', path: `/funds/${id}/summary`, auth: false })
}

export async function getFundLedger(id: string, page = 1, limit = 20): Promise<{ items: FundLedgerEntry[]; total: number }> {
  const result = await api.pagedRequest<FundLedgerEntry>({
    method: 'GET', path: `/funds/${id}/ledger`,
    query: { page, page_size: limit },
    auth: false,
  })
  return { items: result.items, total: result.total }
}

export async function createFund(body: {
  title: string; description?: string; category: string
  image_uri?: string
  image_url?: string
  target_amount: string; currency?: string
  deputy_wallets?: string[]; starts_at?: string; ends_at?: string
}): Promise<FundActivity> {
  return api.request({ method: 'POST', path: '/funds', auth: true, body })
}

export async function updateFund(id: string, body: {
  title?: string; description?: string; category?: string
  image_uri?: string
  target_amount?: string; currency?: string
  starts_at?: string; ends_at?: string
}): Promise<FundActivity> {
  return api.request({ method: 'PUT', path: `/funds/${id}`, auth: true, body })
}

export async function closeFund(id: string): Promise<FundActivity> {
  return api.request({ method: 'POST', path: `/funds/${id}/close`, auth: true })
}

export async function reopenFund(id: string): Promise<FundActivity> {
  return api.request({ method: 'POST', path: `/funds/${id}/reopen`, auth: true })
}

export async function addFundDeputy(id: string, wallet: string): Promise<FundActivity> {
  return api.request({ method: 'POST', path: `/funds/${id}/deputies`, auth: true, body: { wallet } })
}

export async function removeFundDeputy(id: string, wallet: string): Promise<FundActivity> {
  return api.request({ method: 'DELETE', path: `/funds/${id}/deputies/${wallet}`, auth: true })
}

export async function recordContribution(id: string, body: {
  amount: string; from_wallet: string
  nonce: string; deadline: number; signature: string
  note?: string; contributor_wallet?: string
}): Promise<FundLedgerEntry> {
  return api.request({ method: 'POST', path: `/funds/${id}/contributions`, auth: true, body })
}

export async function recordExpense(id: string, body: {
  amount: string; note: string; beneficiary_wallet: string; reference?: string
}): Promise<FundLedgerEntry> {
  return api.request({ method: 'POST', path: `/funds/${id}/expenses`, auth: true, body })
}

export async function createFundPotOnChain(id: string): Promise<FundContractActionResponse> {
  return api.request({ method: 'POST', path: `/funds/${id}/contract/create-pot`, auth: true })
}

export async function setFundContractStatus(
  id: string,
  status: 'DRAFT' | 'ACTIVE' | 'CLOSED' | 'CANCELLED',
): Promise<FundContractActionResponse> {
  return api.request({ method: 'POST', path: `/funds/${id}/contract/status`, auth: true, body: { status } })
}

export async function recordFundContractContribution(id: string, body: {
  contributor_wallet: string
  amount: string
  transfer_tx_hash: string
  note?: string
  reference?: string
}): Promise<FundContractActionResponse> {
  return api.request({ method: 'POST', path: `/funds/${id}/contract/record-contribution`, auth: true, body })
}

export async function spendFundContract(id: string, body: {
  beneficiary_wallet: string
  amount: string
  note: string
  reference?: string
}): Promise<FundContractActionResponse> {
  return api.request({ method: 'POST', path: `/funds/${id}/contract/spend`, auth: true, body })
}

// ─── Ticketing ──────────────────────────────────────────────────────
export type TicketCategory =
  | 'EVENT_SEAT'
  | 'RETAKE_EXAM'
  | 'GRADE_UPGRADE'
  | 'COMPUTER_RENTAL'
  | 'PARKING_MONTHLY'
  | 'OTHER'

export interface ServiceTicketProduct {
  id: string
  code: string
  category: TicketCategory
  ticket_type: string
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED'
  sale_mode: 'ALWAYS_ON' | 'WINDOWED'
  stock_mode: 'LIMITED' | 'UNLIMITED'
  title: string
  description?: string
  image_uri?: string
  metadata_uri?: string
  metadata?: Record<string, unknown>
  creator_wallet: string
  seller_wallet: string
  currency_token: string
  unit_price: string
  total_stock: number
  available_stock: number
  reserved_stock: number
  sold_stock: number
  sale_starts_at?: string
  sale_ends_at?: string
  use_valid_from?: string
  use_valid_until?: string
  use_duration_days?: number
  allowed_scanners?: string[]
  created_at: string
  updated_at: string
}

export interface ServiceTicketPurchase {
  id: string
  product_id: string
  buyer_wallet: string
  seller_wallet: string
  quantity: number
  unit_price: string
  total_price: string
  currency_token: string
  status: 'PENDING_PAYMENT' | 'COMPLETED' | 'FAILED' | 'USED' | 'EXPIRED'
  ticket_code: string
  payment_tx_id?: string
  payment_tx_hash?: string
  failure_reason?: string
  expires_at?: string
  completed_at?: string
  used_at?: string
  used_by_wallet?: string
  used_note?: string
  created_at: string
  updated_at: string
}

export interface ScanTicketResult {
  result: 'SUCCESS' | 'ALREADY_USED' | 'EXPIRED' | 'INVALID_CODE' | 'UNAUTHORIZED_SCANNER' | 'NOT_FOUND' | 'PRODUCT_INACTIVE'
  purchase?: ServiceTicketPurchase
  product?: ServiceTicketProduct
  used_at?: string
  used_by_wallet?: string
}

export interface ServiceTicketScanLog {
  id: string
  purchase_id?: string
  product_id?: string
  ticket_code: string
  scanner_wallet: string
  result: ScanTicketResult['result']
  note?: string
  location?: string
  device_id?: string
  buyer_wallet?: string
  product_title?: string
  ticket_type?: string
  created_at: string
  updated_at: string
}

export async function getTicketProducts(params?: {
  category?: string
  status?: string
  sale_mode?: string
  search?: string
  page?: number
  page_size?: number
}): Promise<{ items: ServiceTicketProduct[]; total: number }> {
  return api.pagedRequest<ServiceTicketProduct>({ method: 'GET', path: '/tickets/products', query: params })
}

export async function getTicketProduct(id: string): Promise<ServiceTicketProduct> {
  return api.request({ method: 'GET', path: `/tickets/products/${id}` })
}

export async function createTicketProduct(body: {
  code?: string
  category: string
  ticket_type: string
  title: string
  unit_price: string
  description?: string
  image_uri?: string
  seller_wallet?: string
  currency_token?: string
  sale_mode?: string
  sale_starts_at?: number
  sale_ends_at?: number
  stock_mode?: string
  total_stock?: number
  use_valid_from?: number
  use_valid_until?: number
  use_duration_days?: number
  allowed_scanners?: string[]
}): Promise<ServiceTicketProduct> {
  return api.request({ method: 'POST', path: '/tickets/products', auth: true, body })
}

export async function updateTicketProduct(
  id: string,
  body: Partial<{
    status: string
    title: string
    description: string
    image_uri: string
    unit_price: string
    total_stock: number
    sale_starts_at: number
    sale_ends_at: number
    allowed_scanners: string[]
  }>
): Promise<ServiceTicketProduct> {
  return api.request({ method: 'PUT', path: `/tickets/products/${id}`, auth: true, body })
}

export async function purchaseTicket(
  productId: string,
  body: {
    from_wallet: string
    quantity?: number
    nonce: string
    deadline: number
    signature: string
  }
): Promise<ServiceTicketPurchase> {
  return api.request({ method: 'POST', path: `/tickets/products/${productId}/purchase`, auth: true, body })
}

export async function getMyTicketPurchases(params?: {
  status?: string
  product_id?: string
  page?: number
  page_size?: number
}): Promise<{ items: ServiceTicketPurchase[]; total: number }> {
  return api.pagedRequest<ServiceTicketPurchase>({ method: 'GET', path: '/tickets/purchases', query: params, auth: true })
}

export async function getTicketPurchase(id: string): Promise<ServiceTicketPurchase> {
  return api.request({ method: 'GET', path: `/tickets/purchases/${id}`, auth: true })
}

export async function verifyTicket(purchaseId: string, ticketCode: string): Promise<{ valid: boolean; reason?: string; purchase?: ServiceTicketPurchase }> {
  return api.request({ method: 'POST', path: `/tickets/purchases/${purchaseId}/verify`, auth: true, body: { ticket_code: ticketCode } })
}

export async function scanTicketByCode(body: {
  ticket_code: string
  scanner_wallet: string
  location?: string
  note?: string
  device_id?: string
}): Promise<ScanTicketResult> {
  return api.request({ method: 'POST', path: '/tickets/scan', auth: true, body })
}

export async function getTicketScanLogs(params?: {
  product_id?: string
  result?: string
  page?: number
  page_size?: number
}): Promise<{ items: ServiceTicketScanLog[]; total: number }> {
  return api.pagedRequest<ServiceTicketScanLog>({ method: 'GET', path: '/tickets/scan/logs', query: params, auth: true })
}

// ─── Activities ──────────────────────────────────────────────────

export interface PointsPerRating {
  poor: number
  average: number
  good: number
}

export interface QuizQuestion {
  id: string
  question: string
  options: string[]
  correct_index: number
}

export interface Activity {
  id: string
  title: string
  description: string
  cluster: 'LEARNING' | 'ACTIVITY'
  activity_type: 'READING' | 'VIDEO' | 'QUIZ' | 'PHYSICAL'
  points_per_rating: PointsPerRating
  created_by: string
  status: 'ACTIVE' | 'ARCHIVED' | 'DRAFT'
  max_slots?: number
  expires_at?: string
  event_ends_at?: string
  content_url?: string
  min_time_seconds?: number
  min_quiz_score?: number
  target_classes?: string[]   // empty = visible to all classes
  quiz_questions?: QuizQuestion[]
  created_at: string
  updated_at: string
}

export interface EditHistoryEntry {
  changed_by: string
  old_rating: string
  new_rating: string
  old_points: number
  new_points: number
  changed_at: string
}

export interface ActivityRecord {
  record_id: string
  activity_id: string
  activity_title?: string  // populated when listing student's own records
  student_address: string
  lecturer_address: string
  rating: 'POOR' | 'AVERAGE' | 'GOOD'
  points: number
  status: 'PENDING' | 'CONFIRMED' | 'LOCKED'
  can_edit: boolean
  time_remaining: number   // seconds remaining in edit window
  edit_deadline: string
  created_at: string
  updated_at: string
}

export interface QuizQuestionInput {
  id: string
  question: string
  options: string[]        // exactly 4 options
  correct_index: number    // 0-3
}

export interface CreateActivityInput {
  title: string
  description: string
  cluster: string
  activity_type?: string  // optional for ACTIVITY cluster
  points_average: number
  points_good: number
  points_poor?: number
  max_slots?: number
  expires_at?: string
  event_ends_at?: string
  content_url?: string
  min_time_seconds?: number
  min_quiz_score?: number
  target_classes?: string[]   // empty = all classes
  quiz_questions?: QuizQuestionInput[]
}

export interface RecordActivityInput {
  student_address: string
  rating: 'POOR' | 'AVERAGE' | 'GOOD'
  note?: string
}

export interface EditActivityRecordInput {
  rating: 'POOR' | 'AVERAGE' | 'GOOD'
  note?: string
}

// ─── Activity API calls ───────────────────────────────────────────

export async function getActivities(): Promise<{ activities: Activity[]; total: number }> {
  return api.request({ method: 'GET', path: '/activities', auth: true })
}

export async function getActivity(activityId: string): Promise<Activity> {
  return api.request({ method: 'GET', path: `/activities/${activityId}`, auth: true })
}

export async function createActivity(body: CreateActivityInput): Promise<Activity> {
  return api.request({ method: 'POST', path: '/activities', body, auth: true })
}

export async function getMyActivityRecords(
  page = 1,
  limit = 10,
): Promise<{ records: ActivityRecord[]; total: number; page: number; limit: number }> {
  return api.request({ method: 'GET', path: '/activities/my-records', query: { page, limit }, auth: true })
}

export async function getActivityRecords(activityId: string): Promise<{ records: ActivityRecord[]; total: number }> {
  return api.request({ method: 'GET', path: `/activities/${activityId}/records`, auth: true })
}

export async function recordActivity(activityId: string, body: RecordActivityInput): Promise<ActivityRecord> {
  return api.request({ method: 'POST', path: `/activities/${activityId}/record`, body, auth: true })
}

export async function editActivityRecord(
  activityId: string,
  recordId: string,
  body: EditActivityRecordInput,
): Promise<ActivityRecord> {
  return api.request({ method: 'PATCH', path: `/activities/${activityId}/record/${recordId}`, body, auth: true })
}

// Legacy aliases kept for backward compat (unused now, will be removed)
/** @deprecated use getMyActivityRecords */
export async function getMyParticipations() { return getMyActivityRecords() }
/** @deprecated use Activity */
export type Participation = ActivityRecord

// ─── Activity points leaderboard ──────────────────────────────────────────────

export interface RankEntry {
  rank: number
  student_wallet: string
  student_name?: string
  avatar_uri?: string
  class?: string
  activity_points: number
}

export interface RankingResponse {
  entries: RankEntry[]
  total: number
  page: number
  limit: number
  total_pages: number
}

export async function getActivityRanking(
  page = 1,
  limit = 20,
): Promise<RankingResponse> {
  return api.request({ method: 'GET', path: '/activities/ranking', query: { page, limit }, auth: true })
}

// ─── Enrollment types (ACTIVITY cluster) ──────────────────────────────────────

export interface Enrollment {
  id: string
  activity_id: string
  student_address: string
  status: 'REGISTERED' | 'ATTENDED' | 'ABSENT' | 'CANCELLED'
  enrolled_at: string
  updated_at: string
}

export interface EvaluateEnrollmentInput {
  rating: 'POOR' | 'AVERAGE' | 'GOOD'
}

// ─── Learning submission types (LEARNING cluster) ─────────────────────────────

export interface QuizAnswerItem {
  question_id: string
  answer_index: number
}

export interface SubmitLearningInput {
  time_spent_seconds: number
  quiz_answers?: QuizAnswerItem[]
}

export interface SubmitLearningResponse {
  record_id: string
  activity_id: string
  rating: 'POOR' | 'AVERAGE' | 'GOOD'
  points: number
  quiz_score?: number
  quiz_passed?: boolean
  message: string
}

// ─── Enrollment API calls ──────────────────────────────────────────────────────

export async function enrollActivity(activityId: string): Promise<Enrollment> {
  return api.request({ method: 'POST', path: `/activities/${activityId}/enroll`, auth: true })
}

export async function cancelActivityEnrollment(activityId: string): Promise<Enrollment> {
  return api.request({ method: 'POST', path: `/activities/${activityId}/cancel-enroll`, auth: true })
}

export async function getMyEnrollments(): Promise<{ enrollments: Enrollment[]; total: number }> {
  return api.request({ method: 'GET', path: '/activities/my-enrollments', auth: true })
}

export async function getActivityEnrollments(activityId: string): Promise<{ enrollments: Enrollment[]; total: number }> {
  return api.request({ method: 'GET', path: `/activities/${activityId}/enrollments`, auth: true })
}

export async function evaluateEnrollment(
  activityId: string,
  enrollmentId: string,
  body: EvaluateEnrollmentInput,
): Promise<ActivityRecord> {
  return api.request({ method: 'POST', path: `/activities/${activityId}/enrollments/${enrollmentId}/evaluate`, body, auth: true })
}

// ─── Learning submission API calls ────────────────────────────────────────────

export async function submitLearning(
  activityId: string,
  body: SubmitLearningInput,
): Promise<SubmitLearningResponse> {
  return api.request({ method: 'POST', path: `/activities/${activityId}/submit-learning`, body, auth: true })
}

// ─── User Profile ─────────────────────────────────────────────────

export interface UserKYCDocument {
  type: string
  document_ref: string
  submitted_at: string
  reviewed_at?: string
  review_note?: string
}

export interface UserProfile {
  id: string
  wallet_address: string
  class?: string
  username?: string
  email?: string
  phone?: string
  full_name?: string
  avatar_uri?: string
  bio?: string
  date_of_birth?: string
  country?: string
  language?: string
  timezone?: string
  status: 'ACTIVE' | 'SUSPENDED' | 'BANNED' | 'PENDING_VERIFICATION' | 'DEACTIVATED'
  email_verified: boolean
  phone_verified: boolean
  two_factor_enabled: boolean
  two_factor_method?: string
  kyc_status: 'NONE' | 'PENDING' | 'VERIFIED' | 'REJECTED'
  kyc_level: number
  kyc_documents?: UserKYCDocument[]
  kyc_verified_at?: string
  roles: string[]
  permissions?: string[]
  referral_code?: string
  referred_by?: string
  activity_points: number
  login_count: number
  last_login_at?: string
  last_login_ip?: string
  tags?: string[]
  metadata?: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface UpdateProfileInput {
  class?: string
  username?: string
  full_name?: string
  bio?: string
  avatar_uri?: string
  country?: string
  language?: string
  timezone?: string
  date_of_birth?: string
  metadata?: Record<string, unknown>
}

export interface UserPreferences {
  notify_login: boolean
  notify_kyc: boolean
  notify_transfer: boolean
  notify_reward: boolean
  notify_marketing: boolean
  profile_public: boolean
  show_login_stats: boolean
  updated_at: string
}

export type AppNotificationType = 'info' | 'success' | 'warning' | 'error'

export interface AppNotification {
  id: string
  type: AppNotificationType
  icon: string
  title: string
  message: string
  source: string
  target_scope: 'ALL' | 'USER'
  target_user_id?: string
  expires_at?: string
  created_at: string
}

export interface CreateAppNotificationInput {
  type: AppNotificationType
  icon?: string
  title: string
  message: string
  source?: string
  target_scope?: 'ALL' | 'USER'
  target_user_id?: string
  expires_at?: string
}

export interface AuditLogEntry {
  id: string
  event_type: string
  actor_id: string
  actor_wallet: string
  target_id?: string
  ip_address: string
  user_agent?: string
  session_id?: string
  details?: Record<string, unknown>
  occurred_at: string
}

export interface ReferralInfo {
  referral_code: string
  referred_count: number
  referred_by?: string
  referral_reward: number
  created_at: string
}

export interface ReferralRecord {
  wallet_address: string
  joined_at: string
  status: string
}

/** GET /users/me — Returns the authenticated user's full profile */
export async function getMyProfile(): Promise<UserProfile> {
  return api.request({ method: 'GET', path: '/users/me', auth: true })
}

/** PATCH /users/me — Partially updates the authenticated user's profile */
export async function updateMyProfile(data: UpdateProfileInput): Promise<UserProfile> {
  return api.request({ method: 'PUT', path: '/users/me', auth: true, body: data })
}

/** PUT /users/me/email — Request an email address change */
export async function requestEmailChange(email: string): Promise<{ message: string }> {
  return api.request({ method: 'PUT', path: '/users/me/email', auth: true, body: { email } })
}

/** GET /users/me/preferences — Get notification and privacy settings */
export async function getPreferences(): Promise<UserPreferences> {
  return api.request({ method: 'GET', path: '/users/me/preferences', auth: true })
}

/** PUT /users/me/preferences — Update notification and privacy settings */
export async function updatePreferences(data: Partial<Omit<UserPreferences, 'updated_at'>>): Promise<UserPreferences> {
  return api.request({ method: 'PUT', path: '/users/me/preferences', auth: true, body: data })
}

/** GET /users/me/notifications — Get non-realtime notifications for current user (server-side filtered by expiry). */
export async function getMyNotifications(page = 1, pageSize = 20): Promise<{ items: AppNotification[]; total: number }> {
  const result = await api.pagedRequest<AppNotification>({
    method: 'GET',
    path: '/users/me/notifications',
    query: { page, page_size: pageSize },
    auth: true,
  })
  return { items: result.items, total: result.total }
}

/** GET /admin/notifications — List notifications created by admin panel. */
export async function adminListNotifications(page = 1, pageSize = 50, includeExpired = true, type?: AppNotificationType): Promise<{ items: AppNotification[]; total: number }> {
  const result = await api.pagedRequest<AppNotification>({
    method: 'GET',
    path: '/admin/notifications',
    query: { page, page_size: pageSize, include_expired: includeExpired, type },
    auth: true,
  })
  return { items: result.items, total: result.total }
}

/** POST /admin/notifications — Create a persisted notification for users. */
export async function adminCreateNotification(input: CreateAppNotificationInput): Promise<AppNotification> {
  return api.request<AppNotification>({
    method: 'POST',
    path: '/admin/notifications',
    auth: true,
    body: input,
  })
}

/** GET /users/me/referral — Get referral code and stats */
export async function getReferralInfo(): Promise<ReferralInfo> {
  return api.request({ method: 'GET', path: '/users/me/referral', auth: true })
}

/** GET /users/me/referral/list — Get list of referred users */
export async function listReferrals(): Promise<{ referrals: ReferralRecord[]; total: number }> {
  return api.request({ method: 'GET', path: '/users/me/referral/list', auth: true })
}

/** POST /users/me/2fa/backup-codes — Regenerate backup codes */
export async function generateBackupCodes(): Promise<{ backup_codes: string[]; generated_at: string; message: string }> {
  return api.request({ method: 'POST', path: '/users/me/2fa/backup-codes', auth: true })
}

/** GET /users/me/audit-logs — Get security audit trail */
export async function getAuditLogs(page = 1, pageSize = 20): Promise<{ items: AuditLogEntry[]; total: number }> {
  const result = await api.pagedRequest<AuditLogEntry>({ method: 'GET', path: '/users/me/audit-logs', query: { page, page_size: pageSize }, auth: true })
  return { items: result.items, total: result.total }
}

/** POST /users/me/phone/request — Request phone number verification OTP */
export async function requestPhoneChange(phone: string): Promise<{ message: string }> {
  return api.request({ method: 'POST', path: '/users/me/phone/request', auth: true, body: { phone } })
}

/** POST /users/me/email/verify — Verify email with token received in mailbox */
export async function verifyEmail(token: string): Promise<{ message: string }> {
  return api.request({ method: 'POST', path: '/users/me/email/verify', auth: true, body: { token } })
}

/** POST /users/me/phone/verify — Verify phone number with OTP code */
export async function verifyPhone(code: string): Promise<{ message: string }> {
  return api.request({ method: 'POST', path: '/users/me/phone/verify', auth: true, body: { code } })
}

/** POST /users/me/deactivate — Deactivate account */
export async function deactivateAccount(reason?: string): Promise<{ message: string }> {
  return api.request({ method: 'POST', path: '/users/me/deactivate', auth: true, body: { reason } })
}

// ─── KYC ──────────────────────────────────────────────────────────────────────

export interface KYCLevel1Status {
  ready: boolean
  has_username: boolean
  email_verified: boolean
  phone_verified: boolean
  current_kyc_level: number
  message?: string
}

export interface KYCSubmission {
  id: string
  user_id: string
  wallet_address: string
  level: number
  student_card_url: string
  selfie_url: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  reviewed_by?: string
  review_note?: string
  reviewed_at?: string
  created_at: string
}

/** GET /users/me/kyc/status — Get KYC Level 1 requirements status */
export async function getKYCLevel1Status(): Promise<KYCLevel1Status> {
  return api.request({ method: 'GET', path: '/users/me/kyc/status', auth: true })
}

/** POST /users/me/kyc/level1 — Auto-approve KYC Level 1 when all requirements are met */
export async function submitKYCLevel1(): Promise<{ success: boolean; message: string }> {
  return api.request({ method: 'POST', path: '/users/me/kyc/level1', auth: true })
}

/** POST /users/me/kyc/level2 — Submit Level 2 KYC for admin review */
export async function submitKYCLevel2(studentCardUrl: string, selfieUrl: string): Promise<{ success: boolean; message: string }> {
  return api.request({ method: 'POST', path: '/users/me/kyc/level2', auth: true, body: { student_card_url: studentCardUrl, selfie_url: selfieUrl } })
}

/** POST /users/me/kyc/upload — Demo upload: returns a URL for the document */
export async function uploadKYCDocument(fileName: string): Promise<{ success: boolean; url: string; message: string }> {
  return api.request({ method: 'POST', path: '/users/me/kyc/upload', auth: true, body: { file_name: fileName } })
}



export interface AdminUserListParams {
  status?: string
  kyc_status?: string
  role?: string
  search?: string
  page?: number
  page_size?: number
}

export async function adminListUsers(params?: AdminUserListParams): Promise<{ items: UserProfile[]; total: number }> {
  const result = await api.pagedRequest<UserProfile>({ method: 'GET', path: '/users', query: (params ?? {}) as Record<string, string | number | boolean | null | undefined>, auth: true })
  return { items: result.items, total: result.total }
}

export async function adminGetUser(id: string): Promise<UserProfile> {
  return api.request({ method: 'GET', path: `/users/${id}`, auth: true })
}

export async function adminSuspendUser(id: string, reason: string): Promise<{ message: string }> {
  return api.request({ method: 'POST', path: `/users/${id}/suspend`, auth: true, body: { reason } })
}

export async function adminUnsuspendUser(id: string): Promise<{ message: string }> {
  return api.request({ method: 'POST', path: `/users/${id}/unsuspend`, auth: true })
}

export async function adminAssignRole(id: string, role: string): Promise<{ message: string }> {
  return api.request({ method: 'POST', path: `/users/${id}/roles`, auth: true, body: { role } })
}

export async function adminRemoveRole(id: string, role: string): Promise<{ message: string }> {
  return api.request({ method: 'DELETE', path: `/users/${id}/roles/${role}`, auth: true })
}

export async function adminApproveKYC(id: string, level: number): Promise<{ message: string }> {
  return api.request({ method: 'POST', path: `/users/${id}/kyc/approve`, auth: true, body: { level } })
}

// ─── Admin: KYC Level 2 Submissions ─────────────────────────────

export interface AdminKYCSubmissionListParams {
  status?: string
  page?: number
  page_size?: number
}

/** GET /users/kyc/submissions — List Level 2 KYC submissions (admin) */
export async function adminListKYCSubmissions(params?: AdminKYCSubmissionListParams): Promise<PagedResult<KYCSubmission>> {
  const qs = params ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])).toString() : ''
  return api.request({ method: 'GET', path: `/users/kyc/submissions${qs}`, auth: true })
}

/** POST /users/kyc/submissions/:id/review — Approve or reject a Level 2 KYC submission (admin) */
export async function adminReviewKYCSubmission(id: string, approve: boolean, note?: string): Promise<{ success: boolean; message: string }> {
  return api.request({ method: 'POST', path: `/users/kyc/submissions/${id}/review`, auth: true, body: { approve, note } })
}

// ─── Admin: Platform Statistics ──────────────────────────────────

export interface AdminStats {
  total_users: number
  kyc_level0: number
  kyc_level1: number
  kyc_level2: number
  active_today: number
  suspended_users: number
  new_users_this_week: number
  pending_txs: number
  processing_txs: number
  success_txs: number
  failed_txs: number
  total_txs: number
  pending_kyc_submissions: number
}

export interface AdminPendingTxItem {
  id: string
  type: string
  from_wallet: string
  to_wallet: string
  amount: string
  status: string
  created_at: string
}

export interface AdminPendingTxList {
  items: AdminPendingTxItem[]
  total: number
  page: number
  page_size: number
}

/** GET /admin/stats — Aggregated platform statistics (admin only) */
export async function getAdminStats(): Promise<AdminStats> {
  return api.request<AdminStats>({ method: 'GET', path: '/admin/stats', auth: true })
}

/** GET /admin/transactions/pending — List pending transactions (admin only) */
export async function getAdminPendingTxs(page = 1, pageSize = 20): Promise<AdminPendingTxList> {
  return api.request<AdminPendingTxList>({
    method: 'GET',
    path: `/admin/transactions/pending?page=${page}&page_size=${pageSize}`,
    auth: true,
  })
}

export async function adminApprovePendingTx(id: string): Promise<AdminPendingTxItem> {
  return api.request<AdminPendingTxItem>({
    method: 'POST',
    path: `/admin/transactions/${id}/approve`,
    auth: true,
    body: {},
  })
}

export async function adminRejectPendingTx(id: string, reason?: string): Promise<AdminPendingTxItem> {
  return api.request<AdminPendingTxItem>({
    method: 'POST',
    path: `/admin/transactions/${id}/reject`,
    auth: true,
    body: { reason: reason ?? '' },
  })
}

// ─── Admin: Analytics ──────────────────────────────────────────────

export interface AdminAnalytics {
  users: {
    total: number; kyc_level0: number; kyc_level1: number; kyc_level2: number
    active_today: number; suspended: number; new_this_week: number
  }
  transactions: { total: number; pending: number; processing: number; success: number; failed: number }
  marketplace: { total_listings: number; active_listings: number; sold_listings: number }
  dao: { total_daos: number; total_proposals: number; active_proposals: number; total_votes: number }
  fundraising: { total_campaigns: number; active_campaigns: number }
  ticketing: { total_products: number; active_products: number; total_sold: number }
  tasks: { total_tasks: number; active_tasks: number }
  activities: { total_activities: number }
}

/** GET /admin/analytics — Per-module platform statistics (admin only) */
export async function getAdminAnalytics(): Promise<AdminAnalytics> {
  return api.request<AdminAnalytics>({ method: 'GET', path: '/admin/analytics', auth: true })
}

/** GET /admin/users — Paginated user list for admin panel */
export interface AdminUserItem {
  id: string
  wallet_address: string
  username?: string
  email?: string
  kyc_level: number
  kyc_status: string
  status: string
  roles: string[]
  last_login_at?: string
  created_at: string
}
export interface AdminUserListResult {
  items: AdminUserItem[]
  total: number
  page: number
  page_size: number
}
export async function getAdminUsers(params?: { status?: string; kyc_level?: string; search?: string; page?: number; page_size?: number }): Promise<AdminUserListResult> {
  return api.request<AdminUserListResult>({
    method: 'GET',
    path: '/admin/users',
    auth: true,
    query: params as Record<string, string | number | boolean | null | undefined>,
  })
}

// ─── Token Contract Info ─────────────────────────────────────────

export interface ContractInfo {
  total_supply: string // wei decimal string
  max_supply: string   // constant: 1e27
  paused: boolean
}

/** GET /tokens/supply — Public endpoint: token contract supply and pause state */
export async function getContractInfo(): Promise<ContractInfo> {
  return api.request<ContractInfo>({ method: 'GET', path: '/tokens/supply', auth: false })
}

// ── Admin token write endpoints ────────────────────────────────────

/** POST /tokens/mint — Mint VNDC tokens (requires ADMIN role JWT) */
export async function adminMint(to: string, amount: string): Promise<{ tx_hash: string }> {
  return api.request<{ tx_hash: string}>({ method: 'POST', path: '/tokens/mint', body: { to, amount }, auth: true })
}

/** POST /tokens/pause — Pause the VNDCToken contract (requires PAUSER_ROLE JWT) */
export async function adminPauseContract(): Promise<{ tx_hash: string }> {
  return api.request<{ tx_hash: string }>({ method: 'POST', path: '/tokens/pause', body: {}, auth: true })
}

/** POST /tokens/unpause — Unpause the VNDCToken contract (requires PAUSER_ROLE JWT) */
export async function adminUnpauseContract(): Promise<{ tx_hash: string }> {
  return api.request<{ tx_hash: string }>({ method: 'POST', path: '/tokens/unpause', body: {}, auth: true })
}

/** POST /tokens/vest — Create vesting schedule for holder (admin) */
export async function adminVestTokens(holder: string, amount: string, releaseTime: number): Promise<{ tx_hash: string }> {
  return api.request<{ tx_hash: string }>({
    method: 'POST',
    path: '/tokens/vest',
    auth: true,
    body: { holder, amount, release_time: releaseTime },
  })
}

/** POST /tokens/release-vested — Release vested tokens for holder (admin) */
export async function adminReleaseVested(holder: string): Promise<{ tx_hash: string }> {
  return api.request<{ tx_hash: string }>({
    method: 'POST',
    path: '/tokens/release-vested',
    auth: true,
    body: { holder },
  })
}

