import React, { useEffect, useState } from 'react';
import { subscribeDebugLogs, clearDebugLogs, DebugLog } from '@/lib/debugLogger';

const DebugConsole: React.FC = () => {
  const [logs, setLogs] = useState<DebugLog[]>([]);
  useEffect(() => {
    const unsub = subscribeDebugLogs(setLogs);
    return () => unsub();
  }, []);

  if (logs.length === 0) return null;

  return (
    <div style={{ position: 'fixed', right: 12, bottom: 12, width: 420, maxHeight: '60vh', overflow: 'auto', zIndex: 9999 }}>
      <div className="bg-white border shadow rounded p-2 text-xs">
        <div className="flex items-center justify-between mb-2">
          <div className="font-semibold">Debug Console</div>
          <div className="flex gap-2">
            <button className="text-red-500 underline" onClick={() => clearDebugLogs()}>Clear</button>
          </div>
        </div>
        <div>
          {logs.map(l => (
            <div key={l.id} className="mb-2 border-b pb-1">
              <div className="flex items-center justify-between">
                <div className="font-medium">{new Date(l.ts).toLocaleTimeString()} — {l.title}</div>
                <div className="text-gray-400">{l.level}</div>
              </div>
              <div className="text-gray-700">{l.message}</div>
              {l.meta && <pre className="text-[10px] overflow-auto max-h-24 mt-1 bg-gray-50 p-1 rounded">{JSON.stringify(l.meta, null, 2)}</pre>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DebugConsole;
