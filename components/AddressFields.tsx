'use client';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { toast } from './ui';
import type { Settings } from '@/lib/domain';

const MapView = dynamic(() => import('./MapView'), { ssr: false, loading: () => <div style={{ height: 200 }} /> });

export function emptyAddress(settings: any, last: any = {}) {
  return {
    city: last.city || settings.serviceArea || '',
    street: last.street || '',
    house: last.house || '',
    entrance: last.entrance || '',
    floor: last.floor || '',
    apt: last.apt || '',
    intercom: last.intercom || '',
    zoneId: last.zoneId || '',
    lat: last.lat,
    lng: last.lng,
  };
}

async function reverseGeocode(lat: number, lng: number) {
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=ru&zoom=18`);
    const j = await r.json();
    return { street: j.address?.road || '', house: j.address?.house_number || '', city: j.address?.city || j.address?.town || '' };
  } catch {
    return null;
  }
}

export function AddressFields({
  addr,
  setAddr,
  settings,
  saved = [],
}: {
  addr: any;
  setAddr: (a: any) => void;
  settings: Settings;
  saved?: any[];
}) {
  const [showMap, setShowMap] = useState(!!addr.lat);
  const [locating, setLocating] = useState(false);
  const set = (k: string) => (e: any) => setAddr({ ...addr, [k]: e.target.value });

  async function applyPoint(p: { lat: number; lng: number }, fill: boolean) {
    const next = { ...addr, lat: +p.lat.toFixed(6), lng: +p.lng.toFixed(6) };
    if (fill) {
      const g = await reverseGeocode(p.lat, p.lng);
      if (g?.street) Object.assign(next, { street: g.street, house: g.house || next.house, city: g.city || next.city });
    }
    setAddr(next);
  }

  function locate() {
    if (!navigator.geolocation) return toast('Геолокация недоступна');
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setShowMap(true);
        await applyPoint({ lat: pos.coords.latitude, lng: pos.coords.longitude }, true);
        setLocating(false);
      },
      () => {
        setLocating(false);
        toast('Не удалось определить местоположение. Отметьте точку на карте');
        setShowMap(true);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  return (
    <div className="stack">
      {saved.length > 0 && (
        <div className="chips">
          {saved.map((a: any, i: number) => (
            <button key={i} type="button" className="chip" onClick={() => { setAddr({ ...a }); setShowMap(!!a.lat); }}>
              📍 {a.street}, {a.house}, кв. {a.apt}
            </button>
          ))}
        </div>
      )}
      <div className="row">
        <button type="button" className="btn ghost sm grow" onClick={locate} disabled={locating}>
          {locating ? <span className="spin" /> : '📍 Моё местоположение'}
        </button>
        <button type="button" className="btn ghost sm grow" onClick={() => setShowMap(!showMap)}>🗺️ {showMap ? 'Скрыть карту' : 'Указать на карте'}</button>
      </div>
      {showMap && (
        <>
          <MapView markers={[]} pick={addr.lat ? { lat: addr.lat, lng: addr.lng } : null} onPick={(p) => applyPoint(p, true)} height={200} />
          <div className="small muted">Нажмите на карту, чтобы отметить дом. Исполнитель увидит точку и маршрут.</div>
        </>
      )}
      <div className="grid2">
        <label className="f"><span>Город</span><input className="input" value={addr.city} onChange={set('city')} /></label>
        <label className="f">
          <span>Район</span>
          <select className="input" value={addr.zoneId || ''} onChange={set('zoneId')}>
            <option value="">— выберите —</option>
            {settings.zones?.map((z) => (
              <option key={z.id} value={z.id}>{z.name}{z.extra ? ` (+${z.extra} ${settings.currency})` : ''}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid2" style={{ gridTemplateColumns: '2fr 1fr' }}>
        <label className="f"><span>Улица</span><input className="input" value={addr.street} onChange={set('street')} placeholder="ул. Абовяна" /></label>
        <label className="f"><span>Дом</span><input className="input" value={addr.house} onChange={set('house')} placeholder="12" /></label>
      </div>
      <div className="grid3">
        <label className="f"><span>Подъезд</span><input className="input" inputMode="numeric" value={addr.entrance} onChange={set('entrance')} /></label>
        <label className="f"><span>Этаж</span><input className="input" inputMode="numeric" value={addr.floor} onChange={set('floor')} /></label>
        <label className="f"><span>Квартира</span><input className="input" value={addr.apt} onChange={set('apt')} /></label>
      </div>
      <label className="f"><span>Код домофона</span><input className="input" value={addr.intercom} onChange={set('intercom')} placeholder="необязательно" /></label>
    </div>
  );
}
