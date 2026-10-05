import { Link } from 'react-router-dom';
import { EmptyState } from '../components/common/Feedback';

export default function NotFound() {
  return (
    <EmptyState title="Page not found">
      <Link to="/" className="font-medium text-brand-700 underline dark:text-brand-300">
        Go to Today
      </Link>
    </EmptyState>
  );
}
