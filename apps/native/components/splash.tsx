import { hideAsync } from "expo-splash-screen";
import { useEffect, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { BRAND, INK } from "@/components/ui";
import { useI18n } from "@/lib/i18n";

const splashIcon = require("@/assets/images/splash-icon.png");

/** Same width as `imageWidth` in the `expo-splash-screen` plugin of `app.json`. */
const LOGO_SIZE = 200;
/** The dots sit under the drawn word, inside the logo's transparent margin. */
const DOTS_OFFSET = 64;
const DOT_SIZE = 10;
const DOT_LIFT = 8;
const BOUNCE_MS = 900;
const STAGGER_MS = 150;
const MIN_VISIBLE_MS = 1000;
const FADE_MS = 200;
const DOTS = [0, 1, 2] as const;

function Dot({ index, still }: { index: number; still: boolean }) {
  const lift = useSharedValue(0);
  useEffect(() => {
    if (still) {
      return;
    }
    lift.value = withDelay(
      index * STAGGER_MS,
      withRepeat(
        withSequence(
          withTiming(-DOT_LIFT, { duration: BOUNCE_MS / 2 }),
          withTiming(0, { duration: BOUNCE_MS / 2 })
        ),
        -1
      )
    );
    return () => cancelAnimation(lift);
  }, [index, still, lift]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: lift.value }],
  }));
  return <Animated.View style={[styles.dot, style]} />;
}

/**
 * The startup screen (spec 0005, AC-1). It copies the native splash pixel for pixel,
 * hides the native one on its first layout, then adds three bouncing dots. It stays
 * until `ready`, and never less than one second, then fades out.
 */
export function BootSplash({
  ready,
  onHidden,
}: {
  ready: boolean;
  onHidden: () => void;
}) {
  const { t } = useI18n();
  const reduceMotion = useReducedMotion();
  const [minElapsed, setMinElapsed] = useState(false);
  const opacity = useSharedValue(1);

  useEffect(() => {
    const timer = setTimeout(() => setMinElapsed(true), MIN_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!(ready && minElapsed)) {
      return;
    }
    opacity.value = withTiming(0, { duration: FADE_MS });
    const timer = setTimeout(onHidden, FADE_MS);
    return () => clearTimeout(timer);
  }, [ready, minElapsed, onHidden, opacity]);

  const fade = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      accessibilityLabel={t("splash.loading")}
      accessible
      onLayout={() => {
        hideAsync().catch(() => undefined);
      }}
      style={[StyleSheet.absoluteFill, styles.screen, fade]}
    >
      <Image source={splashIcon} style={styles.logo} />
      <View style={styles.dots}>
        {DOTS.map((index) => (
          <Dot index={index} key={index} still={reduceMotion} />
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: {
    alignItems: "center",
    backgroundColor: BRAND,
    justifyContent: "center",
  },
  logo: { height: LOGO_SIZE, width: LOGO_SIZE },
  dots: {
    flexDirection: "row",
    gap: DOT_SIZE,
    marginTop: DOTS_OFFSET,
    position: "absolute",
    top: "50%",
  },
  dot: {
    backgroundColor: INK,
    borderRadius: DOT_SIZE / 2,
    height: DOT_SIZE,
    width: DOT_SIZE,
  },
});
