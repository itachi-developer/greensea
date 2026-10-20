import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen';
import ParadoxScreen from '../screens/ParadoxScreen';
import GlobalChatScreen from '../screens/GlobalChatScreen';

export type RootStackParamList = {
  Home: undefined;
  Paradox: undefined;
  Arenas: undefined;
  GlobalChat: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerStyle: { backgroundColor: '#0B0D17' },
        headerTintColor: '#00F0FF',
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: '#0B0D17' },
      }}
    >
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Paradox"
        component={ParadoxScreen}
        options={{ title: 'Il Paradosso' }}
      />
      <Stack.Screen
        name="Arenas"
        component={ParadoxScreen}
        options={{ title: 'Arene Multiplayer' }}
      />
      <Stack.Screen
        name="GlobalChat"
        component={GlobalChatScreen}
        options={{ title: 'Salotto Sociale' }}
      />
    </Stack.Navigator>
  );
}
