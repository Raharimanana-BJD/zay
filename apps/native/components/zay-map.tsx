import Ionicons from "@expo/vector-icons/Ionicons";
import {
  type Ref,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import WebView, { type WebViewMessageEvent } from "react-native-webview";

import { type IconName, INK } from "@/components/ui";
import { useI18n } from "@/lib/i18n";
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

/** The card at the bottom of the fullscreen map (spec 0005, 0001). */
export interface MapSummary {
  /** A second line, like "Départ → Destination". */
  detail?: string;
  title: string;
  /** Shown on the right, like the price. */
  value?: string;
}

export interface MapFullscreenOptions {
  /** Reads the phone position for "recenter"; null when it is unknown. */
  locate?: () => Promise<MapCoordinates | null>;
  summary?: MapSummary;
}

interface MapCommands {
  centerOn: (position: MapCoordinates) => void;
  fitAll: () => void;
  zoom: (step: 1 | -1) => void;
}

export const TOLIARA: MapCoordinates = { lat: -23.3545, lng: 43.6705 };

// The package defaults this class's props generic to undefined, which reads as never.
const MapWebView = WebView<object>;

const HTML = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
<style>html,body,#m{height:100%;margin:0;background:#e8e5da}
.p{width:18px;height:18px;border-radius:50%;background:#0a0a0a;border:3px solid #fff;box-shadow:0 1px 4px #0006}
.d{width:26px;height:26px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#0a0a0a;box-shadow:0 1px 4px #0006;display:flex;align-items:center;justify-content:center}
.d:after{content:'';width:10px;height:10px;border-radius:50%;background:#f7c910}
.c{width:20px;height:20px;border-radius:50%;background:#0a0a0a;border:3px solid #fff;box-shadow:0 0 0 10px #f7c91055,0 1px 6px #0008}
.s,.s:after{background:#afafaf;box-shadow:none}</style></head><body><div id="m"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
var map=L.map('m',{zoomControl:false,attributionControl:true}).setView([${TOLIARA.lat},${TOLIARA.lng}],14);
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=${encodeURIComponent(ENV.EXPO_PUBLIC_CARTO_API_KEY)}',{maxZoom:19,subdomains:'abcd',
attribution:'&copy; OpenStreetMap contributors, &copy; CARTO'}).addTo(map);
var markers={},line=null,fitted='';
function icon(k,s){var c=k==='pickup'?'p':k==='destination'?'d':'c';var z=k==='driver'?32:24;
var a=k==='destination'?[13,36]:[z/2,z/2];
return L.divIcon({className:'',iconSize:[z,z],iconAnchor:a,html:'<div class="'+c+(s?' s':'')+'"></div>'})}
window.zayUpdate=function(d){var seen={};(d.markers||[]).forEach(function(m){seen[m.id]=1;
if(markers[m.id]){markers[m.id].setLatLng([m.lat,m.lng]);markers[m.id].setIcon(icon(m.kind,m.stale))}
else{markers[m.id]=L.marker([m.lat,m.lng],{icon:icon(m.kind,m.stale),interactive:false}).addTo(map)}});
Object.keys(markers).forEach(function(i){if(!seen[i]){map.removeLayer(markers[i]);delete markers[i]}});
if(line){map.removeLayer(line);line=null}
if(d.line&&d.line.length){var pts=d.line.map(function(p){return[p[1],p[0]]});line=L.layerGroup([L.polyline(pts,{color:'#0a0a0a',weight:3,opacity:.35}),L.polyline(pts,{color:'#f7c910',weight:6,dashArray:'1 11',lineCap:'round'})]).addTo(map)}
var key=(d.markers||[]).filter(function(m){return m.kind!=='driver'}).map(function(m){return m.id+m.lat+m.lng}).join();
if(d.center){map.setView([d.center.lat,d.center.lng],d.zoom||16)}
else if(key!==fitted&&(d.markers||[]).length){fitted=key;var b=L.latLngBounds((d.markers||[]).map(function(m){return[m.lat,m.lng]}));
if((d.markers||[]).length>1){map.fitBounds(b,{padding:[48,48],maxZoom:16})}else{map.setView(b.getCenter(),15)}}};
window.zayZoom=function(s){if(s>0){map.zoomIn()}else{map.zoomOut()}};
window.zayFitAll=function(){var pts=Object.keys(markers).map(function(i){return markers[i].getLatLng()});
if(line){line.eachLayer(function(l){pts=pts.concat(l.getLatLngs())})}
if(!pts.length){return}if(pts.length===1){map.setView(pts[0],15);return}
map.fitBounds(L.latLngBounds(pts),{padding:[48,48],maxZoom:17})};
window.zayCenter=function(lat,lng){map.setView([lat,lng],16)};
map.on('moveend',function(){var c=map.getCenter();window.ReactNativeWebView.postMessage(JSON.stringify({lat:c.lat,lng:c.lng}))});
window.ReactNativeWebView.postMessage(JSON.stringify({ready:true}));
</script></body></html>`;

interface ZayMapProps {
  center?: MapCoordinates | null;
  /** Adds the expand button, which opens the same map in full screen (spec 0005, AC-3). */
  fullscreen?: MapFullscreenOptions;
  label: string;
  line?: [number, number][] | null;
  markers?: MapMarker[];
  onCenterChange?: (center: MapCoordinates) => void;
}

/** Leaflet with CARTO raster tiles: light on an entry level Android (spec 0003). */
export function ZayMap({ fullscreen, ...props }: ZayMapProps) {
  const { t } = useI18n();
  const [isOpen, setOpen] = useState(false);
  return (
    <View className="flex-1">
      <LeafletMap {...props} />
      {fullscreen ? (
        <>
          <View className="absolute top-3 right-3">
            <RoundButton
              icon="expand"
              label={t("map.expand")}
              onPress={() => setOpen(true)}
            />
          </View>
          <MapFullscreen
            {...props}
            isOpen={isOpen}
            onClose={() => setOpen(false)}
            options={fullscreen}
          />
        </>
      ) : null}
    </View>
  );
}

function LeafletMap({
  markers = [],
  line,
  center,
  onCenterChange,
  label,
  ref,
}: Omit<ZayMapProps, "fullscreen"> & { ref?: Ref<MapCommands> }) {
  const webView = useRef<InstanceType<typeof MapWebView>>(null);
  const ready = useRef(false);
  const payload = JSON.stringify({ markers, line, center });
  const latest = useRef(payload);
  latest.current = payload;

  const run = (script: string) => {
    if (ready.current) {
      webView.current?.injectJavaScript(`${script};true;`);
    }
  };
  useImperativeHandle(ref, () => ({
    zoom: (step) => run(`zayZoom(${step})`),
    fitAll: () => run("zayFitAll()"),
    centerOn: ({ lat, lng }) => run(`zayCenter(${Number(lat)},${Number(lng)})`),
  }));

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
    <View accessibilityLabel={label} className="flex-1 bg-map">
      <MapWebView
        onMessage={onMessage}
        originWhitelist={["*"]}
        ref={webView}
        source={{ html: HTML, baseUrl: "https://zay.app" }}
        style={{ flex: 1, backgroundColor: "#e8e5da" }}
      />
    </View>
  );
}

const NOTICE_MS = 2500;
const EDGE_GAP = 12;

function RoundButton({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      className="size-11 items-center justify-center rounded-full bg-surface shadow-black/15 shadow-md active:opacity-80"
      hitSlop={4}
      onPress={onPress}
      style={{ elevation: 4 }}
    >
      <Ionicons color={INK} name={icon} size={20} />
    </Pressable>
  );
}

/**
 * The same markers and line as the small map, in a full screen modal, so both
 * update together (spec 0005, AC-3 and AC-4). Closing keeps the screen below as it was.
 */
function MapFullscreen({
  isOpen,
  onClose,
  options,
  ...props
}: Omit<ZayMapProps, "fullscreen"> & {
  isOpen: boolean;
  onClose: () => void;
  options: MapFullscreenOptions;
}) {
  const { t } = useI18n();
  const insets = useSafeAreaInsets();
  const commands = useRef<MapCommands>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const { summary, locate } = options;

  useEffect(() => {
    if (!notice) {
      return;
    }
    const timer = setTimeout(() => setNotice(null), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  const recenter = async () => {
    const position = await (locate?.() ?? Promise.resolve(null)).catch(
      () => null
    );
    if (position) {
      commands.current?.centerOn(position);
    } else {
      setNotice(t("map.noPosition"));
    }
  };

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      visible={isOpen}
    >
      <View className="flex-1 bg-map">
        <LeafletMap {...props} ref={commands} />
        <View
          className="absolute left-4"
          style={{ top: insets.top + EDGE_GAP }}
        >
          <RoundButton icon="close" label={t("map.close")} onPress={onClose} />
        </View>
        <View
          className="absolute inset-x-4 gap-3"
          pointerEvents="box-none"
          style={{ bottom: insets.bottom + EDGE_GAP }}
        >
          <View className="items-end gap-2" pointerEvents="box-none">
            <RoundButton
              icon="locate"
              label={t("map.center")}
              onPress={recenter}
            />
            <RoundButton
              icon="scan-outline"
              label={t("map.fitAll")}
              onPress={() => commands.current?.fitAll()}
            />
            <RoundButton
              icon="add"
              label={t("map.zoomIn")}
              onPress={() => commands.current?.zoom(1)}
            />
            <RoundButton
              icon="remove"
              label={t("map.zoomOut")}
              onPress={() => commands.current?.zoom(-1)}
            />
          </View>
          {notice ? (
            <View
              accessibilityLiveRegion="polite"
              className="self-center rounded-full bg-foreground px-4 py-2"
            >
              <Text className="font-semibold text-sm text-white">{notice}</Text>
            </View>
          ) : null}
          {summary ? (
            <View
              className="flex-row items-center gap-3 rounded-3xl bg-surface px-5 py-4 shadow-black/10 shadow-lg"
              style={{ elevation: 8 }}
            >
              <View className="flex-1 gap-0.5">
                <Text className="font-bold text-base text-foreground">
                  {summary.title}
                </Text>
                {summary.detail ? (
                  <Text className="text-muted text-sm" numberOfLines={2}>
                    {summary.detail}
                  </Text>
                ) : null}
              </View>
              {summary.value ? (
                <Text className="font-black text-foreground text-lg">
                  {summary.value}
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
