import { useEffect, useRef } from "react";
import { View } from "react-native";
import WebView, { type WebViewMessageEvent } from "react-native-webview";

import { ENV } from "../src/env";

export interface MapMarker {
  id: string;
  kind: "pickup" | "destination" | "driver";
  lat: number;
  lng: number;
  /** A last known position, drawn grey so it never looks current. */
  stale?: boolean;
}

export interface MapCoordinates {
  lat: number;
  lng: number;
}

export const TOLIARA: MapCoordinates = { lat: -23.3545, lng: 43.6705 };

// The package defaults this class's props generic to undefined, which reads as never.
const MapWebView = WebView<object>;

const HTML = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>html,body,#m{height:100%;margin:0;background:#efefef}
.p{width:18px;height:18px;border-radius:50%;background:#000;border:3px solid #fff;box-shadow:0 1px 4px #0006}
.d{width:18px;height:18px;background:#000;border:3px solid #fff;box-shadow:0 1px 4px #0006}
.c{width:26px;height:26px;border-radius:50%;background:#000;border:3px solid #fff;box-shadow:0 1px 6px #0008}
.s{background:#afafaf}</style></head><body><div id="m"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
var map=L.map('m',{zoomControl:false,attributionControl:true}).setView([${TOLIARA.lat},${TOLIARA.lng}],14);
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(ENV.EXPO_PUBLIC_CARTO_API_KEY)}',{maxZoom:19,subdomains:'abcd',
attribution:'&copy; OpenStreetMap contributors, &copy; CARTO'}).addTo(map);
var markers={},line=null,fitted='';
function icon(k,s){var c=k==='pickup'?'p':k==='destination'?'d':'c';var z=k==='driver'?32:24;
return L.divIcon({className:'',iconSize:[z,z],iconAnchor:[z/2,z/2],html:'<div class="'+c+(s?' s':'')+'"></div>'})}
window.zayUpdate=function(d){var seen={};(d.markers||[]).forEach(function(m){seen[m.id]=1;
if(markers[m.id]){markers[m.id].setLatLng([m.lat,m.lng]);markers[m.id].setIcon(icon(m.kind,m.stale))}
else{markers[m.id]=L.marker([m.lat,m.lng],{icon:icon(m.kind,m.stale),interactive:false}).addTo(map)}});
Object.keys(markers).forEach(function(i){if(!seen[i]){map.removeLayer(markers[i]);delete markers[i]}});
if(line){map.removeLayer(line);line=null}
if(d.line&&d.line.length){line=L.polyline(d.line.map(function(p){return[p[1],p[0]]}),{color:'#000',weight:4}).addTo(map)}
var key=(d.markers||[]).filter(function(m){return m.kind!=='driver'}).map(function(m){return m.id+m.lat+m.lng}).join();
if(d.center){map.setView([d.center.lat,d.center.lng],d.zoom||16)}
else if(key!==fitted&&(d.markers||[]).length){fitted=key;var b=L.latLngBounds((d.markers||[]).map(function(m){return[m.lat,m.lng]}));
if((d.markers||[]).length>1){map.fitBounds(b,{padding:[48,48],maxZoom:16})}else{map.setView(b.getCenter(),15)}}};
map.on('moveend',function(){var c=map.getCenter();window.ReactNativeWebView.postMessage(JSON.stringify({lat:c.lat,lng:c.lng}))});
window.ReactNativeWebView.postMessage(JSON.stringify({ready:true}));
</script></body></html>`;

/** Leaflet with CARTO raster tiles: light on an entry level Android (spec 0003). */
export function ZayMap({
  markers = [],
  line,
  center,
  onCenterChange,
  label,
}: {
  markers?: MapMarker[];
  line?: [number, number][] | null;
  center?: MapCoordinates | null;
  onCenterChange?: (center: MapCoordinates) => void;
  label: string;
}) {
  const webView = useRef<InstanceType<typeof MapWebView>>(null);
  const ready = useRef(false);
  const payload = JSON.stringify({ markers, line, center });
  const latest = useRef(payload);
  latest.current = payload;

  useEffect(() => {
    if (ready.current) {
      webView.current?.injectJavaScript(`zayUpdate(${payload});true;`);
    }
  }, [payload]);

  const onMessage = (event: WebViewMessageEvent) => {
    const data = JSON.parse(event.nativeEvent.data) as
      | { ready: true }
      | MapCoordinates;
    if ("ready" in data) {
      ready.current = true;
      webView.current?.injectJavaScript(`zayUpdate(${latest.current});true;`);
      return;
    }
    onCenterChange?.(data);
  };

  return (
    <View accessibilityLabel={label} className="flex-1 bg-surface-tertiary">
      <MapWebView
        onMessage={onMessage}
        originWhitelist={["*"]}
        ref={webView}
        source={{ html: HTML, baseUrl: "https://zay.app" }}
        style={{ flex: 1, backgroundColor: "#efefef" }}
      />
    </View>
  );
}
