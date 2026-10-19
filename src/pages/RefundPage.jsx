import LegalPage from './LegalPage';
import { LEGAL_UPDATED, refundSections } from '../../shared/legal.js';

export default function RefundPage() {
  return <LegalPage title="Refund Policy" updated={LEGAL_UPDATED} sections={refundSections} contactLine="To ask for a refund or ask a question, email us at" />;
}
