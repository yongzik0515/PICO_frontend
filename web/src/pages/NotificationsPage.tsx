import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { notificationRoleNames, notificationTarget, useNotificationRoles, useNotifications, type NotificationRole } from '../layout/notifications';
import { utcToLocal } from '../transactions/ui';
import { Icon } from '../ui/Icon';
import { PageTitle } from '../ui/PageTitle';
import './notifications.css';

// 프로토타입 app.js의 notifications 화면. GET /api/notifications
// 이용자·도우미 알림을 색으로 구분하고, 위 칩(전체 - 이용자 - 도우미)으로 나눠 본다. 공통 알림(운영팀 안내 등)은 '전체'에서만 보인다.
const filters: ['all' | NotificationRole, string][] = [
  ['all', '전체'],
  ['user', '이용자'],
  ['agent', '도우미'],
];

export function NotificationsPage() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { items, unread, open, readAll } = useNotifications(pathname);
  const roleOf = useNotificationRoles(items);
  const [filter, setFilter] = useState<'all' | NotificationRole>('all');
  const shown = filter === 'all' ? items : items.filter((n) => roleOf(n) === filter);
  return (
    <>
      <PageTitle title="알림" />
      <div className="notification-header">
        <span>안 읽은 알림 {unread}개</span>
        <button className="text-link" disabled={!unread} onClick={() => void readAll()}>
          모두 읽음
        </button>
      </div>
      <div className="notification-filters" role="tablist" aria-label="알림 구분">
        {filters.map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={filter === k} className={`notification-filter ${k} ${filter === k ? 'active' : ''}`} onClick={() => setFilter(k)}>
            {label}
          </button>
        ))}
      </div>
      <section className="content-card notification-list">
        {shown.length ? (
          shown.map((n) => {
            const role = roleOf(n);
            return (
              <button
                key={n.notificationId}
                className={`notification-item role-${role} ${!n.readAt ? 'unread' : ''}`}
                onClick={async () => {
                  await open(n);
                  const to = notificationTarget(n);
                  if (to) navigate(to);
                }}
              >
                <span className="notification-icon">
                  <Icon name={n.requestId ? 'check' : 'bell'} size={20} />
                </span>
                <div>
                  <h3>
                    <span className={`notification-role ${role}`}>{notificationRoleNames[role]}</span>
                    {n.title}
                    {!n.readAt && <i></i>}
                  </h3>
                  <p>{n.body}</p>
                  <small>
                    {utcToLocal(n.createdAt)}
                    {n.kind === 'ANNOUNCEMENT' && ' · 자세히 보기'}
                  </small>
                </div>
                {notificationTarget(n) && <Icon name="chevron" size={16} />}
              </button>
            );
          })
        ) : (
          <div className="empty">
            <h2>{filter === 'all' ? '아직 도착한 알림이 없어요' : `${notificationRoleNames[filter]} 알림이 없어요`}</h2>
            <p>진행 소식을 이곳에서 알려드릴게요.</p>
          </div>
        )}
      </section>
    </>
  );
}
