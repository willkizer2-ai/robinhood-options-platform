// Web Trace — Dashboard route. The desk is a client component (live data + tabs).
import { Desk } from '../../components/desk';

export const metadata = { title: 'Desk — Web Trace Portfolio Management' };

export default function DashboardPage() {
  return <Desk />;
}
