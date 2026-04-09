'use client';

import { useEffect, useRef, useState } from 'react';

interface SseEvent {
  eventId: string;
  eventType: string;
  tenantId: string;
  meetingId: string;
  userId?: string;
  timestamp: string;
  data: unknown;
}

export default function SseTestPage() {
  const [events, setEvents] = useState<SseEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [meetingId, setMeetingId] = useState('');
  const [token, setToken] = useState('');
  const eventSourceRef = useRef<EventSource | null>(null);

  function connect() {
    if (!meetingId || !token) return;

    const apiUrl =
      process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
    const url = `${apiUrl}/api/v1/sse/meetings/${meetingId}?token=${encodeURIComponent(token)}`;

    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => setConnected(true);

    es.onmessage = (msg) => {
      try {
        const parsed: SseEvent = JSON.parse(msg.data);
        setEvents((prev) => [parsed, ...prev]);
      } catch {
        // ignore malformed messages
      }
    };

    es.onerror = () => {
      setConnected(false);
      es.close();
      eventSourceRef.current = null;
    };
  }

  function disconnect() {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    setConnected(false);
  }

  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  return (
    <div style={{ padding: '2rem', fontFamily: 'monospace' }}>
      <h1>SSE Spike Test</h1>

      <div style={{ marginBottom: '1rem' }}>
        <label>
          Meeting ID:{' '}
          <input
            type="text"
            value={meetingId}
            onChange={(e) => setMeetingId(e.target.value)}
            placeholder="UUID do meeting"
            style={{ width: '300px', marginRight: '0.5rem' }}
          />
        </label>
        <label>
          Token:{' '}
          <input
            type="text"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="JWT token"
            style={{ width: '300px', marginRight: '0.5rem' }}
          />
        </label>
        <button onClick={connected ? disconnect : connect}>
          {connected ? 'Desconectar' : 'Conectar'}
        </button>
      </div>

      <p>
        Status:{' '}
        <strong style={{ color: connected ? 'green' : 'red' }}>
          {connected ? 'Conectado' : 'Desconectado'}
        </strong>
      </p>

      <h2>Eventos ({events.length})</h2>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {events.map((evt) => (
          <li
            key={evt.eventId}
            style={{
              border: '1px solid #ccc',
              padding: '0.5rem',
              marginBottom: '0.25rem',
              borderRadius: '4px',
            }}
          >
            <strong>{evt.eventType}</strong> | User: {evt.userId ?? 'N/A'} |{' '}
            {evt.timestamp}
            <pre style={{ fontSize: '0.8rem', margin: '0.25rem 0 0' }}>
              {JSON.stringify(evt.data, null, 2)}
            </pre>
          </li>
        ))}
      </ul>
    </div>
  );
}
