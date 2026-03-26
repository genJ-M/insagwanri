import { Tabs } from 'expo-router';
import { Text } from 'react-native';

function Icon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: '#fff' },
        headerTitleStyle: { fontWeight: '700', color: '#111827' },
        tabBarActiveTintColor: '#2563EB',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: {
          borderTopColor: '#F3F4F6',
          paddingBottom: 4,
          height: 62,
        },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '500' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '홈',
          tabBarIcon: ({ focused }) => <Icon emoji="🏠" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="attendance"
        options={{
          title: '근태',
          tabBarIcon: ({ focused }) => <Icon emoji="⏱️" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="vacations"
        options={{
          title: '휴가',
          tabBarIcon: ({ focused }) => <Icon emoji="🌴" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: '업무',
          tabBarIcon: ({ focused }) => <Icon emoji="✅" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: '채팅',
          tabBarIcon: ({ focused }) => <Icon emoji="💬" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: '내 정보',
          tabBarIcon: ({ focused }) => <Icon emoji="👤" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
