// Gemeinsamer Leser für die NDJSON-Antwortströme von SpecIt.
// Verarbeitet auch aufgeteilte UTF-8-Zeichen und die letzte Zeile ohne abschließendes \n.
export async function readNdjson(stream, onRow, { maxLineChars = 2_000_000 } = {}) {
  if (!stream || typeof stream.getReader !== 'function') throw Error('Der Server hat keinen Antwortstrom geliefert.');
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let pending = '', completed = false;
  const parse = line => {
    if (!line.trim()) return;
    let row;
    try { row = JSON.parse(line); }
    catch { throw Error('Der Server hat eine ungültige Streaming-Antwort geliefert.'); }
    onRow(row);
  };
  try {
    for (;;) {
      const { value, done } = await reader.read();
      pending += done ? decoder.decode() : decoder.decode(value, { stream: true });
      let end;
      while ((end = pending.indexOf('\n')) !== -1) {
        const line = pending.slice(0, end);
        pending = pending.slice(end + 1);
        if (line.length > maxLineChars) throw Error('Eine Streaming-Nachricht ist zu groß.');
        parse(line);
      }
      if (pending.length > maxLineChars) throw Error('Eine Streaming-Nachricht ist zu groß.');
      if (done) {
        parse(pending);
        completed = true;
        return;
      }
    }
  } finally {
    if (!completed) {
      try { await reader.cancel(); } catch { /* Bereits abgebrochene Verbindung. */ }
    }
    reader.releaseLock();
  }
}
