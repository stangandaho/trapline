// GPS and compass access. Both work offline (GPS needs no data connection).

import { averageFixes } from './util.js';

const GPS_OPTS = { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 };

export function gpsAvailable() { return 'geolocation' in navigator; }

const toFix = (p) => ({
  lat: p.coords.latitude, lon: p.coords.longitude,
  accuracy: p.coords.accuracy, altitude: p.coords.altitude, time: p.timestamp,
});

/** Continuous position updates. Returns a stop function. */
export function watchPosition(onFix, onError = () => {}) {
  if (!gpsAvailable()) { onError(new Error('GPS not available on this device')); return () => {}; }
  const id = navigator.geolocation.watchPosition((p) => onFix(toFix(p)), (e) => onError(gpsError(e)), GPS_OPTS);
  return () => navigator.geolocation.clearWatch(id);
}

/**
 * Collect fixes for `seconds` and average them. onProgress({fixes, best, elapsed, avg}).
 * Returns {promise, stop}; stop() resolves early with what has been collected.
 */
export function sampleGps(seconds, onProgress = () => {}) {
  const fixes = [];
  let stopWatch, timer, finish, done = false;
  const t0 = Date.now();
  const promise = new Promise((resolve, reject) => {
    finish = () => {
      if (done) return;
      done = true;
      stopWatch?.(); clearInterval(timer);
      const avg = averageFixes(fixes);
      avg ? resolve(avg) : reject(new Error('No GPS fix, move to an open area or enter coordinates manually'));
    };
    stopWatch = watchPosition((f) => {
      fixes.push(f);
      onProgress({ fixes: fixes.length, best: Math.min(...fixes.map((x) => x.accuracy)), elapsed: (Date.now() - t0) / 1000, avg: averageFixes(fixes) });
    }, (e) => {
      if (!fixes.length && !done) { done = true; stopWatch?.(); clearInterval(timer); reject(e); }
    });
    timer = setInterval(() => {
      const elapsed = (Date.now() - t0) / 1000;
      onProgress({ fixes: fixes.length, best: fixes.length ? Math.min(...fixes.map((x) => x.accuracy)) : null, elapsed, avg: averageFixes(fixes) });
      if (elapsed >= seconds && fixes.length) finish();
      if (elapsed >= seconds + 60) finish();
    }, 500);
  });
  return { promise, stop: () => finish() };
}

function gpsError(e) {
  const msg = {
    1: 'Location permission denied, allow it in your phone settings',
    2: 'Position unavailable, move to an open area',
    3: 'GPS timed out, try again in an open area',
  }[e.code] ?? e.message;
  return new Error(msg);
}

const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/**
 * Compass heading in degrees (0 = north). Call from a tap (iOS asks permission).
 * Resolves with a stop function once a real reading has arrived; rejects when
 * the browser blocks the sensor (iOS refusal, Brave's sensor protection…).
 */
export async function startCompass(onHeading) {
  if (typeof DeviceOrientationEvent === 'undefined') throw new Error('No compass on this device');
  let permission = 'granted';
  if (typeof DeviceOrientationEvent.requestPermission === 'function') {
    // iOS answers "denied" without asking again after one refusal, until the app is restarted
    try { permission = await DeviceOrientationEvent.requestPermission(); } catch { permission = 'denied'; }
  }
  const evt = 'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation';
  let got = false;
  const handler = (e) => {
    let h = null;
    if (typeof e.webkitCompassHeading === 'number') h = e.webkitCompassHeading;
    else if (e.absolute && typeof e.alpha === 'number') h = (360 - e.alpha) % 360;
    if (h === null) return;
    got = true;
    const screenAngle = screen.orientation?.angle ?? 0;
    onHeading((h + screenAngle + 360) % 360);
  };
  window.addEventListener(evt, handler);
  const stop = () => window.removeEventListener(evt, handler);
  // Trust real readings over the permission answer: some browsers report
  // "denied" yet deliver data, others say nothing and deliver none.
  for (let i = 0; i < 15 && !got; i++) await new Promise((r) => setTimeout(r, 100));
  if (got) return stop;
  stop();
  if (permission !== 'granted' && isIOS()) throw new Error('Compass blocked, close the app fully, reopen it and tap Allow');
  throw new Error('Compass blocked, allow motion sensors for this site in the browser settings');
}
