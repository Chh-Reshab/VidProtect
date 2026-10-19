import LegalPage from './LegalPage';
import { PRIVACY_UPDATED, privacySections } from '../../shared/privacy.js';

export default function PrivacyPage() {
  return <LegalPage title="Privacy Policy" updated={PRIVACY_UPDATED} sections={privacySections} contactLine="Questions or requests about your information:" />;
}
