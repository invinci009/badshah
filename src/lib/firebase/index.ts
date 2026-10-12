// ==============================================================================
// Firebase Abstraction Layer — Public Exports
// ==============================================================================
// Centralized Firebase exports. Import from here instead of individual files.
// ==============================================================================

// Client-side (browser)
export {
  getFirebaseApp,
  getFirebaseAuth,
  getFirestoreDb,
  getFirebaseStorage,
  isFirebaseConfigured,
} from './client'

// Server-side (admin)
export {
  getFirebaseAdminApp,
  getAdminAuth,
  getAdminFirestore,
  getAdminStorage,
  isFirebaseAdminConfigured,
  verifyIdToken,
  getUserByUid,
} from './admin'

// Auth helpers
export {
  validateSession,
  createSessionToken,
  getOrCreateUser,
  updateUserPassword,
  deleteUser,
  type AuthUser,
} from './auth'

// Firestore helpers
export {
  getRestaurantSettings,
  saveRestaurantSettings,
  getCampaigns,
  getCampaignBySlug,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  getMenuItems,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  createSession,
  getSession,
  updateSessionStatus,
  saveAnswer,
  getSessionAnswers,
  getReviewDraft,
  saveReviewDraft,
  updateReviewDraft,
  submitPrivateFeedback,
  submitDirectComplaint,
  updateFeedbackStatus,
  getPrivateFeedback,
  logEvent,
  getEvents,
  type RestaurantSettings,
  type Campaign,
  type MenuItem,
  type Session,
  type Answer,
  type ReviewDraft,
  type PrivateFeedback,
  type AnalyticsEvent,
} from './firestore'

// Storage helpers
export {
  uploadFile,
  deleteFile,
  fileExists,
  getPublicUrl,
  getSignedUrl,
} from './storage'
