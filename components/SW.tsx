'use client';
import { useEffect } from 'react';

export default function SW() {
  useEffect(() => {
    if ('serviceWorker' in navigator && location.hostname !== 'localhost') {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);
  return null;
}
