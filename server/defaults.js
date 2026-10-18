// Settings every account starts with (a person's own saved values override these)
export const DEFAULT_SETTINGS = {
  defaultTokenExpiry: 30,
  sessionDisplayPreference: 'detailed',
  courseAccessPreference: 'enrollment_required',
  notifications: {
    suspiciousActivity: true,
    accessDenied: true,
    securityUpdates: false,
  },
  security: {
    authStatus: 'demo_simulated',
    encryptionStatus: 'demo_simulated',
    monitoringStatus: 'demo_active',
  },
};
