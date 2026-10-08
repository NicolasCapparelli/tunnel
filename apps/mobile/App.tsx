import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { AuroraProvider } from "@aurora/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ShareIntentProvider } from "expo-share-intent";
import Constants from "expo-constants";
import { useFonts } from "expo-font";
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
} from "@expo-google-fonts/dm-sans";
import {
  InstrumentSerif_400Regular,
  InstrumentSerif_400Regular_Italic,
} from "@expo-google-fonts/instrument-serif";
import { contract, themes, themeSelection } from "@tunnel/shared/theme";
import { load, type BootState } from "./src/storage";
import TunnelApp from "./src/TunnelApp";

export default function App() {
  const [boot, setBoot] = useState<BootState | null>(null);
  const [error, setError] = useState("");
  const [fonts, fontError] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    InstrumentSerif_400Regular,
    InstrumentSerif_400Regular_Italic,
  });
  useEffect(() => {
    load()
      .then(setBoot)
      .catch((e) => setError(String(e)));
  }, []);
  if (!boot || (!fonts && !fontError))
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#e8ece4",
          alignItems: "center",
          justifyContent: "center",
          padding: 30,
        }}
      >
        {error ? (
          <Text accessibilityRole="alert" style={{ color: "#344640" }}>
            Could not open local storage. {error}
          </Text>
        ) : (
          <ActivityIndicator color="#296657" />
        )}
      </View>
    );
  return (
    <ShareIntentProvider
      options={{
        disabled: Constants.executionEnvironment === "storeClient",
        resetOnBackground: false,
      }}
    >
      <SafeAreaProvider>
        <AuroraProvider
          contract={contract}
          themes={themes}
          initialSelection={themeSelection(boot.theme)}
          fallback="preferred"
        >
          <TunnelApp boot={boot} />
        </AuroraProvider>
      </SafeAreaProvider>
    </ShareIntentProvider>
  );
}
