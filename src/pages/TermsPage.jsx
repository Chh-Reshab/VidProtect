import LegalPage from './LegalPage';
import { LEGAL_UPDATED, termsSections } from '../../shared/legal.js';

export default function TermsPage() {
  return <LegalPage title="Terms of Service" updated={LEGAL_UPDATED} sections={termsSections} contactLine="Questions about these Terms:" />;
}
