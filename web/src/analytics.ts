import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const GA_ID = 'G-90PSYD8LD5';
const APP_PATHS = new Set(['/', '/notices', '/service-guide', '/terms', '/privacy', '/signup-privacy', '/contact-sharing',
  '/login', '/signup', '/favorites', '/requests', '/availability', '/notifications', '/my', '/user-profile', '/account',
  '/history', '/application', '/helper-profile', '/credits', '/leads', '/matches', '/guide']);
const CAMPAIGN_KEYS = new Set(['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_id']);

export function safeAnalyticsUrl(url: URL): string | null {
  const path = url.pathname;
  let pathname = APP_PATHS.has(path) ? path : null;
  if (/^\/(agents|quote|request-sent)\/\d+$/.test(path)) pathname = path.replace(/\d+$/, ':id');
  if (/^\/requests\/\d+(\/(terms|payment|evidence|result|review))?$/.test(path)) pathname = path.replace(/\/\d+/, '/:id');
  if (!pathname) return null;
  const safe = new URL(pathname, url.origin);
  for (const [key, value] of url.searchParams) {
    if (CAMPAIGN_KEYS.has(key) && /^[a-zA-Z0-9_.-]{1,100}$/.test(value)) safe.searchParams.set(key, value);
  }
  return safe.href;
}

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    'ga-disable-G-90PSYD8LD5'?: boolean;
  }
}

const browser = typeof window === 'undefined' ? undefined : window;
const enabled = Boolean(import.meta.env?.PROD && browser?.location.hostname === 'pico-kr.app'
  && browser.navigator.doNotTrack !== '1' && !(browser.navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl);
let gaStarted = false;
let previousPage: string | undefined;

function loadScript(id: string, src: string) {
  if (document.getElementById(id)) return;
  const script = document.createElement('script');
  script.id = id;
  script.async = true;
  script.src = src;
  script.referrerPolicy = 'origin';
  document.head.appendChild(script);
}

export function Analytics() {
  const { pathname, search } = useLocation();
  useEffect(() => {
    if (!enabled) return;
    const page = safeAnalyticsUrl(new URL(pathname + search, window.location.origin));
    window['ga-disable-G-90PSYD8LD5'] = !page;
    if (!page) return;
    if (!gaStarted) {
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer!.push(arguments); };
      window.gtag('js', new Date());
      window.gtag('config', GA_ID, {
        send_page_view: false,
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
        page_location: page,
        page_referrer: document.referrer ? new URL(document.referrer).origin + '/' : '',
        page_title: 'PICO',
      });
      loadScript('pico-ga4', `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`);
      gaStarted = true;
    }
    if (page !== previousPage) {
      const fields = { page_location: page, page_title: 'PICO', page_referrer: previousPage
        || (document.referrer ? new URL(document.referrer).origin + '/' : '') };
      window.gtag!('set', fields);
      window.gtag!('event', 'page_view', fields);
      previousPage = page;
    }
  }, [pathname, search]);
  return null;
}
