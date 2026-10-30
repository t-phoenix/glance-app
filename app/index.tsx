import { Redirect } from 'expo-router';

/** The installed app opens at the root path. Today owns that path. */
export default function Index() {
  return <Redirect href="/(tabs)/today" />;
}
