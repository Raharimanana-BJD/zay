import {
  KeyboardAvoidingView as RawKeyboardAvoidingView,
  KeyboardAwareScrollView as RawKeyboardAwareScrollView,
} from "react-native-keyboard-controller";
import { SafeAreaView as RawSafeAreaView } from "react-native-safe-area-context";
import { withUniwind } from "uniwind";

// Uniwind styles only the React Native core components. These read `className` too.
export const SafeAreaView = withUniwind(RawSafeAreaView);
export const KeyboardAwareScrollView = withUniwind(RawKeyboardAwareScrollView);
export const KeyboardAvoidingView = withUniwind(RawKeyboardAvoidingView);
