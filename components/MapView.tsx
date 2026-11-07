'use client';
import { useEffect, useRef } from 'react';

export type Marker = { lat: number; lng: number; label?: string; kind?: 'home' | 'worker' | 'order' | 'new' };

const YEREVAN = { lat: 40.1811, lng: 44.5136 };
const COLORS: Record<string, string> = { home: '#16a34a', worker: '#2563eb', order: '#16a34a', new: '#d97706' };
const EMOJI: Record<string, string> = { home: '🏠', worker: '🧤', order: '🗑️', new: '🆕' };

/** Lightweight Leaflet map with OpenStreetMap tiles */
export default function MapView({
  markers,
  height = 220,
  onPick,
  pick,
}: {
  markers: Marker[];
  height?: number;
  onPick?: (p: { lat: number; lng: number }) => void;
  pick?: { lat: number; lng: number } | null;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const layer = useRef<any>(null);
  const L = useRef<any>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mod = await import('leaflet');
      if (cancelled || !el.current || map.current) return;
      L.current = (mod as any).default || mod;
      const all = [...markers, ...(pick ? [pick] : [])];
      const c = all[0] || YEREVAN;
      map.current = L.current.map(el.current, { zoomControl: true, attributionControl: true }).setView([c.lat, c.lng], 14);
      L.current
        .tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' })
        .addTo(map.current);
      layer.current = L.current.layerGroup().addTo(map.current);
      map.current.on('click', (e: any) => onPickRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng }));
      draw();
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function icon(kind = 'order', label?: string) {
    return L.current.divIcon({
      className: '',
      html: `<div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%)"><div style="background:${COLORS[kind]};color:#fff;border-radius:999px;padding:4px 8px;font:600 12px system-ui;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.25)">${EMOJI[kind]}${label ? ' ' + label : ''}</div><div style="width:0;height:0;border:6px solid transparent;border-top-color:${COLORS[kind]}"></div></div>`,
      iconSize: [0, 0],
    });
  }

  function draw() {
    if (!map.current || !layer.current) return;
    layer.current.clearLayers();
    const pts: any[] = [];
    for (const m of markers) {
      if (m.lat == null || m.lng == null) continue;
      L.current.marker([m.lat, m.lng], { icon: icon(m.kind, m.label) }).addTo(layer.current);
      pts.push([m.lat, m.lng]);
    }
    if (pick) {
      L.current.marker([pick.lat, pick.lng], { icon: icon('home', 'Здесь') }).addTo(layer.current);
      pts.push([pick.lat, pick.lng]);
    }
    if (pts.length > 1) map.current.fitBounds(pts, { padding: [40, 40], maxZoom: 16 });
    else if (pts.length === 1) map.current.setView(pts[0], Math.max(map.current.getZoom(), 15));
  }

  useEffect(() => {
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(markers), pick?.lat, pick?.lng]);

  return <div ref={el} style={{ height, borderRadius: 14, overflow: 'hidden', border: '1px solid var(--line)', zIndex: 0, position: 'relative' }} />;
}
