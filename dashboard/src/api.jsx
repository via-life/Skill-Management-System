import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

async function api(path, opts = {}) {
  const r = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || 'Request failed');
  return data;
}

const ApiContext = createContext(null);

function ApiProvider({ children }) {
  const [online, setOnline] = useState(true);
  const onlineRef = useRef(true);

  const wrappedApi = useCallback(async (path, opts = {}) => {
    try {
      const data = await api(path, opts);
      if (!onlineRef.current) {
        onlineRef.current = true;
        setOnline(true);
      }
      return data;
    } catch (e) {
      if (e.message === 'Failed to fetch') {
        if (onlineRef.current) {
          onlineRef.current = false;
          setOnline(false);
        }
      }
      throw e;
    }
  }, []);

  return (
    <ApiContext.Provider value={{ api: wrappedApi, online }}>
      {children}
    </ApiContext.Provider>
  );
}

function useApi() {
  const ctx = useContext(ApiContext);
  if (!ctx) throw new Error('useApi must be used within ApiProvider');
  return ctx;
}

export { api, ApiContext, ApiProvider, useApi };
