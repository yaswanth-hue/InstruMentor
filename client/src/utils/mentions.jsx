import React from 'react';

// Must match the token shape used server-side in resolveTaggedUsersByMentions
// (firebase.js), so anything we consider a "mention" here is exactly what
// gets resolved and tagged on submit.
const MENTION_TOKEN = /@([a-zA-Z0-9_.]+)/g;

/**
 * Splits `content` on @mention tokens and returns an array of strings and
 * React nodes. Mentions that resolve to a real user (via `resolveMention`)
 * are rendered as a styled, clickable span; unresolved mentions are still
 * styled so they read as mentions, but aren't clickable since we can't
 * safely guess who was meant.
 *
 * @param {string} content
 * @param {(token: string) => ({ id: string } | null)} resolveMention
 * @param {(userId: string) => void} onNavigate
 */
export function renderContentWithMentions(content, resolveMention, onNavigate) {
  if (!content) return content;

  const parts = [];
  let lastIndex = 0;
  let key = 0;
  const regex = new RegExp(MENTION_TOKEN);
  let match;

  while ((match = regex.exec(content)) !== null) {
    const [full, token] = match;
    const start = match.index;

    if (start > lastIndex) {
      parts.push(content.slice(lastIndex, start));
    }

    const resolved = resolveMention ? resolveMention(token) : null;

    if (resolved?.id) {
      parts.push(
        <span
          key={`mention-${key++}`}
          role="link"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            onNavigate?.(resolved.id);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.stopPropagation();
              e.preventDefault();
              onNavigate?.(resolved.id);
            }
          }}
          className="font-semibold text-sky-400 hover:text-sky-300 hover:underline cursor-pointer"
        >
          @{token}
        </span>
      );
    } else {
      parts.push(
        <span key={`mention-${key++}`} className="font-semibold text-sky-400">
          @{token}
        </span>
      );
    }

    lastIndex = start + full.length;
  }

  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  return parts;
}

/**
 * Builds a token -> user resolver from a list of lightweight user profiles
 * (id, username, displayName), matching the same rules used server-side:
 * exact username, exact displayName, or displayName with spaces removed.
 */
export function buildMentionResolver(profiles) {
  const list = profiles || [];
  return (token) => {
    const t = token.toLowerCase();
    return (
      list.find((p) => {
        const username = (p.username || '').trim().toLowerCase();
        const displayName = (p.displayName || '').trim().toLowerCase();
        const compact = displayName.replace(/\s+/g, '');
        return t === username || t === displayName || t === compact;
      }) || null
    );
  };
}

/**
 * Collects the unique set of lowercase mention tokens present in `content`.
 */
export function extractMentionTokens(content) {
  if (!content) return [];
  const tokens = new Set();
  let match;
  const regex = new RegExp(MENTION_TOKEN);
  while ((match = regex.exec(content)) !== null) {
    tokens.add(match[1].toLowerCase());
  }
  return [...tokens];
}