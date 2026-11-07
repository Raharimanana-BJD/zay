import { router } from "expo-router";
import { useRef, useState } from "react";
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { BlobArt } from "@/components/auth-shell";
import { SafeAreaView } from "@/components/styled";
import { Action } from "@/components/ui";
import { type TKey, useI18n } from "@/lib/i18n";
import { markOnboarded } from "@/lib/onboarding";

const SLIDES = [
  {
    image: require("@/assets/images/onboarding-1.png"),
    title: "onboarding.title1",
    body: "onboarding.body1",
  },
  {
    image: require("@/assets/images/onboarding-2.png"),
    title: "onboarding.title2",
    body: "onboarding.body2",
  },
  {
    image: require("@/assets/images/onboarding-3.png"),
    title: "onboarding.title3",
    body: "onboarding.body3",
  },
] as const satisfies readonly { image: number; title: TKey; body: TKey }[];

/** Three slides on the first launch, then the sign in screen. */
export default function OnboardingScreen() {
  const { t } = useI18n();
  const { width } = useWindowDimensions();
  const pager = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const isLast = index === SLIDES.length - 1;

  const finish = () => {
    markOnboarded();
    router.replace("/connexion");
  };

  const next = () => {
    if (isLast) {
      finish();
      return;
    }
    pager.current?.scrollTo({ x: (index + 1) * width, animated: true });
    setIndex(index + 1);
  };

  const onScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) =>
    setIndex(Math.round(event.nativeEvent.contentOffset.x / width));

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={["top", "bottom"]}>
      <View className="h-14 flex-row items-center justify-end px-6">
        {isLast ? null : (
          <Pressable
            accessibilityRole="button"
            className="min-h-11 justify-center px-2"
            onPress={finish}
          >
            <Text className="font-bold text-base text-muted">
              {t("onboarding.skip")}
            </Text>
          </Pressable>
        )}
      </View>
      <ScrollView
        horizontal
        onMomentumScrollEnd={onScrollEnd}
        pagingEnabled
        ref={pager}
        showsHorizontalScrollIndicator={false}
      >
        {SLIDES.map((slide) => (
          <View
            className="flex-1 items-center justify-center gap-8 px-8"
            key={slide.title}
            style={{ width }}
          >
            <BlobArt source={slide.image} />
            <View className="h-2" />
            <View className="gap-3">
              <Text
                accessibilityRole="header"
                className="text-center font-black text-3xl text-foreground tracking-tight"
              >
                {t(slide.title)}
              </Text>
              <Text className="text-center text-base text-muted leading-6">
                {t(slide.body)}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>
      <View className="gap-6 px-6 pt-4 pb-4">
        <View
          accessibilityLabel={`${index + 1} / ${SLIDES.length}`}
          className="flex-row justify-center gap-2"
        >
          {SLIDES.map((slide, dot) => (
            <View
              className={`h-2 rounded-full ${dot === index ? "w-6 bg-brand" : "w-2 bg-surface-secondary"}`}
              key={slide.title}
            />
          ))}
        </View>
        <Action
          label={isLast ? t("onboarding.start") : t("onboarding.next")}
          onPress={next}
        />
      </View>
    </SafeAreaView>
  );
}
