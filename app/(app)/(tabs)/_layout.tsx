import { Tabs } from 'expo-router';
import { Text, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { c } from '../../../components/theme';

// The tab bar lives with its screens, so `name` matches the file names here
// (home/chat/thoughts/profile). Putting Tabs in (app)/_layout.tsx made the
// children resolve as "(tabs)/home", which silently ignored every option.
function TabGlyph({ glyph, color, focused }: { glyph: string; color: ColorValue; focused: boolean }) {
  return <Text style={{ color, fontSize: focused ? 19 : 17, fontWeight: '700' }}>{glyph}</Text>;
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.plum,
        tabBarInactiveTintColor: c.muted,
        tabBarStyle: {
          backgroundColor: c.paper,
          borderTopColor: c.line,
          height: 58 + insets.bottom,
          paddingBottom: insets.bottom + 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Our space',
          tabBarIcon: ({ color, focused }) => <TabGlyph glyph="◌" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarIcon: ({ color, focused }) => <TabGlyph glyph="••" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="thoughts"
        options={{
          title: 'Thoughts',
          tabBarIcon: ({ color, focused }) => <TabGlyph glyph="~" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'You',
          tabBarIcon: ({ color, focused }) => <TabGlyph glyph="○" color={color} focused={focused} />,
        }}
      />
    </Tabs>
  );
}
