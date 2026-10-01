import { Link } from 'react-router-dom';
import { Icon } from '../ui/Icon';
import { ImagePreview } from '../ui/ImagePreview';
import { money, responseTime } from '../ui/format';
import type { Agent } from './agent';
import { useFavorites } from './favorites';

// 프로토타입 discovery.js의 avatar()/badges()/card()/favoriteButton()
export function Avatar({ agent, size = '' }: { agent: Pick<Agent, 'name' | 'initial' | 'color' | 'image'>; size?: string }) {
  return (
    <span className={`avatar ${agent.color || 'blue'} ${size}`}>
      {agent.image ? <ImagePreview src={agent.image} alt={`${agent.name} 프로필`} /> : agent.initial || agent.name?.[0] || '나'}
      <span className="avatar-spark">✦</span>
    </span>
  );
}

export function Badges({ agent }: { agent: Agent }) {
  if (!agent.identityVerified && !agent.accountVerified) return null;
  return (
    <span className="badges">
      {agent.identityVerified && (
        <span className="badge verified">
          <Icon name="shield" size={12} />
          본인인증
        </span>
      )}
      {agent.accountVerified && (
        <span className="badge verified">
          <Icon name="check" size={12} />
          계좌인증
        </span>
      )}
    </span>
  );
}

export function AgentCard({ agent: a }: { agent: Agent }) {
  return (
    <article className="agent-card pc-agent-card">
      <div className="agent-main">
        <Avatar agent={a} />
        <div className="agent-copy">
          <div className="agent-title">
            <h3>{a.name}</h3>
            <Badges agent={a} />
          </div>
          <p>{a.intro}</p>
          <div className="agent-stats">
            <span className="rating">
              <b>★</b>
              <strong>{a.rating.toFixed(1)}</strong>
              <span className="muted">({a.reviews})</span>
            </span>
            <span className="stat-divider"></span>
            <span>
              거래 <strong>{a.trades}회</strong>
            </span>
            <span className="stat-divider"></span>
            <span>
              성공률 <strong>{a.success}%</strong>
            </span>
          </div>
        </div>
        <div className="pc-card-price">
          <span>착수비</span>
          <strong>
            {money(a.fee)}
            <small>원부터</small>
          </strong>
        </div>
      </div>
      <div className="agent-bottom">
        <div className="site-tags">
          {a.sites.map((s) => (
            <span key={s}>{s}</span>
          ))}
          {a.reply !== null && (
            <span className="response-time">
              <Icon name="clock" size={13} />
              평균 {responseTime(a.reply)} 응답
            </span>
          )}
        </div>
        <Link className="pc-profile-link" to={`/agents/${a.id}`}>
          프로필 보기 <Icon name="arrow" size={16} />
        </Link>
      </div>
    </article>
  );
}

// 좋아요 버튼은 로그인해야 들어갈 수 있는 화면(도우미 프로필, 좋아요한 도우미)에만 있다.
export function FavoriteButton({ agent, iconOnly = false }: { agent: Agent; iconOnly?: boolean }) {
  const { has, toggle } = useFavorites();
  const liked = has(agent.id);
  return (
    <button
      className={`favorite-chip ${iconOnly ? 'icon-only' : ''} ${liked ? 'selected' : ''}`}
      aria-pressed={liked}
      aria-label="좋아요"
      onClick={() => void toggle(agent)}
    >
      <Icon name="heart" size={18} />
      {!iconOnly && '좋아요'}
    </button>
  );
}
