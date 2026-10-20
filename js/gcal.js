// Google Calendar integration via Google Identity Services (browser OAuth token flow)
// and the Calendar REST API. Requires an OAuth Client ID (Web application) whose
// "Authorized JavaScript origins" include the URL this app is served from.
window.GCal = (() => {
  'use strict';

  const SCOPE = 'https://www.googleapis.com/auth/calendar.events';
  const API = 'https://www.googleapis.com/calendar/v3';
  let token = null;
  let expiresAt = 0;

  function loadScript() {
    return new Promise((resolve, reject) => {
      if (window.google && google.accounts && google.accounts.oauth2) return resolve();
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Could not load Google sign-in. Check your connection.'));
      document.head.appendChild(s);
    });
  }

  async function connect(clientId) {
    if (!clientId) throw new Error('Add your Google OAuth Client ID in Settings first.');
    await loadScript();
    return new Promise((resolve, reject) => {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPE,
        callback: (resp) => {
          if (resp.error) return reject(new Error(resp.error_description || resp.error));
          token = resp.access_token;
          expiresAt = Date.now() + (Number(resp.expires_in || 3600) - 60) * 1000;
          resolve();
        },
        error_callback: (err) => reject(new Error(err.message || err.type || 'Sign-in was cancelled.')),
      });
      client.requestAccessToken({ prompt: '' });
    });
  }

  function isConnected() {
    return Boolean(token) && Date.now() < expiresAt;
  }

  function disconnect() {
    if (token && window.google && google.accounts) google.accounts.oauth2.revoke(token, () => {});
    token = null;
    expiresAt = 0;
  }

  // Forget a token Google has rejected, without revoking the user's consent.
  function expire() {
    token = null;
    expiresAt = 0;
  }

  async function api(path, { method = 'GET', body } = {}) {
    if (!isConnected()) {
      const e = new Error('Not connected to Google Calendar.');
      e.status = 401;
      throw e;
    }
    const res = await fetch(API + path, {
      method,
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 204) return null;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const e = new Error((data.error && data.error.message) || 'Google Calendar error ' + res.status);
      e.status = res.status;
      throw e;
    }
    return data;
  }

  const eventsPath = (calendarId) => `/calendars/${encodeURIComponent(calendarId)}/events`;

  async function listEvents(calendarId, timeMin, timeMax, { showDeleted = false } = {}) {
    const items = [];
    let pageToken = '';
    do {
      const q = new URLSearchParams({
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        singleEvents: 'true',
        orderBy: 'startTime',
        maxResults: '250',
        showDeleted: String(showDeleted),
      });
      if (pageToken) q.set('pageToken', pageToken);
      const data = await api(`${eventsPath(calendarId)}?${q}`);
      items.push(...((data && data.items) || []));
      pageToken = data && data.nextPageToken;
    } while (pageToken);
    return items;
  }

  // Update the event we created earlier; recreate it if it was deleted in Google Calendar.
  async function upsertEvent(calendarId, eventId, body) {
    if (eventId) {
      try {
        return await api(`${eventsPath(calendarId)}/${encodeURIComponent(eventId)}`, { method: 'PATCH', body });
      } catch (e) {
        if (e.status !== 404 && e.status !== 410) throw e;
      }
    }
    return api(eventsPath(calendarId), { method: 'POST', body });
  }

  async function deleteEvent(calendarId, eventId) {
    try {
      await api(`${eventsPath(calendarId)}/${encodeURIComponent(eventId)}`, { method: 'DELETE' });
    } catch (e) {
      if (e.status !== 404 && e.status !== 410) throw e;
    }
  }

  return { connect, disconnect, expire, isConnected, listEvents, upsertEvent, deleteEvent };
})();
