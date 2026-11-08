import * as ImagePicker from "expo-image-picker";

/** Light enough for a weak network, sharp enough to read a paper. */
const IMAGE_QUALITY = 0.6;

export type ImageSource = "camera" | "library";

export interface PickedImage {
  name: string;
  uri: string;
}

/**
 * Opens the camera or the gallery, as the person chose. Null when cancelled.
 * Throws `CAMERA_DENIED` when the camera permission is refused.
 */
export async function pickImage(
  source: ImageSource,
  { square = false }: { square?: boolean } = {}
): Promise<PickedImage | null> {
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ["images"],
    quality: IMAGE_QUALITY,
    ...(square ? { allowsEditing: true, aspect: [1, 1] } : {}),
  };
  // The gallery goes through Android's photo picker, which needs no permission.
  if (source === "camera") {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      throw new Error("CAMERA_DENIED");
    }
  }
  const picked =
    source === "camera"
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  const asset = picked.assets?.[0];
  if (picked.canceled || !asset) {
    return null;
  }
  return { uri: asset.uri, name: asset.fileName ?? "" };
}
