import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

// Root layout: just render the page. Auth redirect is handled per-page.
export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Slot />
    </>
  );
}
