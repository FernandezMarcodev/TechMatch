import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Icon } from './Icon';

/**
 * "Adaptar mi CV": an account privilege. Visitors see a lock and, on click, the login page,
 * which brings them back here; the API refuses the adaptation without a session anyway.
 */
export function AdaptCvLink({
  cvId,
  jobId,
  label,
  className,
}: {
  cvId: string;
  jobId: string;
  label: string;
  className: string;
}) {
  const { user } = useAuth();
  return (
    <Link
      to={`/cv/${encodeURIComponent(cvId)}/adaptar/${encodeURIComponent(jobId)}`}
      className={className}
      title={user ? undefined : 'Requiere una cuenta'}
    >
      <Icon name={user ? 'file' : 'lock'} size={16} />
      {label}
    </Link>
  );
}
