import { useEffect, useRef } from 'react';

const PIN_SVG = (color, pulse = false) => `
<div style="position:relative;width:36px;height:48px">
  ${pulse ? `<div style="
    position:absolute;top:50%;left:50%;
    transform:translate(-50%,-60%);
    width:48px;height:48px;border-radius:50%;
    background:${color};opacity:0.25;
    animation:ft-pulse 1.8s ease-out infinite;
  "></div>` : ''}
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 48" width="36" height="48">
    <path d="M18 0C8.06 0 0 8.06 0 18c0 13.5 18 30 18 30S36 31.5 36 18C36 8.06 27.94 0 18 0z" fill="${color}" stroke="#fff" stroke-width="2"/>
    <circle cx="18" cy="18" r="7" fill="#fff"/>
    <circle cx="18" cy="18" r="4" fill="${color}"/>
  </svg>
</div>`;

const TRUCK_SVG = `
<div style="
  width:44px;height:44px;border-radius:50%;
  background:#27500A;border:3px solid #fff;
  box-shadow:0 4px 16px rgba(39,80,10,0.5);
  display:flex;align-items:center;justify-content:center;
  font-size:22px;line-height:1;
  animation:ft-bounce 0.6s ease-in-out infinite alternate;
">🚚</div>`;

const PULSE_CSS = `
@keyframes ft-pulse{0%{transform:translate(-50%,-60%) scale(0.5);opacity:0.4}100%{transform:translate(-50%,-60%) scale(2);opacity:0}}
@keyframes ft-bounce{from{transform:translateY(0)}to{transform:translateY(-4px)}}
`;

function injectCss(id, css) {
  if (document.getElementById(id)) return;
  const s = document.createElement('style');
  s.id = id;
  s.textContent = css;
  document.head.appendChild(s);
}

function interpolateAlongPoints(points, totalSteps, step) {
  const t = step / totalSteps;
  const rawIdx = t * (points.length - 1);
  const i = Math.min(Math.floor(rawIdx), points.length - 2);
  const frac = rawIdx - i;
  return [
    points[i][0] + (points[i + 1][0] - points[i][0]) * frac,
    points[i][1] + (points[i + 1][1] - points[i][1]) * frac,
  ];
}

export default function RouteMap({ routeData, style = {} }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layersRef = useRef([]);
  const animRefs = useRef({ draw: null, truck: null });

  useEffect(() => {
    injectCss('ft-routemap-css', PULSE_CSS);
  }, []);

  useEffect(() => {
    if (!containerRef.current || !window.L || !routeData) return;

    if (!mapRef.current) {
      mapRef.current = window.L.map(containerRef.current, {
        zoomControl: true,
        scrollWheelZoom: false,
        attributionControl: false,
      });
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
      }).addTo(mapRef.current);
    }

    const map = mapRef.current;

    // Clear old layers + stop old animations
    layersRef.current.forEach(l => { try { map.removeLayer(l); } catch {} });
    layersRef.current = [];
    if (animRefs.current.draw)  clearInterval(animRefs.current.draw);
    if (animRefs.current.truck) clearInterval(animRefs.current.truck);

    const { from, to, route } = routeData;
    const points = route.geometry; // [[lat,lng],...]

    const makeIcon = (html, size, anchor) => window.L.divIcon({
      html, className: '', iconSize: size, iconAnchor: anchor, popupAnchor: [0, -anchor[1]],
    });

    // Origin marker (pulsing green)
    const fromMarker = window.L.marker(
      [from.coords.lat, from.coords.lng],
      { icon: makeIcon(PIN_SVG('#27500A', true), [36, 48], [18, 48]), zIndexOffset: 100 }
    ).bindPopup(`<b style="color:#27500A">📍 Kisan ka Sthan</b><br><span style="font-weight:700">${from.name.charAt(0).toUpperCase() + from.name.slice(1)}</span>`);

    // Destination marker (orange)
    const toMarker = window.L.marker(
      [to.coords.lat, to.coords.lng],
      { icon: makeIcon(PIN_SVG('#D97706', true), [36, 48], [18, 48]), zIndexOffset: 100 }
    ).bindPopup(`<b style="color:#D97706">🏁 Vitrak ka Sthan</b><br><span style="font-weight:700">${to.name.charAt(0).toUpperCase() + to.name.slice(1)}</span>`);

    fromMarker.addTo(map);
    toMarker.addTo(map);

    // Background ghost line (faded)
    const ghostLine = window.L.polyline(points, {
      color: '#27500A', weight: 5, opacity: 0.12,
      dashArray: route.source === 'haversine' ? '10,8' : null,
    }).addTo(map);

    // Animated foreground polyline (drawn progressively)
    const animLine = window.L.polyline([points[0]], {
      color: '#27500A', weight: 5, opacity: 0.9,
      dashArray: route.source === 'haversine' ? '10,8' : null,
    }).addTo(map);

    layersRef.current = [fromMarker, toMarker, ghostLine, animLine];

    const bounds = window.L.latLngBounds(
      [from.coords.lat, from.coords.lng],
      [to.coords.lat, to.coords.lng]
    );
    map.fitBounds(bounds, { padding: [50, 50] });

    // Truck marker
    const truckMarker = window.L.marker(points[0], {
      icon: makeIcon(TRUCK_SVG, [44, 44], [22, 22]),
      zIndexOffset: 500,
    }).addTo(map);
    layersRef.current.push(truckMarker);

    // ── Phase 1: draw the polyline progressively ──
    const DRAW_STEPS = Math.min(points.length, 120);
    const DRAW_MS = 20;
    let drawStep = 1;

    animRefs.current.draw = setInterval(() => {
      drawStep++;
      const upTo = Math.floor((drawStep / DRAW_STEPS) * points.length);
      animLine.setLatLngs(points.slice(0, Math.max(upTo, 1)));

      if (drawStep >= DRAW_STEPS) {
        clearInterval(animRefs.current.draw);
        animRefs.current.draw = null;
        startTruckAnimation();
      }
    }, DRAW_MS);

    // ── Phase 2: truck animation (loop 1 time along the route) ──
    function startTruckAnimation() {
      const TRUCK_STEPS = 200;
      const TRUCK_MS = 30;
      let truckStep = 0;

      animRefs.current.truck = setInterval(() => {
        truckStep++;
        const pos = interpolateAlongPoints(points, TRUCK_STEPS, truckStep);
        truckMarker.setLatLng(pos);

        if (truckStep >= TRUCK_STEPS) {
          clearInterval(animRefs.current.truck);
          animRefs.current.truck = null;
          truckMarker.setLatLng([to.coords.lat, to.coords.lng]);
          setTimeout(() => fromMarker.openPopup(), 200);
        }
      }, TRUCK_MS);
    }
  }, [routeData]);

  useEffect(() => {
    const anims = animRefs.current;
    const mapInst = mapRef;
    return () => {
      if (anims.draw)  clearInterval(anims.draw);
      if (anims.truck) clearInterval(anims.truck);
      if (mapInst.current) {
        mapInst.current.remove();
        mapInst.current = null;
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        height: '360px',
        width: '100%',
        borderRadius: '20px',
        overflow: 'hidden',
        zIndex: 0,
        ...style
      }}
    />
  );
}
